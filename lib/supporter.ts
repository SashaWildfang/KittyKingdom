// Supporter perks on My Account: which Patreon tier / Nitro perks a member has, and their custom role.
//
// Custom roles work like a queue shared with the main bot (Main_Bot events/custom_roles.py): the website
// saves the wanted design in zeo_bot.custom_roles with a bumped `version`, and the bot applies it in Discord
// within a few seconds, then marks `appliedVersion` (or saves an `error`).

import { getAutomodConfig } from "./automod";
import { Matcher } from "./automod-engine";
import { getGuildRoles, getMemberRoleIds } from "./discord-member";
import { getBotCollection } from "./mongodb";
import { NITRO, isNitroRoles, tierFromRoles, type TierKey } from "./perks";
import { withTierAliases } from "./tier-roles";

export class SupporterError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

export type RoleStyle = "solid" | "gradient" | "holographic";

export type CustomRole = {
  name: string;
  style: RoleStyle;
  color: string;
  color2: string | null;
  icon: string | null;
  status: "pending" | "applied" | "paused" | "error";
  error: string | null;
};

export type SupporterStatus = {
  inServer: boolean;
  tier: TierKey | null;
  nitro: boolean;
  monthly: number;
  nextChargeDate: string | null;
  patronSince: string | null;
  canCustomRole: boolean;
  canExtras: boolean;
  customRole: CustomRole | null;
  /** 0 = King / Prince / Duke, 1 = Queen / Princess / Duchess */
  variant: 0 | 1;
  /** True while the bot is switching their title role */
  titlePending: boolean;
};

const HEX = /^#?([0-9a-f]{6})$/i;
const RESERVED = ["admin", "administrator", "mod", "moderator", "staff", "owner", "helper", "everyone", "here", "discord", "kitty kingdom", "bot"];
// One emoji (with optional skin tone / variation selector / ZWJ sequence)
const EMOJI = new RegExp("^(\\p{Extended_Pictographic}|\\p{Regional_Indicator}{2})(\\p{Emoji_Modifier}|\\uFE0F|\\u200D(\\p{Extended_Pictographic}|\\uFE0F|\\p{Emoji_Modifier}))*$", "u");

async function roleCol() {
  return getBotCollection("custom_roles");
}

function toRole(doc: Record<string, unknown> | null): CustomRole | null {
  if (!doc) return null;
  const pending = doc.version !== doc.appliedVersion;
  return {
    name: String(doc.name ?? ""),
    style: (["solid", "gradient", "holographic"].includes(String(doc.style)) ? doc.style : "solid") as RoleStyle,
    color: String(doc.color ?? "#E8622C"),
    color2: doc.color2 ? String(doc.color2) : null,
    icon: doc.icon ? String(doc.icon) : null,
    status: pending ? "pending" : ((["applied", "paused", "error"].includes(String(doc.status)) ? doc.status : "pending") as CustomRole["status"]),
    error: !pending && doc.error ? String(doc.error) : null,
  };
}

export async function supporterStatus(discordId: string): Promise<SupporterStatus> {
  const roles = await withTierAliases(await getMemberRoleIds(discordId).catch(() => null));
  const tier = tierFromRoles(roles);
  const nitro = isNitroRoles(roles);
  const [roleDoc, patron, pref] = await Promise.all([
    (await roleCol()).findOne({ _id: discordId } as never).catch(() => null),
    (await getBotCollection("patreon_members")).findOne({ discordId, tier: { $ne: null } }).catch(() => null),
    (await getBotCollection("supporter_prefs")).findOne({ _id: discordId } as never).catch(() => null),
  ]);
  return {
    inServer: roles !== null,
    tier: tier?.key ?? null,
    nitro,
    monthly: (tier?.monthly ?? 0) + (nitro ? NITRO.monthly : 0),
    nextChargeDate: patron?.nextChargeDate ? String(patron.nextChargeDate) : null,
    patronSince: patron?.since ? String(patron.since) : null,
    canCustomRole: Boolean(tier?.customRole),
    canExtras: Boolean(tier?.roleExtras),
    customRole: toRole(roleDoc as Record<string, unknown> | null),
    variant: pref?.variant === 1 ? 1 : 0,
    titlePending: Boolean(pref && pref.version !== pref.appliedVersion),
  };
}

