import { NextResponse } from "next/server";
import { z } from "zod";
import { badRequest, readJson, route } from "@/lib/http";
import { createProject, listProjects } from "@/lib/projects";
import { LIMITS, checkRateLimit, rateLimitKey } from "@/lib/rate-limit";
import { getViewer } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const createBody = z.object({
  title: z.string().min(1).max(120).optional(),
});

export const GET = route(async () => {
  const viewer = await getViewer();
  return NextResponse.json({ projects: await listProjects(viewer) });
});

export const POST = route(async (request: Request) => {
  const viewer = await getViewer();
  checkRateLimit(rateLimitKey("createProject", viewer.sessionId, request), LIMITS.createProject);
  const parsed = createBody.safeParse(await readJson(request));
  if (!parsed.success) throw badRequest("Invalid body", parsed.error.issues);

  const { project } = await createProject({
    title: parsed.data.title?.trim() || "Untitled app",
    viewer,
  });

  return NextResponse.json({ project }, { status: 201 });
});
