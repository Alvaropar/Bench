import { NextResponse } from "next/server";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const badRequest = (m: string, d?: unknown) => new ApiError(400, m, d);
export const forbidden = (m = "Not your project") => new ApiError(403, m);
export const notFound = (m = "Not found") => new ApiError(404, m);
export const unprocessable = (m: string, d?: unknown) => new ApiError(422, m, d);

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
