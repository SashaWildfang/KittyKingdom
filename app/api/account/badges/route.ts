import { NextResponse } from "next/server";
import { getCurrentUser, getSessionUserId } from "../../../../lib/auth";
import { MAX_SHOWCASE, computeBadges, type BadgeShowcase } from "../../../../lib/badges";
import { memberStats } from "../../../../lib/member-stats";
import { siteContext } from "../../../../lib/badge-site";
import { getUsersCollection } from "../../../../lib/mongodb";
import { requestTimeZone } from "../../../../lib/timezone";

export const dynamic = "force-dynamic";
export const maxDuration = 20;

/** { pinned: string[] (up to 3), title: string | null }: badges to show on the profile card. Only earned badges count. */
export async function POST(request: Request) {
  const userId = await getSessionUserId();
  const user = await getCurrentUser();
  if (!userId || !user) return NextResponse.json({ ok: false, error: "Sign in to change your badges." }, { status: 401 });
  if (!user.discordId) return NextResponse.json({ ok: false, error: "Link your Discord account first." }, { status: 403 });
  const body = (await request.json().catch(() => ({}))) as { pinned?: unknown; title?: unknown };
  const wanted = Array.isArray(body.pinned) ? Array.from(new Set(body.pinned.filter((x): x is string => typeof x === "string"))) : [];
  if (wanted.length > MAX_SHOWCASE) return NextResponse.json({ ok: false, error: `You can pin up to ${MAX_SHOWCASE} badges.` }, { status: 400 });

  const badges = computeBadges(await memberStats(String(user.discordId), requestTimeZone(request)), await siteContext(user));
  const earned = new Map(badges.filter((b) => b.tier > 0).map((b) => [b.id, b.tier]));
  const pinned = wanted.filter((id) => earned.has(id)).map((id) => ({ id, tier: earned.get(id)! }));
  if (pinned.length !== wanted.length) return NextResponse.json({ ok: false, error: "You can only pin badges you've earned." }, { status: 400 });
  const titleId = typeof body.title === "string" && body.title ? body.title : null;
  if (titleId && !earned.has(titleId)) return NextResponse.json({ ok: false, error: "You can only use an earned badge as your title." }, { status: 400 });

  const showcase: BadgeShowcase = { pinned, title: titleId ? { id: titleId, tier: earned.get(titleId)! } : null };
  await (await getUsersCollection()).updateOne({ _id: userId }, { $set: { badgeShowcase: showcase, updatedAt: new Date() } });
  return NextResponse.json({ ok: true, showcase });
}
