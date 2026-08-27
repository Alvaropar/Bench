import { createAnthropicProvider } from "@/lib/agent/providers/anthropic";
import { createMoonshotProvider } from "@/lib/agent/providers/moonshot";
import type { AgentProvider } from "@/lib/agent/providers/types";

export * from "@/lib/agent/providers/types";

export const PROVIDER_IDS = ["anthropic", "moonshot"] as const;
export type ProviderId = (typeof PROVIDER_IDS)[number];

export const PROVIDER_ENV_VAR: Record<ProviderId, string> = {
  anthropic: "ANTHROPIC_API_KEY",
  moonshot: "MOONSHOT_API_KEY",
};

export function isProviderId(value: string): value is ProviderId {
  return (PROVIDER_IDS as readonly string[]).includes(value);
}

/**
 * Resolves the configured provider.
 *
 * BENCH_PROVIDER wins when set. Otherwise whichever key exists is used, which
 * means a deployment that only has one of them works without extra config.
 */
export function resolveProviderId(): ProviderId {
  const requested = process.env.BENCH_PROVIDER;
  if (requested && isProviderId(requested)) return requested;
  if (!process.env.ANTHROPIC_API_KEY && process.env.MOONSHOT_API_KEY) return "moonshot";
  return "anthropic";
}

export function createProvider(id: ProviderId = resolveProviderId()): AgentProvider {
  switch (id) {
    case "moonshot":
      return createMoonshotProvider();
    case "anthropic":
      return createAnthropicProvider();
  }
}
