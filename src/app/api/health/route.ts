import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const checks: Record<string, string> = {
    app: "ok",
    anthropicKey: process.env.ANTHROPIC_API_KEY ? "ok" : "missing",
  };

  try {
    await getDb().execute(sql`select 1`);
    checks.database = "ok";
  } catch (error) {
    checks.database = error instanceof Error ? error.message : "unknown error";
  }

  const healthy = Object.values(checks).every((v) => v === "ok");
  return NextResponse.json(
    { status: healthy ? "healthy" : "degraded", checks, at: new Date().toISOString() },
    { status: healthy ? 200 : 503 },
  );
}
