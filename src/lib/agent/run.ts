import Anthropic from "@anthropic-ai/sdk";
import { ENTRY_FILE } from "@/lib/agent/contract";
import type { StreamEvent } from "@/lib/agent/events";
import { SYSTEM_PROMPT, buildContextMessage } from "@/lib/agent/prompt";
import { TOOL_DEFINITIONS, executeTool, type AgentState } from "@/lib/agent/tools";
import { misconfigured } from "@/lib/errors";
import { appendMessage, listMessages } from "@/lib/messages";
import { commitVersion } from "@/lib/projects";
import { seedRecords } from "@/lib/records";
import type { Project, Version } from "@/db/schema";
import type { FileMap, ToolEvent } from "@/lib/types";

/**
 * A manual streaming loop rather than the SDK's beta tool runner.
 *
 * The runner drives tool calls well, but this loop has to do three things it
 * does not expose cleanly: emit a domain event per tool call in order, hold
 * mutating file state across the whole run, and commit exactly one version at
 * the end. Owning the loop costs ~80 lines and buys all three.
 */

const MODEL = process.env.BENCH_MODEL ?? "claude-opus-5";

/**
 * `xhigh` is the documented sweet spot for coding work, but generation latency
 * is the thing a reviewer actually feels — a three-minute wait reads as broken
 * no matter how good the output. `high` is the balance; BENCH_EFFORT=xhigh is
 * one environment variable away when quality matters more than the clock.
 */
const EFFORT = (process.env.BENCH_EFFORT ?? "high") as
  | "low"
  | "medium"
  | "high"
  | "xhigh"
  | "max";

const MAX_ITERATIONS = 12;
const MAX_TOKENS = 64_000;

function textOf(message: Anthropic.Message): string {
  return message.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("")
    .trim();
}

export async function* runAgent(input: {
  project: Project;
  version: Version;
  userMessage: string;
}): AsyncGenerator<StreamEvent> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw misconfigured(
      "ANTHROPIC_API_KEY is not set. Add it to .env.local and to your deployment's environment.",
    );
  }

  const client = new Anthropic();
  const state: AgentState = {
    files: { ...input.version.files },
    schema: structuredClone(input.version.appSchema),
    pendingSeeds: [],
  };

  const history = await listMessages(input.project.id);
  const conversation: Anthropic.MessageParam[] = history
    .filter((message) => message.content.trim().length > 0)
    .map((message) => ({ role: message.role, content: message.content }));

  // The context block carries the current files, so it belongs only on the
  // turn being sent — repeating it every turn would bloat the conversation
  // with stale copies of files that have since changed.
  conversation.push({
    role: "user",
    content: [
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
    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: SYSTEM_PROMPT,
      thinking: { type: "adaptive", display: "summarized" },
      output_config: { effort: EFFORT },
      tools: TOOL_DEFINITIONS,
      messages: conversation,
    });

    for await (const event of stream) {
      if (event.type !== "content_block_delta") continue;
      if (event.delta.type === "thinking_delta") {
        yield { type: "thinking", text: event.delta.thinking };
      } else if (event.delta.type === "text_delta") {
        yield { type: "text", text: event.delta.text };
      }
    }

    const message = await stream.finalMessage();

    if (message.stop_reason === "refusal") {
      throw new Error(
        "The model declined this request. Try describing the tool differently.",
      );
    }

    if (message.stop_reason === "end_turn" || message.stop_reason === "max_tokens") {
      summary = textOf(message);
      break;
    }

    const toolUses = message.content.filter(
      (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
    );

    if (toolUses.length === 0) {
      summary = textOf(message);
      break;
    }

    conversation.push({ role: "assistant", content: message.content });

    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const toolUse of toolUses) {
      const outcome = executeTool(state, toolUse.name, toolUse.input);
      if (outcome.event) {
        timeline.push(outcome.event);
        yield { type: "tool", event: outcome.event };
      }
      results.push({
        type: "tool_result",
        tool_use_id: toolUse.id,
        content: outcome.result,
        is_error: outcome.isError,
      });
    }

    // All results in one user message: splitting them across several messages
    // silently teaches the model to stop batching tool calls.
    conversation.push({ role: "user", content: results });
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

  // Seeds land only now, so a run that failed halfway leaves no rows behind
  // for an app that was never saved.
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
