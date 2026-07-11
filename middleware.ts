import { NextResponse, type NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (
    pathname.includes("/api/auth/callback/discord]") ||
    pathname.includes("/api/auth/callback/discord%5D")
  ) {
    const fixed = new URL("/api/auth/callback/discord", request.url);
    fixed.search = search;
    return NextResponse.redirect(fixed, 307);
  }

  return NextResponse.next();
}
