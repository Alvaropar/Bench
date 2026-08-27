import OpenAI from "openai";
import {
  ProviderNotConfigured,
  type AgentProvider,
  type ConversationMessage,
  type ProviderDelta,
  type ProviderTurn,
  type StopReason,
  type StreamTurnInput,
  type ToolCall,
} from "@/lib/agent/providers/types";

const BASE_URL = "https://api.moonshot.ai/v1";
const MAX_COMPLETION_TOKENS = 65_536;

/**
 * K3 exposes low | high | max only, and thinking cannot be disabled. Bench's
 * shared BENCH_EFFORT vocabulary is Anthropic's five levels, so the two middle
 * values collapse onto the nearest thing K3 actually accepts.
 */
function reasoningEffort(): "low" | "high" | "max" {
  switch (process.env.BENCH_EFFORT ?? "high") {
    case "low":
      return "low";
    case "max":
    case "xhigh":
      return "max";
    default:
      return "high";
  }
}

/** K3 streams its reasoning on a field the OpenAI SDK's types do not know about. */
type MoonshotDelta = OpenAI.Chat.Completions.ChatCompletionChunk.Choice.Delta & {
  reasoning_content?: string | null;
};

export function toOpenAIMessages(
  system: string,
  messages: ConversationMessage[],
): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
  const mapped: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: system },
  ];

  for (const message of messages) {
    switch (message.role) {
      case "user":
        mapped.push({ role: "user", content: message.text });
        break;
      case "assistant":
        mapped.push({
          role: "assistant",
          content: message.text || null,
          ...(message.toolCalls.length > 0 && {
            tool_calls: message.toolCalls.map((call) => ({
              id: call.id,
              type: "function" as const,
              function: { name: call.name, arguments: JSON.stringify(call.input) },
            })),
          }),
        });
        break;
      case "tool_results":
        // Unlike Anthropic, results are separate messages — one per call. There
        // is no is_error flag, so failure has to be said in the content.
        for (const result of message.results) {
          mapped.push({
            role: "tool",
            tool_call_id: result.id,
            content: result.isError ? `Error: ${result.content}` : result.content,
          });
        }
        break;
    }
  }

  return mapped;
}

interface CallAccumulator {
  id: string;
  name: string;
  arguments: string;
}

export interface ToolCallFragment {
  index: number;
  id?: string;
  function?: { name?: string; arguments?: string };
}

/**
 * Reassembles tool calls from streamed fragments.
 *
 * Arguments arrive as JSON *fragments* keyed by index across many chunks;
 * parsing before the stream ends yields truncated JSON, which is the classic
 * way a port of this loop breaks silently. Extracted from the stream loop so
 * it can be tested without a network call.
 */
export class ToolCallAccumulator {
  private readonly calls = new Map<number, CallAccumulator>();

  add(fragment: ToolCallFragment): void {
    const slot = this.calls.get(fragment.index) ?? { id: "", name: "", arguments: "" };
    if (fragment.id) slot.id = fragment.id;
    if (fragment.function?.name) slot.name += fragment.function.name;
    if (fragment.function?.arguments) slot.arguments += fragment.function.arguments;
    this.calls.set(fragment.index, slot);
  }

  get size(): number {
    return this.calls.size;
  }

  finish(): ToolCall[] {
    return [...this.calls.entries()]
      .sort(([a], [b]) => a - b)
      .map(([index, slot]) => ({
        // Some OpenAI-compatible servers send the id only on the first
        // fragment, and a few omit it entirely.
        id: slot.id || `call_${index}`,
        name: slot.name,
        // A malformed payload becomes an input the executors reject with a
        // readable message, which is a better correction signal than a crash.
        input: parseArguments(slot.arguments),
      }));
  }
}

export function createMoonshotProvider(): AgentProvider {
  const model = process.env.BENCH_MODEL ?? "kimi-k3";

  return {
    id: "moonshot",
    label: "Kimi",
    model,

    async *streamTurn(input: StreamTurnInput): AsyncGenerator<ProviderDelta, ProviderTurn> {
      const apiKey = process.env.MOONSHOT_API_KEY;
      if (!apiKey) throw new ProviderNotConfigured("MOONSHOT_API_KEY", "Kimi");

      const client = new OpenAI({ apiKey, baseURL: BASE_URL });

      const stream = await client.chat.completions.create({
        model,
        stream: true,
        max_completion_tokens: MAX_COMPLETION_TOKENS,
        reasoning_effort: reasoningEffort(),
        // temperature, top_p, n and the penalties are fixed server-side on K3;
        // sending them is at best ignored and at worst rejected.
        messages: toOpenAIMessages(input.system, input.messages),
        tools: input.tools.map((tool) => ({
          type: "function" as const,
          function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters,
          },
        })),
      });

      const calls = new ToolCallAccumulator();
      let text = "";
      let finishReason: string | null = null;

      for await (const chunk of stream) {
        const choice = chunk.choices[0];
        if (!choice) continue;
        if (choice.finish_reason) finishReason = choice.finish_reason;

        const delta = choice.delta as MoonshotDelta | undefined;
        if (!delta) continue;

        if (delta.reasoning_content) {
          yield { type: "thinking", text: delta.reasoning_content };
        }
        if (delta.content) {
          text += delta.content;
          yield { type: "text", text: delta.content };
        }

        for (const fragment of delta.tool_calls ?? []) {
          calls.add(fragment);
        }
      }

      const toolCalls: ToolCall[] = calls.finish();

      return {
        text: text.trim(),
        toolCalls,
        stopReason: mapStopReason(finishReason, toolCalls.length > 0),
      };
    },
  };
}

function parseArguments(raw: string): unknown {
  if (!raw.trim()) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return { __malformed: raw };
  }
}

function mapStopReason(finishReason: string | null, hasToolCalls: boolean): StopReason {
  // Presence of tool calls is authoritative: some OpenAI-compatible servers
  // report "stop" on a turn that nonetheless carries calls to execute.
  if (hasToolCalls) return "tools";
  switch (finishReason) {
    case "length":
      return "length";
    case "content_filter":
      return "refusal";
    default:
      return "end";
  }
}