function hex(value: unknown, field: string) {
  const m = HEX.exec(String(value ?? "").trim());
  if (!m) throw new SupporterError(`Pick a valid ${field}.`);
  return `#${m[1].toUpperCase()}`;
}

/** Saves a custom role design; the bot applies it in Discord within a few seconds. */
export async function saveCustomRole(discordId: string, input: Record<string, unknown>) {
  const roles = await withTierAliases(await getMemberRoleIds(discordId));
  if (!roles) throw new SupporterError("You need to be in the Discord server to have a custom role.", 403);
  const tier = tierFromRoles(roles);
  if (!tier?.customRole) throw new SupporterError("Custom roles are a perk for Prince / Princess ($10) and King / Queen ($20) supporters.", 403);

  const name = String(input.name ?? "").replace(/\s+/g, " ").trim();
  if (name.length < 1 || name.length > 32) throw new SupporterError("Role names must be 1 to 32 characters.");
  const low = name.toLowerCase();
  if (RESERVED.some((r) => new RegExp(`\\b${r}\\b`).test(low))) throw new SupporterError("That name is reserved (it looks like a staff or server role).");
  const cfg = await getAutomodConfig().catch(() => null);
  if (cfg && new Matcher(cfg.words, cfg.allow).find(name)) throw new SupporterError("That name isn't allowed. Please pick something else.");

  const existing = (await (await roleCol()).findOne({ _id: discordId } as never)) as Record<string, unknown> | null;
  const guildRoles = await getGuildRoles().catch(() => new Map());
  for (const r of Array.from(guildRoles.values())) {
    if (r.name.toLowerCase() === low && r.id !== String(existing?.roleId ?? "")) throw new SupporterError("Another role already has that name.");
  }

  const style = String(input.style ?? "solid") as RoleStyle;
  if (!["solid", "gradient", "holographic"].includes(style)) throw new SupporterError("Pick a role style.");
  if (style === "holographic" && !tier.roleExtras) throw new SupporterError("The holographic style is a King / Queen perk.", 403);
  const color = hex(input.color, "color");
  const color2 = style === "gradient" ? hex(input.color2, "second color") : null;

  let icon: string | null = String(input.icon ?? "").trim() || null;
  if (icon) {
    if (!tier.roleExtras) throw new SupporterError("Role icons are a King / Queen perk.", 403);
    if (icon.length > 16 || !EMOJI.test(icon)) throw new SupporterError("The icon must be a single standard emoji, like 🦊.");
  }

  await (await roleCol()).updateOne(
    { _id: discordId } as never,
    {
      $set: { name, style, color, color2, icon, status: "pending", error: null, updatedAt: new Date(), updatedVia: "website" },
      $inc: { version: 1 },
      $setOnInsert: { appliedVersion: 0, roleId: null },
    },
    { upsert: true },
  );
  return supporterStatus(discordId);
}

/** Choose King / Prince / Duke (0) or Queen / Princess / Duchess (1). The bot switches the role within seconds. */
export async function saveTitle(discordId: string, rawVariant: unknown) {
  const variant = Number(rawVariant) === 1 ? 1 : 0;
  await (await getBotCollection("supporter_prefs")).updateOne(
    { _id: discordId } as never,
    { $set: { variant, updatedAt: new Date(), updatedVia: "website" }, $inc: { version: 1 }, $setOnInsert: { appliedVersion: 0 } },
    { upsert: true },
  );
  return supporterStatus(discordId);
}
