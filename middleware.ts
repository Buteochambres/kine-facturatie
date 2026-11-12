import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, isValidSessionToken } from "@/lib/auth";

export const config = {
  matcher: ["/((?!_next|favicon.ico).*)"],
};

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isPublicPage = pathname === "/login";
  const isPublicApi = pathname === "/api/login";

  if (isPublicPage || isPublicApi) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const valid = await isValidSessionToken(token);

  if (!valid) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Niet ingelogd." }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}
