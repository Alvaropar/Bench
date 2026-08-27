import { NextResponse } from "next/server";
import { resolveApp } from "@/lib/app-context";
import { route } from "@/lib/http";
import { countByCollection } from "@/lib/records";
import { getSessionId } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Lets the data view and the generated app discover their own shape. */
export const GET = route(
  async (_request: Request, ctx: RouteContext<"/api/apps/[projectId]/schema">) => {
    const { projectId } = await ctx.params;
    const sessionId = await getSessionId();
    const { project, schema } = await resolveApp(projectId, sessionId);

    return NextResponse.json({
      schema,
      recordCounts: await countByCollection(project.id),
    });
  },
);
