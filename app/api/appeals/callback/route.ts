import { NextResponse } from "next/server";
import { AppealError, finishAppealSignIn } from "../../../../lib/appeals";

export const dynamic = "force-dynamic";

/** Discord sends appeal sign-ins back here (via /api/auth/callback/discord). */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state") ?? "";
  if (!code) return NextResponse.redirect(new URL("/appeals?error=cancelled", url.origin), 303);
  try {
    await finishAppealSignIn(request, code, state);
    return NextResponse.redirect(new URL("/appeals", url.origin), 303);
  } catch (error) {
    if (!(error instanceof AppealError)) console.error("Appeal sign-in failed", error);
    return NextResponse.redirect(new URL("/appeals?error=signin", url.origin), 303);
  }
}
