// Supporter perks: Patreon tiers and Nitro booster perks. Mirrors the bots' db/perks.py (Economy and
// Main_Bot), which pay the monthly Leaves and items, set multipliers and run custom roles, so change both.

export const PATREON_URL = "https://www.patreon.com/c/thekittykingdom/membership";
export const NITRO_ROLE_ID = "1360260086500561237";

export type TierKey = "knight" | "noble" | "monarch";
export type MonthlyItem = { id: "streak_shield" | "booster_balance"; name: string; count: number };

export type Tier = {
  key: TierKey;
  /** "King / Queen" */
  name: string;
  /** [first title, second title]: each has its own Discord role "<title> (Patreon)" with the same perks */
  titles: [string, string];
  emoji: string;
  price: number;
  roleId: string;
  color: string;
  tagline: string;
  monthly: number;
  xp: number;
  leaf: number;
  weight: number;
  daily: number;
  items: MonthlyItem[];
  customRole: boolean;
  roleExtras: boolean;
  premiumGames: boolean;
  /** Weekly Royal Chest (/chest) Leaves, plus items */
  chest: number;
  chestItems: string[];
  /** Daily Royal Wheel (/wheel) Leaf prize multiplier */
  wheelMult: number;
  /** Store discount (0.05 = 5% off) */
  discount: number;
};

const shield = (count: number): MonthlyItem => ({ id: "streak_shield", name: count === 1 ? "Streak Shield" : "Streak Shields", count });

/** Lowest to highest */
export const TIERS: Tier[] = [
  {
    key: "knight", name: "Duke / Duchess", titles: ["Duke", "Duchess"], emoji: "🌰", price: 5, roleId: "1362102163693633818", color: "#b7793f",
    tagline: "A big boost to everything you earn.",
    monthly: 3000, xp: 0.25, leaf: 0.1, weight: 1.5, daily: 75, items: [shield(1)],
    customRole: false, roleExtras: false, premiumGames: false,
    chest: 750, chestItems: [], wheelMult: 1, discount: 0.05,
  },
  {
    key: "noble", name: "Prince / Princess", titles: ["Prince", "Princess"], emoji: "🍁", price: 10, roleId: "1362502662721114245", color: "#e8622c",
    tagline: "Your own custom role, and the premium games.",
    monthly: 7500, xp: 0.5, leaf: 0.2, weight: 2, daily: 150, items: [shield(2)],
    customRole: true, roleExtras: false, premiumGames: true,
    chest: 1750, chestItems: [], wheelMult: 1.5, discount: 0.1,
  },
  {
    key: "monarch", name: "King / Queen", titles: ["King", "Queen"], emoji: "👑", price: 20, roleId: "1362502871639396362", color: "#f5b83d",
    tagline: "Everything, maxed out: rule the kingdom.",
    monthly: 20000, xp: 1, leaf: 0.35, weight: 3, daily: 300, items: [shield(3), { id: "booster_balance", name: "2x Leaf Booster (24h)", count: 1 }],
    customRole: true, roleExtras: true, premiumGames: true,
    chest: 4000, chestItems: ["2x XP Booster (24h)"], wheelMult: 2, discount: 0.15,
  },
];

export const NITRO = {
  name: "Nitro Booster",
  emoji: "💎",
  color: "#ff73fa",
  monthly: 3000,
  perBoost: 2500,
  xp: 0.2,
  leaf: 0.2,
  weight: 1,
  items: [shield(1)],
};

/** Average Leaves a single Royal Wheel spin pays before the tier multiplier (matches the bots' WHEEL table) */
export const WHEEL_AVERAGE = 242;
export const ROLE_SUFFIX = " (Patreon)";

/**
 * Pass member roles through lib/tier-roles.ts (withTierAliases) first: the second-title roles (Queen,
 * Princess, Duchess) are created by the bot, so their ids aren't known here.
 */
export function tierFromRoles(roleIds: string[] | null | undefined): Tier | null {
  const ids = new Set(roleIds ?? []);
  return [...TIERS].reverse().find((t) => ids.has(t.roleId)) ?? null;
}

export function isNitroRoles(roleIds: string[] | null | undefined) {
  return Boolean(roleIds?.includes(NITRO_ROLE_ID));
}

/** 25 slot spins at once and the premium scratch-offs: Nitro boosters and Prince / Princess and up. */
export function hasPremiumGames(roleIds: string[] | null | undefined) {
  return isNitroRoles(roleIds) || Boolean(tierFromRoles(roleIds)?.premiumGames);
}

/** Extra Leaves on every Daily Reward from the Patreon tier. */
export function dailyBonusFromRoles(roleIds: string[] | null | undefined) {
  return tierFromRoles(roleIds)?.daily ?? 0;
}

export const pct = (n: number) => `+${Math.round(n * 100)}%`;
export const itemsLabel = (items: MonthlyItem[]) => items.map((i) => `${i.count} ${i.name}`).join(" + ");

export function storeDiscountFromRoles(roleIds: string[] | null | undefined) {
  return tierFromRoles(roleIds)?.discount ?? 0;
}
