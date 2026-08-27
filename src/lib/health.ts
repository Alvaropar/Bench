import { sql } from "drizzle-orm";
import { getDb } from "@/db";
import { PROVIDER_ENV_VAR, createProvider, resolveProviderId } from "@/lib/agent/providers";

export type HealthCheck = { name: string; ok: boolean; detail?: string };

export async function runHealthChecks(): Promise<HealthCheck[]> {
  const checks: HealthCheck[] = [{ name: "Next.js app", ok: true }];

  try {
    await getDb().execute(sql`select 1`);
    checks.push({ name: "Neon Postgres", ok: true });
  } catch (error) {
    checks.push({
      name: "Neon Postgres",
      ok: false,
      detail: error instanceof Error ? error.message.slice(0, 140) : "unknown error",
    });
  }

  const providerId = resolveProviderId();
  const envVar = PROVIDER_ENV_VAR[providerId];
  const configured = Boolean(process.env[envVar]);

  checks.push({
    name: "Model provider",
    ok: configured,
    detail: configured
      ? `${createProvider(providerId).label} (${createProvider(providerId).model})`
      : `${envVar} not set — set it, or pick the other provider with BENCH_PROVIDER`,
  });

  return checks;
}
