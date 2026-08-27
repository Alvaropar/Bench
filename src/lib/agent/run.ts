import { ENTRY_FILE } from "@/lib/agent/contract";
import type { StreamEvent } from "@/lib/agent/events";
import { SYSTEM_PROMPT, buildContextMessage } from "@/lib/agent/prompt";
import { createProvider } from "@/lib/agent/providers";
import type {
  ConversationMessage,
  ProviderDelta,
  ToolResult,
} from "@/lib/agent/providers/types";
import { TOOL_SPECS, executeTool, type AgentState } from "@/lib/agent/tools";
import { appendMessage, listMessages } from "@/lib/messages";
import { commitVersion } from "@/lib/projects";
import { seedRecords } from "@/lib/records";
import type { Project, Version } from "@/db/schema";
import type { FileMap, ToolEvent } from "@/lib/types";

/**
 * The agent loop, written against a provider interface rather than one SDK.
 *
 * Nothing here knows whether it is talking to Claude or Kimi: the differences
 * (content blocks vs. tool_calls, thinking vs. reasoning_content, the tool
 * schema field name) all live in `providers/`.
 *
 * It is a manual loop rather than a vendor tool runner because it needs three
 * things no runner exposes cleanly: ordered domain events per tool call, file
 * state mutating across the whole run, and exactly one version commit at the end.
 */

const MAX_ITERATIONS = 12;

/**
 * `yield*` below forwards the provider's deltas straight to the SSE stream,
 * which only works while every ProviderDelta is also a valid StreamEvent.
 * Pinned here so adding a provider-only delta breaks the build rather than
 * leaking an unhandled event shape to the browser.
 */
type _DeltasAreStreamEvents = ProviderDelta extends StreamEvent ? true : never;
const _deltaCheck: _DeltasAreStreamEvents = true;
void _deltaCheck;

export async function* runAgent(input: {
  project: Project;
  version: Version;
  userMessage: string;
}): AsyncGenerator<StreamEvent> {
  const provider = createProvider();

  const state: AgentState = {
    files: { ...input.version.files },
    schema: structuredClone(input.version.appSchema),
    pendingSeeds: [],
  };

  const history = await listMessages(input.project.id);
  const conversation: ConversationMessage[] = history
    .filter((message) => message.content.trim().length > 0)
    .map((message) =>
      message.role === "user"
        ? { role: "user", text: message.content }
        : { role: "assistant", text: message.content, toolCalls: [] },
    );

  // The context block carries the current files, so it belongs only on the turn
  // being sent — repeating it every turn would fill the conversation with stale
  // copies of files that have since changed.
  conversation.push({
    role: "user",
    text: [
      buildContextMessage({
        title: input.project.title,
        files: state.files,
        schema: state.schema,
      }),
      "",
      "---",
      "",
      input.userMessage,
    ].join("\n"),
  });

  yield { type: "start" };

  const timeline: ToolEvent[] = [];
  let summary = "";

  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
    const turn = yield* provider.streamTurn({
      system: SYSTEM_PROMPT,
      messages: conversation,
      tools: TOOL_SPECS,
    });

    if (turn.stopReason === "refusal") {
      throw new Error("The model declined this request. Try describing the tool differently.");
    }

    if (turn.toolCalls.length === 0) {
      summary = turn.text;
      break;
    }

    conversation.push({
      role: "assistant",
      text: turn.text,
      toolCalls: turn.toolCalls,
    });

    const results: ToolResult[] = [];
    for (const call of turn.toolCalls) {
      const outcome = executeTool(state, call.name, call.input);
      if (outcome.event) {
        timeline.push(outcome.event);
        yield { type: "tool", event: outcome.event };
      }
      results.push({ id: call.id, content: outcome.result, isError: outcome.isError });
    }

    conversation.push({ role: "tool_results", results });
  }

  const problem = validateOutput(state.files, state.schema.collections.length);
  if (problem) throw new Error(problem);

  const version = await commitVersion({
    projectId: input.project.id,
    parentId: input.version.id,
    files: state.files,
    appSchema: state.schema,
    label: input.userMessage.slice(0, 80),
  });

  // Seeds land only now, so a run that failed halfway leaves no rows behind for
  // an app that was never saved.
  let seededRows = 0;
  for (const seed of state.pendingSeeds) {
    seededRows += await seedRecords({
      projectId: input.project.id,
      collection: seed.collection,
      schema: state.schema,
      rows: seed.rows,
    });
  }

  await appendMessage({
    projectId: input.project.id,
    role: "user",
    content: input.userMessage,
  });
  await appendMessage({
    projectId: input.project.id,
    role: "assistant",
    content: summary,
    toolEvents: [...timeline, { kind: "done", summary }],
    versionId: version.id,
  });

  yield {
    type: "done",
    versionId: version.id,
    summary,
    schema: state.schema,
    files: state.files,
    seededRows,
  };
}

function validateOutput(files: FileMap, collectionCount: number): string | null {
  if (!(ENTRY_FILE in files)) {
    return `The agent finished without writing ${ENTRY_FILE}, so there is no app to render.`;
  }
  if (collectionCount === 0) {
    return "The agent finished without declaring a data model, so the app would have nowhere to store data.";
  }
  return null;
}
