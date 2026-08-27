import { NextResponse } from "next/server";
import { ApiError, badRequest } from "@/lib/errors";

export * from "@/lib/errors";

/**
 * Wraps a route handler so thrown ApiErrors become clean JSON.
 *
 * Validation failures come back as `{ error, details: string[] }` with field
 * paths intact — the self-healing loop feeds those strings straight back to the
 * agent, so their legibility is a feature, not just developer comfort.
 */
export function route<Args extends unknown[]>(
  handler: (...args: Args) => Promise<NextResponse>,
) {
  return async (...args: Args): Promise<NextResponse> => {
    try {
      return await handler(...args);
    } catch (error) {
      if (error instanceof ApiError) {
        return NextResponse.json(
          { error: error.message, details: error.details },
          { status: error.status },
        );
      }
      console.error("Unhandled route error:", error);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
  };
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw badRequest("Request body must be valid JSON");
  }
}
