import { NextResponse } from "next/server";
import { blockedIds, datingCols, isSnowflake, toLong } from "../../../../../lib/dating/db";
import { compatWith } from "../../../../../lib/dating/discover";
import { profileView } from "../../../../../lib/dating/profiles";
import { requireDating } from "../../../../../lib/dating/route-helpers";
import { friendState, hasLiked, isMatch, likesReceived } from "../../../../../lib/dating/social";

export const dynamic = "force-dynamic";

/** A member's full dating profile, your compatibility and where you two stand. */
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const me = await requireDating();
  if (me instanceof NextResponse) return me;
  if (!isSnowflake(params.id)) return NextResponse.json({ ok: false, error: "Unknown member." }, { status: 404 });
  const blocked = await blockedIds(me.discordId);
  const { profiles, blocks } = await datingCols();
  const doc = await profiles.findOne({ _id: toLong(params.id) } as never);
  const own = params.id === me.discordId;
  const staffPaused = Boolean((doc?.web as { pausedByStaff?: boolean } | undefined)?.pausedByStaff);
  if (!doc || (staffPaused && !own) || (blocked.has(params.id) && !(await blocks.countDocuments({ blocker: me.discordId, blocked: params.id }, { limit: 1 })))) {
    return NextResponse.json({ ok: false, error: "This profile isn't available." }, { status: 404 });
  }
  const [view, compat, iLiked, match, friend, received] = await Promise.all([
    profileView(doc, { viewerIsOwner: own }),
    own ? null : compatWith(me.discordId, params.id),
    own ? false : hasLiked(me.discordId, params.id),
    own ? false : isMatch(me.discordId, params.id),
    own ? "none" : friendState(me.discordId, params.id),
    own ? [] : likesReceived(me.discordId, me.booster),
  ]);
  const theyLike = received.find((l) => l.id === params.id);
  return NextResponse.json(
    {
      ok: true,
      own,
      profile: view,
      compat,
      relation: {
        iLiked,
        // They liked you (only shown when your likes list would show them by name)
        likesMe: Boolean(theyLike && !theyLike.hidden),
        match,
        friend,
        blockedByMe: blocked.has(params.id),
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
