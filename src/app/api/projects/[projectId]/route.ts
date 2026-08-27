import { NextResponse } from "next/server";
import { z } from "zod";
import { badRequest, readJson, route } from "@/lib/http";
import {
  authorizeProject,
  getCurrentVersion,
  listVersions,
  ownedProject,
  setPublished,
} from "@/lib/projects";
import { countByCollection } from "@/lib/records";
import { getSessionId } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const patchBody = z.object({ published: z.boolean() });

export const GET = route(
  async (_request: Request, ctx: RouteContext<"/api/projects/[projectId]">) => {
    const { projectId } = await ctx.params;
    const sessionId = await getSessionId();
    const project = await authorizeProject(projectId, sessionId);

    const [version, versionList, counts] = await Promise.all([
      getCurrentVersion(project),
      listVersions(projectId),
      countByCollection(projectId),
    ]);

    return NextResponse.json({
      project,
      version,
      versions: versionList.map(({ files: _files, ...meta }) => meta),
      recordCounts: counts,
      isOwner: project.sessionId === sessionId,
    });
  },
);

export const PATCH = route(
  async (request: Request, ctx: RouteContext<"/api/projects/[projectId]">) => {
    const { projectId } = await ctx.params;
    const sessionId = await getSessionId();
    // Publishing opens the project's data to anyone with the link, so it stays
    // owner-only even though reads and writes afterwards are not.
    await ownedProject(projectId, sessionId);

    const parsed = patchBody.safeParse(await readJson(request));
    if (!parsed.success) throw badRequest("Invalid body", parsed.error.issues);

    return NextResponse.json({ project: await setPublished(projectId, parsed.data.published) });
  },
);
