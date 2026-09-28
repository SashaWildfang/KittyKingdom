import { NextResponse } from "next/server";
import { requirePanel } from "../../../../../lib/admin";
import { automodUnread, markAutomodSeen } from "../../../../../lib/automod";

export const dynamic = "force-dynamic";

/** New AutoMod catches since you last looked, for the bubble on the AutoMod tab. */
export async function GET(request: Request) {
  const panel = await requirePanel(request);
  if (panel instanceof NextResponse) return panel;
  const unread = await automodUnread(panel.discordId).catch(() => null);
  return NextResponse.json({ ok: true, unread }, { headers: { "Cache-Control": "no-store" } });
}

/** Marks everything caught so far as seen (the AutoMod tab does this while it's open). */
export async function POST(request: Request) {
  const panel = await requirePanel(request);
  if (panel instanceof NextResponse) return panel;
  await markAutomodSeen(panel.discordId).catch(() => undefined);
  return NextResponse.json({ ok: true });
}
