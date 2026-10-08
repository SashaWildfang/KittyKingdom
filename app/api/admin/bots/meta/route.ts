import { NextResponse } from "next/server";
import { requirePanel } from "../../../../../lib/admin";
import { guildPickers } from "../../../../../lib/bot-settings/guild";

export const dynamic = "force-dynamic";

/** Admins: channels, categories and roles for the bot settings pickers. */
export async function GET(request: Request) {
  const panel = await requirePanel(request, "admin");
  if (panel instanceof NextResponse) return panel;
  try {
    return NextResponse.json({ ok: true, ...(await guildPickers()) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Bot settings pickers failed", error);
    return NextResponse.json({ ok: false, error: "Couldn't load channels and roles." }, { status: 500 });
  }
}
