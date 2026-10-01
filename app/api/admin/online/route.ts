import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../lib/admin";
import { people } from "../../../../lib/admin-people";
import { getPresenceCollection, getUsersCollection } from "../../../../lib/mongodb";
import { ONLINE_WINDOW_MS, sessionsCollection } from "../../../../lib/sessions";
import { accountName } from "../../../../lib/names";
import { describePage, pageDiscordId } from "../../../../lib/page-labels";

export const dynamic = "force-dynamic";

/** Who's signed in and active right now, plus how many guests are browsing. */
export async function GET(request: Request) {
  const admin = await requireAdmin(request);
  if (admin instanceof NextResponse) return admin;
  const since = new Date(Date.now() - ONLINE_WINDOW_MS);
  const [sessions, users, presence] = await Promise.all([sessionsCollection(), getUsersCollection(), getPresenceCollection()]);
  const active = await sessions.find({ lastSeenAt: { $gte: since }, revokedAt: { $exists: false } }).sort({ lastSeenAt: -1 }).limit(200).toArray();
  // Open tabs right now, with the page each one is on
  const tabs = await presence.find({ lastSeen: { $gte: new Date(Date.now() - 75_000) } }).sort({ lastSeen: -1 }).limit(500).toArray();
  // Signed in = an active session, or an open tab that belongs to an account
  const ids = Array.from(new Set([...active.map((s) => String(s.userId)), ...tabs.map((t) => t.userId).filter((id): id is string => Boolean(id && ObjectId.isValid(id)))]));
  const accounts = await users
    .find({ _id: { $in: ids.map((id) => new ObjectId(id)) } }, { projection: { email: 1, username: 1, displayName: 1, discordId: 1 } })
    .toArray();
  const byId = new Map(accounts.map((a) => [String(a._id), a]));
  const who = await people(accounts.map((a) => (a.discordId ? String(a.discordId) : null)));
  const visitors = tabs.length;
  // Names for the people a page is about ("Messaging Snow Paw" instead of the raw id)
  const about = await people(tabs.map((t) => pageDiscordId(t.path)));
  const names = Object.fromEntries(Object.entries(about).map(([id, p]) => [id, p.name]));
  const pageOf = (t: (typeof tabs)[number]) => ({ path: t.path ?? null, title: t.title ?? null, ...describePage(t.path, names), since: (t.pathSince ?? t.lastSeen).toISOString() });
  const guestPages = new Map<string, { label: string; icon: string; path: string | null; n: number }>();
  for (const t of tabs.filter((t) => !t.userId)) {
    const d = describePage(t.path, names);
    const g = guestPages.get(d.label) ?? { ...d, path: t.path ?? null, n: 0 };
    g.n++;
    guestPages.set(d.label, g);
  }

  return NextResponse.json(
    {
      ok: true,
      visitors,
      guests: Array.from(guestPages.values()).sort((a, b) => b.n - a.n),
      users: ids.map((id) => {
        const account = byId.get(id);
        const mine = active.filter((s) => String(s.userId) === id);
        const discordId = account?.discordId ? String(account.discordId) : null;
        return {
          id,
          name: account ? accountName(account, discordId ? who[discordId] : null) : "Unknown",
          username: account?.username ? String(account.username) : null,
          discordId,
          avatar: discordId ? who[discordId]?.avatar ?? null : null,
          lastSeenAt: (mine[0]?.lastSeenAt ?? tabs.find((t) => t.userId === id)?.lastSeen ?? new Date()).toISOString(),
          devices: mine.map((s) => ({ type: s.device.type, label: `${s.device.browser} on ${s.device.os}` })),
          // What they're looking at (their open tabs, newest first)
          pages: tabs.filter((t) => t.userId === id).map(pageOf),
        };
      }),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
