import { NextResponse } from "next/server";
import { requirePanel } from "../../../../lib/admin";
import { requireTwoFactorForAction } from "../../../../lib/admin-2fa";
import { LockdownError, getLockdownView, needsTwoFactor, sendLockRequest } from "../../../../lib/lockdown";

export const dynamic = "force-dynamic";

function fail(error: unknown) {
  if (error instanceof LockdownError) return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
  console.error("Lockdown failed", error);
  return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500 });
}

/** Staff: the lockdown, every locked channel, recent history and what you're allowed to do. */
export async function GET(request: Request) {
  const panel = await requirePanel(request, "staff");
  if (panel instanceof NextResponse) return panel;
  try {
    return NextResponse.json({ ok: true, ...(await getLockdownView(panel)) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return fail(error);
  }
}

/** Lock / unlock channels (perms.lock) or start / update / end a lockdown (perms.lockdown; starting and ending need 2FA). */
export async function POST(request: Request) {
  const panel = await requirePanel(request, "staff");
  if (panel instanceof NextResponse) return panel;
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    if (needsTwoFactor(String(body.action))) {
      const no2fa = await requireTwoFactorForAction();
      if (no2fa) return no2fa;
    }
    return NextResponse.json({ ok: true, ...(await sendLockRequest(body, panel)) });
  } catch (error) {
    return fail(error);
  }
}
