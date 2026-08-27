import { getAsset, rendersInline } from "@/lib/assets";
import { route } from "@/lib/http";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Serves an uploaded file by id.
 *
 * Deliberately not project-scoped: the id is an unguessable UUID acting as a
 * capability, which is what lets a generated app render an image with a plain
 * <img src> without ever being handed its project id. Writes stay authorised on
 * the upload route.
 */
export const GET = route(
  async (_request: Request, ctx: RouteContext<"/api/assets/[assetId]">) => {
    const { assetId } = await ctx.params;
    const asset = await getAsset(assetId);

    const body = Buffer.from(asset.data, "base64");
    const inline = rendersInline(asset.mime);
    const filename = asset.name.replace(/["\\r\n]/g, "");

    return new NextResponse(body, {
      headers: {
        "Content-Type": asset.mime,
        "Content-Length": String(body.length),
        // Anything that is not a known-safe image is downloaded rather than
        // rendered, and nothing is ever content-sniffed.
        "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${filename}"`,
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  },
);
