import { NextResponse } from "next/server";
import { requirePanel } from "../../../../../lib/admin";
import { BotSettingsError, botSettingsLog, revertChange } from "../../../../../lib/bot-settings/store";

export const dynamic = "force-dynamic";

/** Admins: the change log for bot and server settings (?bot=&key=&page=). */
export async function GET(request: Request) {
  const panel = await requirePanel(request, "admin");
  if (panel instanceof NextResponse) return panel;
  const url = new URL(request.url);
  try {
    const data = await botSettingsLog({ bot: url.searchParams.get("bot") || undefined, key: url.searchParams.get("key") || undefined, page: Number(url.searchParams.get("page") ?? 1) });
    return NextResponse.json({ ok: true, ...data }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Bot settings log failed", error);
    return NextResponse.json({ ok: false, error: "Couldn't load the change log." }, { status: 500 });
  }
}

/** Admins: { revert: logId } puts that setting back to what it was before the change. */
export async function POST(request: Request) {
  const panel = await requirePanel(request, "admin");
  if (panel instanceof NextResponse) return panel;
  try {
    const body = (await request.json().catch(() => ({}))) as { revert?: unknown };
    await revertChange(String(body.revert ?? ""), panel);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof BotSettingsError) return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    return NextResponse.json({ ok: false, error: "Couldn't undo that." }, { status: 500 });
  }
}
