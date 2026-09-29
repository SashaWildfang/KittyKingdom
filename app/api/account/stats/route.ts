import { NextResponse } from "next/server";
import { getCurrentUser, getViewAs } from "../../../../lib/auth";
import { computeBadges, type BadgeShowcase } from "../../../../lib/badges";
import { badgeHistory, recordBadges } from "../../../../lib/badge-history";
import { siteContext } from "../../../../lib/badge-site";
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
    const viewing = Boolean(await getViewAs());
    // Counts toward the Stat Nerd badge (the page refreshes itself, so only fresh opens count)
    if (!viewing && new URL(request.url).searchParams.get("open") === "1") {
      await (await getUsersCollection()).updateOne({ _id: user._id }, { $inc: { statsViews: 1 } }).catch(() => undefined);
      user.statsViews = (typeof user.statsViews === "number" ? user.statsViews : 0) + 1;
    }
    const stats = await memberStats(String(user.discordId), requestTimeZone(request));
    const badges = computeBadges(stats, await siteContext(user));

    // Keep the saved showcase's tiers current (and drop anything no longer earned)
    const tiers = new Map(badges.map((b) => [b.id, b.tier]));
    const saved = (user.badgeShowcase ?? { pinned: [], title: null }) as BadgeShowcase;
    const showcase: BadgeShowcase = {
      pinned: (saved.pinned ?? []).filter((p) => (tiers.get(p.id) ?? 0) > 0).map((p) => ({ id: p.id, tier: tiers.get(p.id)! })),
      title: saved.title && (tiers.get(saved.title.id) ?? 0) > 0 ? { id: saved.title.id, tier: tiers.get(saved.title.id)! } : null,
    };
    if (JSON.stringify(showcase) !== JSON.stringify({ pinned: saved.pinned ?? [], title: saved.title ?? null }) && !viewing) {
      await (await getUsersCollection()).updateOne({ _id: user._id }, { $set: { badgeShowcase: showcase } }).catch(() => undefined);
    }
    // When each badge was earned (an admin viewing as the member only reads it)
    const history = viewing ? await badgeHistory(String(user.discordId)) : await recordBadges(String(user.discordId), badges).catch(() => badgeHistory(String(user.discordId)));
    return NextResponse.json({ ok: true, stats, badges, showcase, history }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Member stats failed", error);
    return NextResponse.json({ ok: false, error: "Your stats couldn't be loaded right now." }, { status: 500 });
  }
}
