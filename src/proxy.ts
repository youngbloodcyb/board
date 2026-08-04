import { getSessionCookie } from "better-auth/cookies";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export function proxy(request: NextRequest) {
  const sessionCookie = request.cookies.get("better-auth.session_token");
  const loginUrl = new URL("/login", request.url);

  if (!sessionCookie) {
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|login|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)",
  ],
};
