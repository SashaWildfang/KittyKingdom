import { NextResponse } from "next/server";
import { requirePanel } from "../../../../lib/admin";
import { getGuildRoles } from "../../../../lib/discord-member";
import { AnnouncementError, announceChannels, cancelOrDelete, listAnnouncements, saveAnnouncement } from "../../../../lib/announcements";
import { audit } from "../../../../lib/news-admin";

export const dynamic = "force-dynamic";

/** Admins: announcements, plus the channels and roles to pick from. */
export async function GET(request: Request) {
  const panel = await requirePanel(request, "admin");
  if (panel instanceof NextResponse) return panel;
  const [items, channels, roles] = await Promise.all([listAnnouncements(), announceChannels().catch(() => []), getGuildRoles().catch(() => new Map())]);
  const pingable = Array.from(roles.values())
    .filter((r) => !r.managed && r.name !== "@everyone")
    .sort((a, b) => b.position - a.position)
    .map((r) => ({ id: r.id, name: r.name, color: r.colors?.[0] ?? null }));
  return NextResponse.json({ ok: true, items, channels, roles: pingable }, { headers: { "Cache-Control": "no-store" } });
}

/** Admins: {op: "save", id?, channelId, content, embed, ping, sendAt?, now?} · {op: "delete", id, fromDiscord?} */
export async function POST(request: Request) {
  const panel = await requirePanel(request, "admin");
  if (panel instanceof NextResponse) return panel;
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    if (body.op === "save") {
      const item = await saveAnnouncement(panel, body);
      if (item.status === "sent" || item.status === "scheduled") await audit(item.status === "sent" ? "announcement-sent" : "announcement-scheduled", { announcementId: item.id, channelId: item.channelId, ping: item.ping, sendAt: item.sendAt }, panel).catch(() => undefined);
      return NextResponse.json({ ok: true, item });
    }
    if (body.op === "delete") {
      await cancelOrDelete(panel, String(body.id ?? ""), Boolean(body.fromDiscord));
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ ok: false, error: "Nothing to change." }, { status: 400 });
  } catch (error) {
    if (error instanceof AnnouncementError) return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    console.error("Announcement failed", error);
    return NextResponse.json({ ok: false, error: "That didn't work. Try again." }, { status: 500 });
  }
}
