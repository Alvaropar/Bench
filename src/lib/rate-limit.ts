import { ApiError } from "@/lib/errors";

/**
 * In-memory sliding-window rate limiting.
 *
 * Deliberately not Redis. On serverless each instance keeps its own counters,
 * so the real ceiling is roughly (limit x instances) — this is a cost guard and
 * an abuse speed bump, not a security control. For a demo whose public link is
 * writable by anyone, that tradeoff is the right one: a shared store would add
 * an external dependency and a failure mode for protection nobody is trying
 * hard to defeat. Swapping in Upstash later means changing only this file.
 */

const windows = new Map<string, number[]>();

/** Bounds memory if a lot of distinct keys show up. */
const MAX_TRACKED_KEYS = 10_000;

export interface Limit {
  /** Requests allowed per window. */
  limit: number;
  windowMs: number;
  /** Used in the error message so the caller knows what they hit. */
  label: string;
}

export const LIMITS = {
  /** Generation costs real money, so this is the tight one. */
  generate: { limit: 8, windowMs: 15 * 60_000, label: "generations" },
  createProject: { limit: 20, windowMs: 60 * 60_000, label: "new apps" },
  /** Writes from inside generated apps, including published ones. */
  recordWrite: { limit: 120, windowMs: 60_000, label: "changes" },
} as const satisfies Record<string, Limit>;

function prune() {
  if (windows.size <= MAX_TRACKED_KEYS) return;
  // Cheapest useful eviction: drop everything and let the windows refill. The
  // alternative is tracking access order for a limiter that is already
  // approximate per instance.
  windows.clear();
}

export function checkRateLimit(key: string, limit: Limit): void {
  const now = Date.now();
  const cutoff = now - limit.windowMs;

  const hits = (windows.get(key) ?? []).filter((time) => time > cutoff);

  if (hits.length >= limit.limit) {
    const oldest = hits[0];
    const retryAfterSeconds = Math.max(1, Math.ceil((oldest + limit.windowMs - now) / 1000));
    throw new ApiError(
      429,
      `Rate limit reached: ${limit.limit} ${limit.label} per ${Math.round(
        limit.windowMs / 60_000,
      )} minutes. Try again in ${formatDuration(retryAfterSeconds)}.`,
    );
  }

  hits.push(now);
  windows.set(key, hits);
  prune();
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  return `${Math.ceil(seconds / 60)} min`;
}

/**
 * Rate-limit key.
 *
 * Sessions are cheap to mint by clearing a cookie, so the client address is
 * folded in as well. Behind a proxy that is the first x-forwarded-for entry.
 */
export function rateLimitKey(scope: string, sessionId: string, request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const address = forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "local";
  return `${scope}:${sessionId}:${address}`;
}
