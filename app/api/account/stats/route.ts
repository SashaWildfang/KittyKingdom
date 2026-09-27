import { NextResponse } from "next/server";
import { getCurrentUser, getViewAs } from "../../../../lib/auth";
import { computeBadges, type BadgeShowcase } from "../../../../lib/badges";
import { getUsersCollection } from "../../../../lib/mongodb";
import { memberStats } from "../../../../lib/member-stats";
import { requestTimeZone } from "../../../../lib/timezone";

export const dynamic = "force-dynamic";
export const maxDuration = 20;

/** The signed-in member's own stats (My Account → My stats). */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Sign in to see your stats." }, { status: 401 });
  if (!user.discordId) return NextResponse.json({ ok: false, error: "Link your Discord account to see your stats." }, { status: 403 });
  try {
    const stats = await memberStats(String(user.discordId), requestTimeZone(request));
    const badges = computeBadges(stats);

    // Keep the saved showcase's tiers current (and drop anything no longer earned)
    const tiers = new Map(badges.map((b) => [b.id, b.tier]));
    const saved = (user.badgeShowcase ?? { pinned: [], title: null }) as BadgeShowcase;
    const showcase: BadgeShowcase = {
      pinned: (saved.pinned ?? []).filter((p) => (tiers.get(p.id) ?? 0) > 0).map((p) => ({ id: p.id, tier: tiers.get(p.id)! })),
      title: saved.title && (tiers.get(saved.title.id) ?? 0) > 0 ? { id: saved.title.id, tier: tiers.get(saved.title.id)! } : null,
    };
    if (JSON.stringify(showcase) !== JSON.stringify({ pinned: saved.pinned ?? [], title: saved.title ?? null }) && !(await getViewAs())) {
      await (await getUsersCollection()).updateOne({ _id: user._id }, { $set: { badgeShowcase: showcase } }).catch(() => undefined);
    }
    return NextResponse.json({ ok: true, stats, badges, showcase }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Member stats failed", error);
    return NextResponse.json({ ok: false, error: "Your stats couldn't be loaded right now." }, { status: 500 });
  }
}
