import { NextResponse } from "next/server";
import { resolveApp } from "@/lib/app-context";
import { readJson, route } from "@/lib/http";
import { deleteRecord, updateRecord } from "@/lib/records";
import { LIMITS, checkRateLimit, rateLimitKey } from "@/lib/rate-limit";
import { getViewer } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = RouteContext<"/api/apps/[projectId]/[collection]/[recordId]">;

export const PATCH = route(async (request: Request, ctx: Ctx) => {
  const { projectId, collection, recordId } = await ctx.params;
  const viewer = await getViewer();
  checkRateLimit(rateLimitKey("recordWrite", viewer.sessionId, request), LIMITS.recordWrite);
  const { schema } = await resolveApp(projectId, viewer);

  const record = await updateRecord({
    projectId,
    collection,
    recordId,
    schema,
    data: await readJson(request),
  });

  return NextResponse.json({ record });
});

export const DELETE = route(async (request: Request, ctx: Ctx) => {
  const { projectId, recordId } = await ctx.params;
  const viewer = await getViewer();
  checkRateLimit(rateLimitKey("recordWrite", viewer.sessionId, request), LIMITS.recordWrite);
  await resolveApp(projectId, viewer);

  await deleteRecord({ projectId, recordId });
  return NextResponse.json({ ok: true });
});
