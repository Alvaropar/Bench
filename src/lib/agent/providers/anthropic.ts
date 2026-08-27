import Anthropic from "@anthropic-ai/sdk";
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

const MAX_TOKENS = 64_000;

/**
 * `xhigh` is the documented sweet spot for coding work, but generation latency
 * is what a reviewer actually feels — a three-minute wait reads as broken no
 * matter how good the output. `high` is the balance; BENCH_EFFORT raises it.
 */
function effort() {
  return (process.env.BENCH_EFFORT ?? "high") as "low" | "medium" | "high" | "xhigh" | "max";
}

function toAnthropicMessages(messages: ConversationMessage[]): Anthropic.MessageParam[] {
  return messages.map((message): Anthropic.MessageParam => {
    switch (message.role) {
      case "user":
        return { role: "user", content: message.text };
      case "assistant": {
        const content: Anthropic.ContentBlockParam[] = [];
        if (message.text) content.push({ type: "text", text: message.text });
        for (const call of message.toolCalls) {
          content.push({
            type: "tool_use",
            id: call.id,
            name: call.name,
            input: call.input as Record<string, unknown>,
          });
        }
        return { role: "assistant", content };
      }
      case "tool_results":
        // All results in one user message: splitting them across several
        // messages silently teaches the model to stop batching tool calls.
        return {
          role: "user",
          content: message.results.map((result) => ({
            type: "tool_result" as const,
            tool_use_id: result.id,
            content: result.content,
            is_error: result.isError,
          })),
        };
    }
  });
}

function mapStopReason(reason: Anthropic.Message["stop_reason"]): StopReason {
  switch (reason) {
    case "tool_use":
      return "tools";
    case "refusal":
      return "refusal";
    case "max_tokens":
      return "length";
    default:
      return "end";
  }
}

export function createAnthropicProvider(): AgentProvider {
  const model = process.env.BENCH_MODEL ?? "claude-opus-5";

  return {
    id: "anthropic",
    label: "Claude",
    model,

    async *streamTurn(input: StreamTurnInput): AsyncGenerator<ProviderDelta, ProviderTurn> {
      if (!process.env.ANTHROPIC_API_KEY) {
        throw new ProviderNotConfigured("ANTHROPIC_API_KEY", "Claude");
      }

      const client = new Anthropic();
      const stream = client.messages.stream({
        model,
        max_tokens: MAX_TOKENS,
        system: input.system,
        // `display: "summarized"` is opt-in — without it thinking blocks stream
        // empty and the timeline shows a long pause instead of a plan.
        thinking: { type: "adaptive", display: "summarized" },
        output_config: { effort: effort() },
        tools: input.tools.map((tool) => ({
          name: tool.name,
          description: tool.description,
          input_schema: tool.parameters as Anthropic.Tool["input_schema"],
        })),
        messages: toAnthropicMessages(input.messages),
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

      const text = message.content
        .filter((block): block is Anthropic.TextBlock => block.type === "text")
        .map((block) => block.text)
        .join("")
        .trim();

      const toolCalls: ToolCall[] = message.content
        .filter((block): block is Anthropic.ToolUseBlock => block.type === "tool_use")
        .map((block) => ({ id: block.id, name: block.name, input: block.input }));

      return { text, toolCalls, stopReason: mapStopReason(message.stop_reason) };
    },
  };
}
