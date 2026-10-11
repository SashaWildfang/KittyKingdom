import { NextResponse } from "next/server";
import { requirePanel } from "../../../../../lib/admin";
import { people } from "../../../../../lib/admin-people";
import { automodActivity } from "../../../../../lib/automod";
import { getGuildChannelsRaw } from "../../../../../lib/discord-member";
import { requestTimeZone } from "../../../../../lib/timezone";

export const dynamic = "force-dynamic";

/** What AutoMod caught: totals, a chart, top rules/members/channels/words and the latest detections. */
export async function GET(request: Request) {
  const panel = await requirePanel(request);
  if (panel instanceof NextResponse) return panel;
  const p = new URL(request.url).searchParams;
  const data = await automodActivity({
    range: p.get("range") ?? "7d",
    timeZone: requestTimeZone(request),
    rule: p.get("rule"),
    userId: p.get("member"),
    channelId: p.get("channel"),
    action: p.get("action"),
    from: p.get("from"),
    to: p.get("to"),
    page: Number(p.get("page")) || 0,
  });
  const [who, channels] = await Promise.all([
    people([...data.members.map((m: { id: string }) => m.id), ...data.rows.map((r) => r.userId)]).catch(() => ({})),
    getGuildChannelsRaw().catch(() => []),
  ]);
  const wanted = new Set([...data.byChannel.map((c: { id: string }) => c.id), ...data.rows.map((r) => r.channelId).filter(Boolean)]);
  const channelNames = Object.fromEntries(channels.filter((c) => wanted.has(c.id)).map((c) => [c.id, c.name]));
  return NextResponse.json({ ok: true, ...data, people: who, channelNames }, { headers: { "Cache-Control": "no-store" } });
}
