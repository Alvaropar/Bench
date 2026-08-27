import { NextResponse } from "next/server";
import { z } from "zod";
import { validateFileMap } from "@/lib/agent/contract";
import { getViewer } from "@/lib/auth";
import { badRequest, notFound, unprocessable } from "@/lib/errors";
import { readJson, route } from "@/lib/http";
import {
  commitVersion,
  getCurrentVersion,
  listVersionSummaries,
  ownedProject,
  toVersionSummary,
} from "@/lib/projects";
import { LIMITS, checkRateLimit, rateLimitKey } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const body = z.object({
  files: z.record(z.string(), z.string()),
  label: z.string().max(120).optional(),
});

/**
 * Saves a hand edit as a new version.
 *
 * Runs the same file validation the agent's write_file tool does, so an edit
 * cannot leave the project in a state the agent could not have produced -- and
 * the schema is carried forward untouched, since editing code is not a reason
 * to disturb the data model or the rows filed under it.
 */
export const POST = route(
  async (request: Request, ctx: RouteContext<"/api/projects/[projectId]/files">) => {
    const { projectId } = await ctx.params;
    const viewer = await getViewer();
    checkRateLimit(rateLimitKey("recordWrite", viewer.sessionId, request), LIMITS.recordWrite);

    const project = await ownedProject(projectId, viewer);

    const parsed = body.safeParse(await readJson(request));
    if (!parsed.success) throw badRequest("Invalid body", parsed.error.issues);

    const problem = validateFileMap(parsed.data.files);
    if (problem) throw unprocessable(problem);

    const current = await getCurrentVersion(project);
    if (!current) throw notFound("Project has no version yet");

    const version = await commitVersion({
      projectId,
      parentId: current.id,
      files: parsed.data.files,
      appSchema: current.appSchema,
      label: parsed.data.label ?? "Edited by hand",
    });

    return NextResponse.json({
      version: toVersionSummary(version),
      files: version.files,
      schema: version.appSchema,
      versions: await listVersionSummaries(projectId),
    });
  },
);
