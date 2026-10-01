import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  // Appeal sign-ins share this registered redirect; everything else is account linking
  const appeal = url.searchParams.get("state")?.startsWith("appeal.");
  const destination = new URL(appeal ? "/api/appeals/callback" : "/api/auth/discord/callback", url.origin);
  destination.search = url.search;
  return NextResponse.redirect(destination, 307);
}
