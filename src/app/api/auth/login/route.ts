import { NextResponse } from "next/server";
import { z } from "zod";
import { getViewer, login } from "@/lib/auth";
import { badRequest } from "@/lib/errors";
import { readJson, route } from "@/lib/http";
import { checkRateLimit, rateLimitKey } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const body = z.object({
  email: z.string().min(3).max(200),
  password: z.string().min(1).max(200),
});

export const POST = route(async (request: Request) => {
  const viewer = await getViewer();
  // Tighter than the rest of the API: this is the one endpoint where guessing
  // repeatedly is the attack.
  checkRateLimit(rateLimitKey("auth", viewer.sessionId, request), {
    limit: 10,
    windowMs: 15 * 60_000,
    label: "sign-in attempts",
  });

  const parsed = body.safeParse(await readJson(request));
  if (!parsed.success) throw badRequest("Invalid body", parsed.error.issues);

  const user = await login({ ...parsed.data, sessionId: viewer.sessionId });

  return NextResponse.json({ user: { id: user.id, email: user.email } });
});
