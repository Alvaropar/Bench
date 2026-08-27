import { NextResponse } from "next/server";
import { runHealthChecks } from "@/lib/health";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Same checks the home page renders — this route just serves them as JSON. */
export async function GET() {
  const checks = await runHealthChecks();
  const healthy = checks.every((check) => check.ok);

  return NextResponse.json(
    {
      status: healthy ? "healthy" : "degraded",
      checks: Object.fromEntries(
        checks.map((check) => [check.name, check.ok ? (check.detail ?? "ok") : check.detail]),
      ),
      at: new Date().toISOString(),
    },
    { status: healthy ? 200 : 503 },
  );
}
