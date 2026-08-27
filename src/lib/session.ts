import { cookies } from "next/headers";

export const SESSION_COOKIE = "bench_sid";

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax",
  path: "/",
  maxAge: 60 * 60 * 24 * 365,
  secure: process.env.NODE_ENV === "production",
} as const;

/**
 * Anonymous ownership token, minted by `src/proxy.ts` on first request.
 *
 * Deliberately not signed: the cookie value *is* the secret (an unguessable
 * UUID), so an HMAC would only protect against forgery of a value that grants
 * nothing but ownership of projects created under it. Real auth is a separate
 * concern this demo does not need.
 */
export async function getSessionId(): Promise<string> {
  const store = await cookies();
  const value = store.get(SESSION_COOKIE)?.value;
  if (!value) {
    throw new Error("Session cookie missing — is src/proxy.ts running?");
  }
  return value;
}
