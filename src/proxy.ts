import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, SESSION_COOKIE_OPTIONS } from "@/lib/session";

export function proxy(request: NextRequest) {
  if (request.cookies.get(SESSION_COOKIE)?.value) {
    return NextResponse.next();
  }

  const sessionId = crypto.randomUUID();

  // Set it on the *request* too, so the very first render already sees it
  // instead of having to wait for the browser's next round trip.
  request.cookies.set(SESSION_COOKIE, sessionId);
  const response = NextResponse.next({ request });
  response.cookies.set(SESSION_COOKIE, sessionId, SESSION_COOKIE_OPTIONS);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
