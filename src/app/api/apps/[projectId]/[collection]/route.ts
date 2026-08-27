import { NextResponse } from "next/server";
import { resolveApp } from "@/lib/app-context";
import { readJson, route } from "@/lib/http";
import { createRecord, listRecords } from "@/lib/records";
import { getSessionId } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = RouteContext<"/api/apps/[projectId]/[collection]">;

export const GET = route(async (request: Request, ctx: Ctx) => {
  const { projectId, collection } = await ctx.params;
  const sessionId = await getSessionId();
  await resolveApp(projectId, sessionId);

  const url = new URL(request.url);
  const limitParam = url.searchParams.get("limit");

  const items = await listRecords({
    projectId,
    collection,
    limit: limitParam ? Number(limitParam) : undefined,
    order: url.searchParams.get("order") === "asc" ? "asc" : "desc",
  });

  return NextResponse.json({ records: items });
});

export const POST = route(async (request: Request, ctx: Ctx) => {
  const { projectId, collection } = await ctx.params;
  const sessionId = await getSessionId();
  const { schema } = await resolveApp(projectId, sessionId);

  const record = await createRecord({
    projectId,
    collection,
    schema,
    data: await readJson(request),
  });

  return NextResponse.json({ record }, { status: 201 });
});
