// A member's boosts in one place: Store boosters running right now, the XP and leaf multipliers they
// earn at (the same rules the bots use) and their weight and odds in Social's hourly Featured draw.

import { Long } from "mongodb";
import { getMemberRoleIds } from "./discord-member";
import { featuredOdds } from "./dating/discover";
import { getBotCollection } from "./mongodb";

const BOOSTER_ROLE = "1360260086500561237";
const PATREON = [
  { id: "1362502871639396362", name: "Legendary Neko", xp: 0.4, weight: 2.5 },
  { id: "1362502662721114245", name: "Kitten Guardian", xp: 0.2, weight: 2.0 },
  { id: "1362102163693633818", name: "Royal Kitten", xp: 0.1, weight: 1.5 },
];
const RETIRED = ["booster_crab"];
const WHAT: Record<string, string> = {
  booster_xp: "Doubles the XP you earn",
  booster_balance: "Doubles the leaves you earn",
  booster_profile: "Doubles your weight in Social's Featured draw",
  booster_spotlight: "Puts your Social profile at the top of Discover and Browse",
};

const num = (v: unknown) => (typeof v === "number" ? v : typeof v === "bigint" ? Number(v) : v instanceof Long ? v.toNumber() : Number(v ?? 0) || 0);
const round = (n: number) => Math.round(n * 100) / 100;

export type Part = { label: string; value: string };

export async function boostStatus(discordId: string) {
  const now = new Date();
  const [boostersCol, users, globals] = await Promise.all([getBotCollection("temporary_boosters"), getBotCollection("users"), getBotCollection("globals")]);
  const [running, user, global, roles, social] = await Promise.all([
    boostersCol.find({ discordId, end_time: { $gt: now }, item_id: { $nin: RETIRED } }).sort({ end_time: 1 }).toArray(),
    users.findOne({ discordId: { $in: [Long.fromString(discordId), discordId] } } as never, { projection: { xpMultiplier: 1, multiplier: 1 }, useBigInt64: true }),
    globals.findOne({ isXpWeekend: { $exists: true } }).then((g) => g ?? globals.findOne({})),
    getMemberRoleIds(discordId).catch(() => null),
    featuredOdds(discordId).catch(() => null),
  ]);
  const has = new Set(running.map((b) => String(b.item_id)));
  const roleSet = new Set(roles ?? []);
  const booster = roleSet.has(BOOSTER_ROLE);
  const patreon = PATREON.find((p) => roleSet.has(p.id)) ?? null;
  const weekend = num(global?.isXpWeekend) === 1;

  // Earnings: the role multipliers the economy bot keeps on your record, then ×2 for each running booster
  const roleXp = num(user?.xpMultiplier) || 1;
  const roleLeaf = num(user?.multiplier) || 1;
  const xpParts: Part[] = [{ label: "Base", value: "1×" }];
  if (booster) xpParts.push({ label: "Server booster", value: "+0.15" });
  if (patreon) xpParts.push({ label: patreon.name, value: `+${patreon.xp}` });
  if (weekend) xpParts.push({ label: "XP weekend", value: "×2" });
  if (has.has("booster_xp")) xpParts.push({ label: "XP Booster", value: "×2" });
  const leafParts: Part[] = [{ label: "Base", value: "1×" }];
  if (booster) leafParts.push({ label: "Server booster", value: "+0.15" });
  if (has.has("booster_balance")) leafParts.push({ label: "Leaf Booster", value: "×2" });

  // Featured weight: base 1, +1 as a server booster, + your Patreon tier, ×2 with a Profile Booster
  let weightParts: Part[] = [{ label: "Base", value: "1" }];
  if (booster) weightParts.push({ label: "Server booster", value: "+1" });
  if (patreon) weightParts.push({ label: patreon.name, value: `+${patreon.weight}` });
  // The bot saves the role weight on the profile; if the roles we can see don't add up to it, show what's saved
  const expected = 1 + (booster ? 1 : 0) + (patreon?.weight ?? 0);
  if (social?.hasProfile && Math.abs(social.roleWeight - expected) > 0.01) weightParts = [{ label: "From your roles", value: String(round(social.roleWeight)) }];
  if (social?.hasProfile && social.profileBooster) weightParts.push({ label: "Profile Booster", value: "×2" });

  return {
    boosters: running.map((b) => ({
      id: String(b.item_id),
      name: String(b.item_name ?? "Booster"),
      what: WHAT[String(b.item_id)] ?? null,
      startedAt: b.start_time instanceof Date ? b.start_time.toISOString() : null,
      endsAt: (b.end_time as Date).toISOString(),
    })),
    xp: { total: round(roleXp * (weekend ? 2 : 1) * (has.has("booster_xp") ? 2 : 1)), parts: xpParts },
    leaves: { total: round(roleLeaf * (has.has("booster_balance") ? 2 : 1)), parts: leafParts },
    roles: { serverBooster: booster, patreon: patreon?.name ?? null },
    social: social?.hasProfile ? { ...social, weightParts } : { hasProfile: false as const },
  };
}

export type BoostStatus = Awaited<ReturnType<typeof boostStatus>>;
