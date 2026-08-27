import { NextResponse } from "next/server";
import { resolveApp } from "@/lib/app-context";
import { changeToken } from "@/lib/records";
import { route } from "@/lib/http";
import { getViewer } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * A cheap token that changes whenever the project's data does.
 *
 * This is what makes near-live collaboration affordable. Polling the rows
 * themselves at one second would move the whole table over the wire every
 * second per viewer; polling this moves about thirty bytes, and a full refetch
 * happens only when something actually changed.
 *
 * The alternative, a held-open SSE stream, pins a serverless function per
 * viewer and still has to poll the database on the server to notice writes from
 * another instance. Same latency, considerably more cost.
 */
export const GET = route(
  async (_request: Request, ctx: RouteContext<"/api/apps/[projectId]/changes">) => {
    const { projectId } = await ctx.params;
    const viewer = await getViewer();
    await resolveApp(projectId, viewer);

    return NextResponse.json(
      { token: await changeToken(projectId) },
      { headers: { "Cache-Control": "no-store" } },
    );
  },
);
