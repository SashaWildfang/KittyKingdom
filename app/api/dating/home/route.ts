import { NextResponse } from "next/server";
import { blockedIds } from "../../../../lib/dating/db";
import { featured } from "../../../../lib/dating/discover";
import { conversations } from "../../../../lib/dating/messages";
import { getProfile, ownProfileData } from "../../../../lib/dating/profiles";
import { requireDating } from "../../../../lib/dating/route-helpers";
import { likesLeftToday, likesReceived, matchesOf } from "../../../../lib/dating/social";

export const dynamic = "force-dynamic";

/** The Dating home: featured member this hour (and the last few), your counts and profile status. */
export async function GET() {
  const me = await requireDating();
  if (me instanceof NextResponse) return me;
  const [doc, now, prev1, prev2, prev3, likes, matches, convs, left, blocked] = await Promise.all([
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
  ]);
  const hide = (f: Awaited<ReturnType<typeof featured>>) => (f && !blocked.has(f.card.id) ? f : null);
  const own = ownProfileData(doc);
  return NextResponse.json(
    {
      ok: true,
      booster: me.booster,
      hasProfile: Boolean(doc),
      needsReview: Boolean(own && !own.reviewConfirmed),
      strength: own?.strength ?? null,
      featured: hide(now),
      recent: [prev1, prev2, prev3].map(hide).filter(Boolean),
      counts: { likes: likes.length, matches: matches.length, unread: convs.unread, requests: convs.requestCount },
      likesLeft: left,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
