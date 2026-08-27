import { NextResponse } from "next/server";
import { z } from "zod";
import { badRequest, readJson, route } from "@/lib/http";
import { createProject, listProjects } from "@/lib/projects";
import { getSessionId } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const createBody = z.object({
  title: z.string().min(1).max(120).optional(),
});

export const GET = route(async () => {
  const sessionId = await getSessionId();
  return NextResponse.json({ projects: await listProjects(sessionId) });
});

export const POST = route(async (request: Request) => {
  const sessionId = await getSessionId();
  const parsed = createBody.safeParse(await readJson(request));
  if (!parsed.success) throw badRequest("Invalid body", parsed.error.issues);

  const { project } = await createProject({
    title: parsed.data.title?.trim() || "Untitled app",
    sessionId,
  });

  return NextResponse.json({ project }, { status: 201 });
});
