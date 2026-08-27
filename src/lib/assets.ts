import { eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { assets } from "@/db/schema";
import type { Asset } from "@/db/schema";
import { notFound, unprocessable } from "@/lib/errors";

/**
 * Uploads from inside generated apps.
 *
 * Served from Bench's own origin, so the mime allowlist is a real security
 * boundary, not a convenience: an uploaded .html would otherwise be stored XSS
 * against this origin. Images render inline; everything else is forced to
 * download, and nothing is ever content-sniffed.
 */

export const MAX_ASSET_BYTES = 1_500_000;
export const MAX_PROJECT_ASSET_BYTES = 40_000_000;

const INLINE_MIMES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]);

const ATTACHMENT_MIMES = new Set([
  "application/pdf",
  "text/plain",
  "text/csv",
  "application/json",
  "application/zip",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

/**
 * SVG is deliberately absent. It is an image everywhere else and a script
 * container here, and serving one inline from this origin would be an XSS.
 */
export function isAllowedMime(mime: string): boolean {
  return INLINE_MIMES.has(mime) || ATTACHMENT_MIMES.has(mime);
}

export function rendersInline(mime: string): boolean {
  return INLINE_MIMES.has(mime);
}

export const ALLOWED_MIMES = [...INLINE_MIMES, ...ATTACHMENT_MIMES];

export async function createAsset(input: {
  projectId: string;
  name: string;
  mime: string;
  /** base64, without a data: prefix. */
  data: string;
}): Promise<Asset> {
  if (!isAllowedMime(input.mime)) {
    throw unprocessable(
      `Unsupported file type "${input.mime}". Allowed: ${ALLOWED_MIMES.join(", ")}.`,
    );
  }

  const bytes = Math.floor((input.data.length * 3) / 4);
  if (bytes > MAX_ASSET_BYTES) {
    throw unprocessable(
      `File is ${(bytes / 1_000_000).toFixed(1)}MB, over the ${MAX_ASSET_BYTES / 1_000_000}MB limit.`,
    );
  }

  const db = getDb();
  const [used] = await db
    .select({ total: sql<number>`coalesce(sum(${assets.bytes}), 0)` })
    .from(assets)
    .where(eq(assets.projectId, input.projectId));

  if (Number(used?.total ?? 0) + bytes > MAX_PROJECT_ASSET_BYTES) {
    throw unprocessable(
      `This app has used its ${MAX_PROJECT_ASSET_BYTES / 1_000_000}MB of file storage.`,
    );
  }

  const [asset] = await db
    .insert(assets)
    .values({
      projectId: input.projectId,
      name: input.name.slice(0, 200),
      mime: input.mime,
      bytes,
      data: input.data,
    })
    .returning();

  return asset;
}

export async function getAsset(assetId: string): Promise<Asset> {
  const [asset] = await getDb().select().from(assets).where(eq(assets.id, assetId)).limit(1);
  if (!asset) throw notFound("File not found");
  return asset;
}
