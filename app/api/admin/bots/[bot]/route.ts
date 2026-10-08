import { NextResponse } from "next/server";
import { requirePanel } from "../../../../../lib/admin";
import { BotSettingsError, getBotSettings, saveBotSettings } from "../../../../../lib/bot-settings/store";

export const dynamic = "force-dynamic";
const NO_STORE = { "Cache-Control": "no-store" };

function fail(error: unknown) {
  if (error instanceof BotSettingsError) return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
  console.error("Bot settings failed", error);
  return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500 });
}

/** Admins: a bot's settings (defaults merged with saved values) and whether the bot has applied them. */
export async function GET(request: Request, { params }: { params: { bot: string } }) {
  const panel = await requirePanel(request, "admin");
  if (panel instanceof NextResponse) return panel;
  try {
    return NextResponse.json({ ok: true, ...(await getBotSettings(params.bot)) }, { headers: NO_STORE });
  } catch (error) {
    return fail(error);
  }
}

/** Admins: { changes: { key: value | null (reset) }, note? } */
export async function POST(request: Request, { params }: { params: { bot: string } }) {
  const panel = await requirePanel(request, "admin");
  if (panel instanceof NextResponse) return panel;
  try {
    const body = (await request.json().catch(() => ({}))) as { changes?: unknown; note?: unknown };
    if (!body.changes || typeof body.changes !== "object" || Array.isArray(body.changes)) throw new BotSettingsError("Nothing to save.");
    const view = await saveBotSettings(params.bot, body.changes as Record<string, unknown>, panel, typeof body.note === "string" ? body.note : undefined);
    return NextResponse.json({ ok: true, ...view }, { headers: NO_STORE });
  } catch (error) {
    return fail(error);
  }
}
