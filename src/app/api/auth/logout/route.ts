import { NextResponse } from "next/server";
import { getViewer, logout } from "@/lib/auth";
import { route } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Signing out unbinds the browser session from the account.
 *
 * The session cookie itself survives, so anything created afterwards is
 * anonymous again rather than the browser losing its identity entirely.
 */
export const POST = route(async () => {
  const viewer = await getViewer();
  await logout(viewer.sessionId);
  return NextResponse.json({ ok: true });
});
