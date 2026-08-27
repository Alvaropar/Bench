/**
 * A provider-neutral view of one agent turn.
 *
 * Everything above this boundary — the tool executors, schema validation, the
 * runtime contract, the SSE events, the whole UI — is model-agnostic. Only the
 * files in this directory know what an Anthropic content block or an OpenAI
 * tool_call looks like.
 */

export interface ToolSpec {
  name: string;
  description: string;
  /** JSON Schema for the tool's arguments. */
  parameters: Record<string, unknown>;
}

export interface ToolCall {
  id: string;
  name: string;
  input: unknown;
}

export interface ToolResult {
  id: string;
  content: string;
  isError?: boolean;
}

export type ConversationMessage =
  | { role: "user"; text: string }
  | { role: "assistant"; text: string; toolCalls: ToolCall[] }
  | { role: "tool_results"; results: ToolResult[] };

/** Streamed while a turn is in flight. */
export type ProviderDelta =
  | { type: "thinking"; text: string }
  | { type: "text"; text: string };

export type StopReason = "end" | "tools" | "refusal" | "length";

export interface ProviderTurn {
  text: string;
  toolCalls: ToolCall[];
  stopReason: StopReason;
}

export interface StreamTurnInput {
  system: string;
  messages: ConversationMessage[];
  tools: ToolSpec[];
}

export interface AgentProvider {
  /** Shown in health checks and the workspace header. */
  readonly id: string;
  readonly label: string;
  readonly model: string;
  /**
   * Streams one assistant turn. Yields deltas as they arrive and returns the
   * assembled turn — the return value is what the loop acts on.
   */
  streamTurn(input: StreamTurnInput): AsyncGenerator<ProviderDelta, ProviderTurn>;
}

/** Thrown when a provider is selected but not configured. */
export class ProviderNotConfigured extends Error {
  constructor(envVar: string, provider: string) {
    super(
      `${envVar} is not set, so the ${provider} provider cannot run. Add it to .env.local and to your deployment's environment.`,
    );
    this.name = "ProviderNotConfigured";
  }
}
