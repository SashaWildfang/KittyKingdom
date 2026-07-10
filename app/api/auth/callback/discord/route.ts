import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const destination = new URL("/api/auth/discord/callback", url.origin);
  destination.search = url.search;
  return NextResponse.redirect(destination, 307);
}
