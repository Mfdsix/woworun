import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const SESSION_COOKIE = "wl_session";

function isProtected(pathname: string): boolean {
  return (
    pathname === "/" ||
    pathname === "/connect" ||
    pathname.startsWith("/connect/") ||
    pathname === "/settings" ||
    pathname.startsWith("/settings/")
  );
}

export function middleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;
  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);

  if (pathname === "/unlock") {
    if (hasSession) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  if (isProtected(pathname) && !hasSession) {
    return NextResponse.redirect(new URL("/unlock", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/unlock", "/connect/:path*", "/settings/:path*"],
};
