// The website's own store items (cosmetics, perks, Social boosts, seasonal and limited drops).
// Plain data (safe in the browser too); lib/store-catalog.ts puts them in the catalog.

import { COSMETIC_DEFS, ITEM, type CosmeticDef, type Rarity } from "./cosmetics";

export type SiteItem = {
  item_id: string;
  name: string;
  description: string;
  category: "Cosmetics" | "Social" | "Perks";
  price: number;
  rarity: Rarity;
  type: "cosmetic" | "perk" | "consumable" | "booster";
  rotation_type: "permanent" | "seasonal" | "limited";
  stackable?: boolean;
  max_owned?: number;
  quantity?: number;
  duration?: number;
  available_from?: string;
  available_until?: string;
  season?: string;
};

function cosmeticItem(d: CosmeticDef): SiteItem {
  return {
    item_id: d.id,
    name: d.name,
    description: d.desc,
    category: "Cosmetics",
    price: d.price,
    rarity: d.rarity,
    type: "cosmetic",
    rotation_type: d.window ? d.window.kind : "permanent",
    ...(d.window ? { available_from: d.window.from, available_until: d.window.until, season: d.window.season, ...(d.window.quantity ? { quantity: d.window.quantity } : {}) } : {}),
  };
}


export const SITE_ITEMS: SiteItem[] = [
  // ---------- Perks ----------
  { item_id: ITEM.shield, name: "Streak Shield", description: "Miss a day? A shield is used automatically to keep your daily streak alive (one per missed day, up to 3 days). Hold up to 5.", category: "Perks", price: 1200, rarity: "rare", type: "consumable", rotation_type: "permanent", stackable: true, max_owned: 5 },
  { item_id: ITEM.customTitle, name: "Custom Title", description: "Write your own title for your profile card and Social profile, in the color you pick. Change it whenever you like.", category: "Perks", price: 20000, rarity: "legendary", type: "perk", rotation_type: "permanent" },
  { item_id: ITEM.customBadge, name: "Custom Badge", description: "Design a one-of-a-kind badge: pick the icon, shape, color and name. It shows next to your pinned badges. Own up to 3.", category: "Perks", price: 35000, rarity: "legendary", type: "perk", rotation_type: "permanent", stackable: true, max_owned: 3 },

  // ---------- Social boosts ----------
  { item_id: ITEM.superLike, name: "Super Like", description: "Like someone with a star: they're told it's you, and you're shown first in their Likes.", category: "Social", price: 600, rarity: "rare", type: "consumable", rotation_type: "permanent", stackable: true },
  { item_id: ITEM.spotlight, name: "Spotlight (24h)", description: "Put your Social profile at the top of Discover and Browse for 24 hours, with a glowing Spotlight ribbon.", category: "Social", price: 2500, rarity: "epic", type: "booster", rotation_type: "permanent", stackable: true, duration: 86400 },

  // Every cosmetic (frames, banners, name effects, profile effects and themes) comes from lib/cosmetics.ts
  ...COSMETIC_DEFS.map(cosmeticItem),
];

