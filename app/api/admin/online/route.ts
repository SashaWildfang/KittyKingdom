import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../lib/admin";
import { people } from "../../../../lib/admin-people";
import { getPresenceCollection, getUsersCollection } from "../../../../lib/mongodb";
import { ONLINE_WINDOW_MS, sessionsCollection } from "../../../../lib/sessions";

export const dynamic = "force-dynamic";

/** Who's signed in and active right now, plus how many guests are browsing. */
export async function GET(request: Request) {
  const admin = await requireAdmin(request);
  if (admin instanceof NextResponse) return admin;
  const since = new Date(Date.now() - ONLINE_WINDOW_MS);
  const [sessions, users, presence] = await Promise.all([sessionsCollection(), getUsersCollection(), getPresenceCollection()]);
  const active = await sessions.find({ lastSeenAt: { $gte: since }, revokedAt: { $exists: false } }).sort({ lastSeenAt: -1 }).limit(200).toArray();
  const ids = Array.from(new Set(active.map((s) => String(s.userId))));
  const accounts = await users
    .find({ _id: { $in: active.map((s) => s.userId) } }, { projection: { email: 1, username: 1, displayName: 1, discordId: 1 } })
    .toArray();
  const byId = new Map(accounts.map((a) => [String(a._id), a]));
  const who = await people(accounts.map((a) => (a.discordId ? String(a.discordId) : null)));
  const visitors = await presence.countDocuments({ lastSeen: { $gte: new Date(Date.now() - 75_000) } });

  return NextResponse.json(
    {
      ok: true,
      visitors,
      users: ids.map((id) => {
        const account = byId.get(id);
        const mine = active.filter((s) => String(s.userId) === id);
        const discordId = account?.discordId ? String(account.discordId) : null;
        return {
          id,
          name: String(account?.displayName ?? account?.username ?? account?.email ?? "Unknown"),
          username: account?.username ? String(account.username) : null,
          discordId,
          avatar: discordId ? who[discordId]?.avatar ?? null : null,
          lastSeenAt: mine[0].lastSeenAt.toISOString(),
          devices: mine.map((s) => ({ type: s.device.type, label: `${s.device.browser} on ${s.device.os}` })),
        };
      }),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
