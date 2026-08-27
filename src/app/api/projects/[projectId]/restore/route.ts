import { NextResponse } from "next/server";
import { z } from "zod";
import { badRequest } from "@/lib/errors";
import { readJson, route } from "@/lib/http";
import { listVersionSummaries, ownedProject, restoreVersion, toVersionSummary } from "@/lib/projects";
import { getSessionId } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const body = z.object({ versionId: z.uuid() });

export const POST = route(
  async (request: Request, ctx: RouteContext<"/api/projects/[projectId]/restore">) => {
    const { projectId } = await ctx.params;
    const sessionId = await getSessionId();

    // Restoring rewrites what a published link serves, so it stays owner-only.
    await ownedProject(projectId, sessionId);

    const parsed = body.safeParse(await readJson(request));
    if (!parsed.success) throw badRequest("Invalid body", parsed.error.issues);

    const version = await restoreVersion(projectId, parsed.data.versionId);

    return NextResponse.json({
      version: toVersionSummary(version),
      files: version.files,
      schema: version.appSchema,
      versions: await listVersionSummaries(projectId),
    });
  },
);
