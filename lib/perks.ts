// Supporter perks: Patreon tiers and Nitro booster perks. Mirrors the bots' db/perks.py (Economy and
// Main_Bot), which pay the monthly Leaves and items, set multipliers and run custom roles, so change both.

export const PATREON_URL = "https://www.patreon.com/c/thekittykingdom/membership";
export const NITRO_ROLE_ID = "1360260086500561237";

export type TierKey = "knight" | "noble" | "monarch";
export type MonthlyItem = { id: "streak_shield" | "booster_balance"; name: string; count: number };

export type Tier = {
  key: TierKey;
  name: string;
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
};

const shield = (count: number): MonthlyItem => ({ id: "streak_shield", name: count === 1 ? "Streak Shield" : "Streak Shields", count });

/** Lowest to highest */
export const TIERS: Tier[] = [
  {
    key: "knight", name: "Acorn Knight", emoji: "🌰", price: 5, roleId: "1362102163693633818", color: "#b7793f",
    tagline: "A big boost to everything you earn.",
    monthly: 3000, xp: 0.25, leaf: 0.1, weight: 1.5, daily: 75, items: [shield(1)],
    customRole: false, roleExtras: false, premiumGames: false,
  },
  {
    key: "noble", name: "Maple Noble", emoji: "🍁", price: 10, roleId: "1362502662721114245", color: "#e8622c",
    tagline: "Your own custom role, and the premium games.",
    monthly: 7500, xp: 0.5, leaf: 0.2, weight: 2, daily: 150, items: [shield(2)],
    customRole: true, roleExtras: false, premiumGames: true,
  },
  {
    key: "monarch", name: "Harvest Monarch", emoji: "👑", price: 20, roleId: "1362502871639396362", color: "#f5b83d",
    tagline: "Everything, maxed out: rule the kingdom.",
    monthly: 20000, xp: 1, leaf: 0.35, weight: 3, daily: 300, items: [shield(3), { id: "booster_balance", name: "2x Leaf Booster (24h)", count: 1 }],
    customRole: true, roleExtras: true, premiumGames: true,
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

export function tierFromRoles(roleIds: string[] | null | undefined): Tier | null {
  const ids = new Set(roleIds ?? []);
  return [...TIERS].reverse().find((t) => ids.has(t.roleId)) ?? null;
}

export function isNitroRoles(roleIds: string[] | null | undefined) {
  return Boolean(roleIds?.includes(NITRO_ROLE_ID));
}

/** 25 slot spins at once and the premium scratch-offs: Nitro boosters and Maple Noble and up. */
export function hasPremiumGames(roleIds: string[] | null | undefined) {
  return isNitroRoles(roleIds) || Boolean(tierFromRoles(roleIds)?.premiumGames);
}

/** Extra Leaves on every Daily Reward from the Patreon tier. */
export function dailyBonusFromRoles(roleIds: string[] | null | undefined) {
  return tierFromRoles(roleIds)?.daily ?? 0;
}

export const pct = (n: number) => `+${Math.round(n * 100)}%`;
export const itemsLabel = (items: MonthlyItem[]) => items.map((i) => `${i.count} ${i.name}`).join(" + ");
