import { NextResponse } from "next/server";
import { z } from "zod";
import { encodeSSE } from "@/lib/agent/events";
import { runAgent } from "@/lib/agent/run";
import { ApiError, badRequest, notFound } from "@/lib/errors";
import { readJson, route } from "@/lib/http";
import { getCurrentVersion, ownedProject } from "@/lib/projects";
import { getSessionId } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Generation routinely runs past the default 60s ceiling. */
export const maxDuration = 300;

const body = z.object({ message: z.string().min(1).max(4_000) });

export const POST = route(
  async (request: Request, ctx: RouteContext<"/api/projects/[projectId]/generate">) => {
    const { projectId } = await ctx.params;
    const sessionId = await getSessionId();

    // Publishing opens a project's *data*, never its source. Only the owner
    // can put the agent to work on it.
    const project = await ownedProject(projectId, sessionId);

    const parsed = body.safeParse(await readJson(request));
    if (!parsed.success) throw badRequest("Invalid body", parsed.error.issues);

    const version = await getCurrentVersion(project);
    if (!version) throw notFound("Project has no version yet");

    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const event of runAgent({
            project,
            version,
            userMessage: parsed.data.message,
          })) {
            controller.enqueue(encoder.encode(encodeSSE(event)));
          }
        } catch (error) {
          // The run has already started streaming, so a failure cannot become
          // an HTTP status — it has to arrive as a terminal event instead.
          const message =
            error instanceof ApiError || error instanceof Error
              ? error.message
              : "Generation failed";
          console.error("Generation failed:", error);
          controller.enqueue(encoder.encode(encodeSSE({ type: "error", message })));
        } finally {
          controller.close();
        }
      },
    });

    return new NextResponse(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        // Disables proxy buffering, without which events arrive in one batch.
        "X-Accel-Buffering": "no",
      },
    });
  },
);
