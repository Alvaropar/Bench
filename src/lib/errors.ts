/**
 * Framework-free error types.
 *
 * Data-access modules throw these; only `lib/http.ts` knows how to turn them
 * into responses. Keeps `next/server` out of code that scripts and tests import.
 */
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
export const misconfigured = (m: string) => new ApiError(503, m);
