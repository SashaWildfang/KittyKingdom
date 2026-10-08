import { NextResponse } from "next/server";
import { requirePanel } from "../../../../../lib/admin";
import { requireTwoFactorForAction } from "../../../../../lib/admin-2fa";
import { guildSettings, updateGuildSettings } from "../../../../../lib/bot-settings/guild";
import { BotSettingsError } from "../../../../../lib/bot-settings/store";

export const dynamic = "force-dynamic";
const NO_STORE = { "Cache-Control": "no-store" };

function fail(error: unknown) {
  if (error instanceof BotSettingsError) return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
  console.error("Server settings failed", error);
  return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500 });
}

/** Admins: the Discord server's settings and overview. */
export async function GET(request: Request) {
  const panel = await requirePanel(request, "admin");
  if (panel instanceof NextResponse) return panel;
  try {
    return NextResponse.json({ ok: true, ...(await guildSettings()) }, { headers: NO_STORE });
  } catch (error) {
    return fail(error);
  }
}

/** Admins with 2FA on: { changes: {...}, reason } changes the Discord server's settings. */
export async function POST(request: Request) {
  const panel = await requirePanel(request, "admin");
  if (panel instanceof NextResponse) return panel;
  const twoFactor = await requireTwoFactorForAction();
  if (twoFactor) return twoFactor;
  try {
    const body = (await request.json().catch(() => ({}))) as { changes?: unknown; reason?: unknown };
    if (!body.changes || typeof body.changes !== "object") throw new BotSettingsError("Nothing to save.");
    await updateGuildSettings(body.changes as Record<string, unknown>, panel, typeof body.reason === "string" ? body.reason.slice(0, 200) : "");
    return NextResponse.json({ ok: true, ...(await guildSettings()) }, { headers: NO_STORE });
  } catch (error) {
    return fail(error);
  }
}
