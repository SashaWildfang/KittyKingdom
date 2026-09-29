import { NextResponse } from "next/server";
import { setSession } from "../../../../../lib/auth";
import { clearRegistrationCookie, registrationState } from "../../../../../lib/registration";

export const dynamic = "force-dynamic";

/**
 * Where this browser's sign-up stands; finishes the account as soon as Discord is linked. The email
 * was confirmed before linking, so finishing also signs them in on this browser.
 */
export async function GET(request: Request) {
  const { finished, userId, ...state } = await registrationState(new URL(request.url).origin);
  if (finished && userId) {
    await setSession(userId);
    await clearRegistrationCookie();
  }
  return NextResponse.json({ ok: true, ...state }, { headers: { "Cache-Control": "no-store" } });
}
