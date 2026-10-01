// Destructive admin actions (deleting, removing, resetting, banning) need the admin's own account to
// have two-factor authentication turned on. Checked on the server for every such action.

import { NextResponse } from "next/server";
import { getRealUser } from "./auth";

export const NEEDS_2FA_MESSAGE = "Turn on two-factor authentication first (My Account → Security). It's required for deleting, removing, resetting and banning.";

/** Null when the signed-in admin has two-factor on, otherwise a ready-made 403 response. */
export async function requireTwoFactorForAction(): Promise<NextResponse | null> {
  const real = await getRealUser().catch(() => null);
  if (real?.twoFactor?.enabled) return null;
  return NextResponse.json({ ok: false, error: NEEDS_2FA_MESSAGE, code: "needs-2fa" }, { status: 403 });
}
