import { NextResponse } from "next/server";
import { requirePanel } from "../../../../../lib/admin";
import { liveUnreadTotal } from "../../../../../lib/live-chat";

export const dynamic = "force-dynamic";

/** Unread live messages, for the bubble on the Live Chat tab. */
export async function GET(request: Request) {
  const panel = await requirePanel(request);
  if (panel instanceof NextResponse) return panel;
  const unread = await liveUnreadTotal(panel.discordId).catch(() => null);
  return NextResponse.json({ ok: true, unread }, { headers: { "Cache-Control": "no-store" } });
}
