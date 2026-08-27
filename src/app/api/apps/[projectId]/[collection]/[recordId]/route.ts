import { NextResponse } from "next/server";
import { resolveApp } from "@/lib/app-context";
import { readJson, route } from "@/lib/http";
import { deleteRecord, updateRecord } from "@/lib/records";
import { getSessionId } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = RouteContext<"/api/apps/[projectId]/[collection]/[recordId]">;

export const PATCH = route(async (request: Request, ctx: Ctx) => {
  const { projectId, collection, recordId } = await ctx.params;
  const sessionId = await getSessionId();
  const { schema } = await resolveApp(projectId, sessionId);

  const record = await updateRecord({
    projectId,
    collection,
    recordId,
    schema,
    data: await readJson(request),
  });

  return NextResponse.json({ record });
});

export const DELETE = route(async (_request: Request, ctx: Ctx) => {
  const { projectId, recordId } = await ctx.params;
  const sessionId = await getSessionId();
  await resolveApp(projectId, sessionId);

  await deleteRecord({ projectId, recordId });
  return NextResponse.json({ ok: true });
});
