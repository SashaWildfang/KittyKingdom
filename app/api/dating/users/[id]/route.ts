import { NextResponse } from "next/server";
import { blockedIds, datingCols, isSnowflake, toLong } from "../../../../../lib/dating/db";
import { compatWith } from "../../../../../lib/dating/discover";
import { getProfile, profileView } from "../../../../../lib/dating/profiles";
import { recordView, viewStats } from "../../../../../lib/dating/views";
import { getSettings } from "../../../../../lib/dating/settings";
import { confirmedPartners } from "../../../../../lib/dating/partners";
import { getCurrentBans } from "../../../../../lib/moderation";
import { requireDating } from "../../../../../lib/dating/route-helpers";
import { friendState, hasLiked, isMatch, likesReceived, passedIds } from "../../../../../lib/dating/social";

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
  const banned = !own && Boolean((await getCurrentBans().catch(() => null))?.has(params.id));
  const staffPaused = Boolean((doc?.web as { pausedByStaff?: boolean } | undefined)?.pausedByStaff);
  if (!doc || banned || (staffPaused && !own) || (blocked.has(params.id) && !(await blocks.countDocuments({ blocker: me.discordId, blocked: params.id }, { limit: 1 })))) {
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
  // Let them know someone looked (unless you browse anonymously or they turned it off)
  // Never while an admin is viewing the site as someone (they'd appear to have looked)
  if (!own && !me.readOnly) await recordView(me.discordId, params.id, String((await getProfile(me.discordId))?.name ?? me.name)).catch(() => undefined);
  const views = await viewStats(params.id, me.discordId).catch(() => null);
  // Linked, confirmed partners: they're together, so "not a dating fit" never applies between them
  const partnered = !own && (await confirmedPartners(me.discordId).catch(() => [] as string[])).includes(params.id);
  // They can hide their view count (you still see whether they viewed you)
  if (views && !own && (await getSettings(params.id)).showViewCount === false) views.total = -1;
  return NextResponse.json(
    {
      ok: true,
      own,
      profile: view,
      compat: compat && partnered ? { ...compat, blocked: null, partnered: true } : compat,
      views,
      relation: {
        iLiked,
        // They liked you (everyone sees their likes now)
        likesMe: Boolean(theyLike),
        match,
        friend,
        blockedByMe: blocked.has(params.id),
        passed: own ? false : (await passedIds(me.discordId)).has(params.id),
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
