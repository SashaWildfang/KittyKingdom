// The website-side facts the website badges need, from the member's site account.
import type { Document } from "mongodb";
import type { SiteContext } from "./badges";
import { sessionsCollection } from "./sessions";

export async function siteContext(user: Document): Promise<SiteContext> {
  const signIns = await (await sessionsCollection()).countDocuments({ userId: user._id }).catch(() => 0);
  const socials = user.socials && typeof user.socials === "object" ? Object.values(user.socials as Record<string, unknown>).filter(Boolean).length : 0;
  const showcase = (user.badgeShowcase ?? {}) as { pinned?: unknown[]; title?: unknown };
  return {
    accountCreated: user.createdAt instanceof Date ? user.createdAt.toISOString() : null,
    emailVerified: user.emailVerified === true,
    twoFactor: Boolean(user.twoFactor?.enabled),
    socials,
    statsViews: typeof user.statsViews === "number" ? user.statsViews : 0,
    signIns,
    pinned: Array.isArray(showcase.pinned) ? showcase.pinned.length : 0,
    hasTitle: Boolean(showcase.title),
  };
}
