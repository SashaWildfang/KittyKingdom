import { NextResponse } from "next/server";
import { requirePanel } from "../../../../../lib/admin";
import { requireTwoFactorForAction } from "../../../../../lib/admin-2fa";
import { requestApply } from "../../../../../lib/season-store";

export const dynamic = "force-dynamic";

/** Admins with 2FA: ask the Main Bot to apply the live season in Discord right away. */
export async function POST(request: Request) {
  const panel = await requirePanel(request, "admin");
  if (panel instanceof NextResponse) return panel;
  const twoFactor = await requireTwoFactorForAction();
  if (twoFactor) return twoFactor;
  try {
    await requestApply(panel.discordId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Season apply failed", error);
    return NextResponse.json({ ok: false, error: "Couldn't reach the database." }, { status: 500 });
  }
}
