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

  // Admin "view as" is read only: nothing can be changed while it's on (the cookie's signature and
  // the admin are checked by the site itself; here any change is simply refused)
  if (request.cookies.has("kk_view_as") && !SAFE_METHODS.has(request.method) && !VIEW_AS_ALLOWED.some((p) => pathname.startsWith(p))) {
    const message = "You're viewing the site as another member, so changes are turned off. Exit the view to make changes.";
    if ((request.headers.get("accept") ?? "").includes("text/html")) {
      const back = new URL(request.headers.get("referer") ?? "/account", request.url);
      back.searchParams.set("viewas", "read-only");
      return NextResponse.redirect(back, 303);
    }
    return NextResponse.json({ ok: false, error: message }, { status: 403 });
  }

  return NextResponse.next();
}

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
// Switching/exiting the view, and the page-view counter and online count
const VIEW_AS_ALLOWED = ["/api/admin/view-as", "/api/track", "/api/presence", "/api/account/logout"];
