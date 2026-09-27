import { NextResponse } from "next/server";
import { requirePanel } from "../../../../lib/admin";
import { people } from "../../../../lib/admin-people";
import { resolveMentions } from "../../../../lib/discord-mentions";
import { liveSnapshot } from "../../../../lib/live-chat";

export const dynamic = "force-dynamic";
export const maxDuration = 10;

/** One poll of Admin -> Live Chat (staff and admins; only channels they can see in Discord). */
export async function GET(request: Request) {
  const panel = await requirePanel(request);
  if (panel instanceof NextResponse) return panel;
  try {
    const p = new URL(request.url).searchParams;
    const valid = (v: string | null) => (v && !Number.isNaN(Date.parse(v)) ? v : null);
    const channel = p.get("channel");
    const snapshot = await liveSnapshot(panel.discordId, {
      afterTs: valid(p.get("after")),
      since: valid(p.get("since")),
      channelId: channel && /^\d{15,21}$/.test(channel) ? channel : null,
      limit: Number(p.get("limit") ?? 80),
    });
    // Names for @mentions, #channels and @roles in the messages
    const texts = [...snapshot.messages, ...snapshot.changed].map((m) => m.content).filter((t) => t.includes("<"));
    const { mentions, userIds } = texts.length ? await resolveMentions(texts) : { mentions: { channels: {}, roles: {} }, userIds: [] as string[] };
    const who = userIds.length ? await people(userIds) : {};
    return NextResponse.json({ ok: true, ...snapshot, mentions, people: who }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Live chat poll failed", error);
    return NextResponse.json({ ok: false, error: "Couldn't load live chat." }, { status: 500 });
  }
}
