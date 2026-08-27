import { NextResponse } from "next/server";
import { z } from "zod";
import { resolveApp } from "@/lib/app-context";
import { createAsset } from "@/lib/assets";
import { badRequest } from "@/lib/errors";
import { readJson, route } from "@/lib/http";
import { LIMITS, checkRateLimit, rateLimitKey } from "@/lib/rate-limit";
import { getSessionId } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const body = z.object({
  name: z.string().min(1).max(200),
  mime: z.string().min(1).max(120),
  /** base64 without a data: prefix. */
  data: z.string().min(1).max(2_200_000),
});

export const POST = route(
  async (request: Request, ctx: RouteContext<"/api/apps/[projectId]/assets">) => {
    const { projectId } = await ctx.params;
    const sessionId = await getSessionId();
    checkRateLimit(rateLimitKey("recordWrite", sessionId, request), LIMITS.recordWrite);

    // Uploading follows the same rule as writing a row: allowed for the owner,
    // and for anyone at all once the app is published.
    await resolveApp(projectId, sessionId);

    const parsed = body.safeParse(await readJson(request));
    if (!parsed.success) throw badRequest("Invalid body", parsed.error.issues);

    const asset = await createAsset({ projectId, ...parsed.data });

    return NextResponse.json(
      {
        asset: { id: asset.id, name: asset.name, mime: asset.mime, bytes: asset.bytes },
      },
      { status: 201 },
    );
  },
);
