import { NextResponse } from "next/server";
import { blockedIds } from "../../../../lib/dating/db";
import { cardsFor, featured, homeWidgets } from "../../../../lib/dating/discover";
import { datingCols, toLong } from "../../../../lib/dating/db";
import { conversations } from "../../../../lib/dating/messages";
import { getProfile, ownProfileData } from "../../../../lib/dating/profiles";
import { requireDating } from "../../../../lib/dating/route-helpers";
import { viewStats } from "../../../../lib/dating/views";
import { partnersOf } from "../../../../lib/dating/partners";
import { people } from "../../../../lib/admin-people";
import { friendsOf, likesLeftToday, likesReceived, matchesOf } from "../../../../lib/dating/social";

export const dynamic = "force-dynamic";

/** The Dating home: featured member this hour (and the last few), your counts and profile status. */
export async function GET() {
  const me = await requireDating();
  if (me instanceof NextResponse) return me;
  const cols = await datingCols();
  const [doc, now, prev1, prev2, prev3, likes, matches, convs, left, blocked, widgets, friends, matchesThisWeek, views, partnerLinks] = await Promise.all([
    getProfile(me.discordId),
    featured(0),
    featured(1),
    featured(2),
    featured(3),
    likesReceived(me.discordId, me.booster),
    matchesOf(me.discordId),
    conversations(me.discordId),
    likesLeftToday(me.discordId, me.booster),
    blockedIds(me.discordId),
    homeWidgets(me.discordId),
    friendsOf(me.discordId),
    cols.matches.countDocuments({ matched_at: { $gte: new Date(Date.now() - 7 * 86_400_000) } }),
    viewStats(me.discordId, me.discordId).catch(() => null),
    partnersOf(me.discordId).catch(() => []),
  ]);
  const partnerAsks = partnerLinks.filter((p) => p.status === "received");
  const askWho = partnerAsks.length ? await people(partnerAsks.map((p) => p.id)).catch(() => ({}) as Awaited<ReturnType<typeof people>>) : {};
  // Their dating name when they have a profile, else their Discord name
  const askNames = new Map(
    partnerAsks.length ? (await cols.profiles.find({ _id: { $in: partnerAsks.map((p) => toLong(p.id)) } } as never, { projection: { name: 1 } }).toArray()).map((d) => [String(d._id), String(d.name ?? "")]) : [],
  );
  const chats = convs.inbox.slice(0, 4);
  const chatCards = await cardsFor(me.discordId, [...chats.map((c) => c.other), me.discordId]);
  const self = chatCards.find((c) => c.id === me.discordId);
  const hide = (f: Awaited<ReturnType<typeof featured>>) => (f && !blocked.has(f.card.id) ? f : null);
  const own = ownProfileData(doc);
  return NextResponse.json(
    {
      ok: true,
      booster: me.booster,
      me: { name: self?.name ?? me.name, photo: self?.photo ?? null, accent: self?.accent ?? "#f59b2a" },
      hasProfile: Boolean(doc),
      needsReview: Boolean(own && !own.reviewConfirmed),
      strength: own?.strength ?? null,
      featured: hide(now),
      recent: [prev1, prev2, prev3].map(hide).filter(Boolean),
      counts: {
        likes: likes.length,
        matches: matches.length,
        unread: convs.unread,
        requests: convs.requestCount,
        friends: friends.filter((f) => f.status === "friends").length,
        friendRequests: friends.filter((f) => f.status === "received").length,
        views: views?.total ?? 0,
        viewsThisWeek: views?.week ?? 0,
      },
      partnerRequests: partnerAsks.map((p) => ({ id: p.id, name: askNames.get(p.id) || askWho[p.id]?.name || "A member" })),
      ...widgets,
      community: { ...widgets.community, matchesThisWeek },
      recentChats: chats.map((c) => {
        const p = chatCards.find((x) => x.id === c.other);
        return { other: c.other, name: p?.name ?? "Member", photo: p?.photo ?? null, accent: p?.accent ?? "#888", lastText: c.lastText, lastFromMe: c.lastFromMe, lastAt: c.lastAt, unread: c.unread };
      }),
      likesLeft: left,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
