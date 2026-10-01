import { NextResponse } from "next/server";
import { appealSignInUrl } from "../../../../lib/appeals";

export const dynamic = "force-dynamic";

/** Starts "Continue with Discord" so we know the appeal really comes from that account. */
export async function GET(request: Request) {
  const url = await appealSignInUrl(request);
  if (!url) return NextResponse.redirect(new URL("/appeals?error=unavailable", request.url), 303);
  return NextResponse.redirect(url, 303);
}
