// The website-side facts the website badges need, from the member's site account.
import { Long, type Document } from "mongodb";
import type { SiteContext } from "./badges";
import { getBotCollection } from "./mongodb";
import { sessionsCollection } from "./sessions";

// Social links and gaming tags on their Social profile (the account page no longer has social links)
const SOCIAL_KEYS = ["twitter", "telegram", "furaffinity", "instagram", "steam", "nintendo_switch", "xbox", "playstation"];

async function socialLinkCount(user: Document) {
  const old = user.socials && typeof user.socials === "object" ? Object.values(user.socials as Record<string, unknown>).filter(Boolean).length : 0;
  if (!user.discordId || !/^\d{15,21}$/.test(String(user.discordId))) return old;
  const id = String(user.discordId);
  const profile = await (await getBotCollection("dating_profiles"))
    .findOne({ _id: { $in: [Long.fromString(id), id] } } as Document, { projection: Object.fromEntries(SOCIAL_KEYS.map((k) => [k, 1])) })
    .catch(() => null);
  const count = profile ? SOCIAL_KEYS.filter((k) => typeof profile[k] === "string" && profile[k].trim()).length : 0;
  return Math.max(old, count);
}

export async function siteContext(user: Document): Promise<SiteContext> {
  const signIns = await (await sessionsCollection()).countDocuments({ userId: user._id }).catch(() => 0);
  const socials = await socialLinkCount(user).catch(() => 0);
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
