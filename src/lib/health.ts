import { sql } from "drizzle-orm";
import { getDb } from "@/db";

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

  checks.push({
    name: "Anthropic API key",
    ok: Boolean(process.env.ANTHROPIC_API_KEY),
    detail: process.env.ANTHROPIC_API_KEY ? undefined : "ANTHROPIC_API_KEY not set",
  });

  return checks;
}
