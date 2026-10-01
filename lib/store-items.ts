// The website's own store items (cosmetics, perks, Social boosts, seasonal and limited drops).
// Plain data (safe in the browser too); lib/store-catalog.ts puts them in the catalog.

import { ITEM, type Rarity } from "./cosmetics";

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

const HALLOWEEN = { available_from: "2026-10-01T00:00:00Z", available_until: "2026-11-03T00:00:00Z", season: "Halloween 2026" };

export const SITE_ITEMS: SiteItem[] = [
  // ---------- Perks ----------
  { item_id: ITEM.shield, name: "Streak Shield", description: "Miss a day? A shield is used automatically to keep your daily streak alive (one per missed day, up to 3 days). Hold up to 5.", category: "Perks", price: 1200, rarity: "rare", type: "consumable", rotation_type: "permanent", stackable: true, max_owned: 5 },
  { item_id: ITEM.customTitle, name: "Custom Title", description: "Write your own title for your profile card and Social profile, in the color you pick. Change it whenever you like.", category: "Perks", price: 20000, rarity: "legendary", type: "perk", rotation_type: "permanent" },
  { item_id: ITEM.customBadge, name: "Custom Badge", description: "Design a one-of-a-kind badge: pick the icon, shape, color and name. It shows next to your pinned badges. Own up to 3.", category: "Perks", price: 35000, rarity: "legendary", type: "perk", rotation_type: "permanent", stackable: true, max_owned: 3 },

  // ---------- Social boosts ----------
  { item_id: ITEM.superLike, name: "Super Like", description: "Like someone with a star: they're told it's you, and you're shown first in their Likes.", category: "Social", price: 600, rarity: "rare", type: "consumable", rotation_type: "permanent", stackable: true },
  { item_id: ITEM.spotlight, name: "Spotlight (24h)", description: "Put your Social profile at the top of Discover and Browse for 24 hours, with a glowing Spotlight ribbon.", category: "Social", price: 2500, rarity: "epic", type: "booster", rotation_type: "permanent", stackable: true, duration: 86400 },

  // ---------- Avatar frames ----------
  { item_id: "frame_ember", name: "Ember Ring", description: "A warm ring of firelight that slowly turns around your avatar.", category: "Cosmetics", price: 3000, rarity: "rare", type: "cosmetic", rotation_type: "permanent" },
  { item_id: "frame_sakura", name: "Sakura", description: "Soft pink blossoms framing your avatar.", category: "Cosmetics", price: 4000, rarity: "rare", type: "cosmetic", rotation_type: "permanent" },
  { item_id: "frame_neon", name: "Neon Pulse", description: "A pink and cyan neon ring that breathes with light.", category: "Cosmetics", price: 5000, rarity: "rare", type: "cosmetic", rotation_type: "permanent" },
  { item_id: "frame_aurora", name: "Aurora", description: "Shifting greens and violets of the northern lights.", category: "Cosmetics", price: 8000, rarity: "epic", type: "cosmetic", rotation_type: "permanent" },
  { item_id: "frame_gold", name: "Royal Gold", description: "Polished gold with a light that sweeps across it.", category: "Cosmetics", price: 12000, rarity: "epic", type: "cosmetic", rotation_type: "permanent" },
  { item_id: "frame_galaxy", name: "Galaxy", description: "A spinning ring of stars and nebula.", category: "Cosmetics", price: 25000, rarity: "legendary", type: "cosmetic", rotation_type: "permanent" },

  // ---------- Card banners ----------
  { item_id: "banner_candy", name: "Cotton Candy", description: "Pastel pink and blue clouds behind your profile card.", category: "Cosmetics", price: 1500, rarity: "common", type: "cosmetic", rotation_type: "permanent" },
  { item_id: "banner_autumn", name: "Autumn Canopy", description: "Golden fall leaves drifting behind your profile card.", category: "Cosmetics", price: 3500, rarity: "rare", type: "cosmetic", rotation_type: "permanent" },
  { item_id: "banner_sunset", name: "Sunset Drive", description: "A retro sunset glow behind your profile card.", category: "Cosmetics", price: 4500, rarity: "rare", type: "cosmetic", rotation_type: "permanent" },
  { item_id: "banner_ocean", name: "Deep Ocean", description: "Gently rolling deep-sea blues behind your profile card.", category: "Cosmetics", price: 4500, rarity: "rare", type: "cosmetic", rotation_type: "permanent" },
  { item_id: "banner_starry", name: "Starry Night", description: "A twinkling night sky behind your profile card.", category: "Cosmetics", price: 9000, rarity: "epic", type: "cosmetic", rotation_type: "permanent" },
  { item_id: "banner_aurora", name: "Northern Lights", description: "Living ribbons of aurora flowing behind your profile card.", category: "Cosmetics", price: 20000, rarity: "legendary", type: "cosmetic", rotation_type: "permanent" },

  // ---------- Name effects ----------
  { item_id: "name_frost", name: "Frostbite", description: "Your name in icy blue with a frosty glint.", category: "Cosmetics", price: 5000, rarity: "rare", type: "cosmetic", rotation_type: "permanent" },
  { item_id: "name_gold", name: "Gilded", description: "Your name in shimmering gold.", category: "Cosmetics", price: 7500, rarity: "epic", type: "cosmetic", rotation_type: "permanent" },
  { item_id: "name_fire", name: "Inferno", description: "Your name burning in flickering flame colors.", category: "Cosmetics", price: 10000, rarity: "epic", type: "cosmetic", rotation_type: "permanent" },
  { item_id: "name_rainbow", name: "Prism", description: "Your name flowing through every color.", category: "Cosmetics", price: 18000, rarity: "legendary", type: "cosmetic", rotation_type: "permanent" },
  { item_id: "name_glitch", name: "Glitch", description: "Your name flickering like a broken screen.", category: "Cosmetics", price: 22000, rarity: "legendary", type: "cosmetic", rotation_type: "permanent" },

  // ---------- Halloween 2026 (seasonal) ----------
  { item_id: "frame_haunted", name: "Haunted", description: "Ghostly wisps circling your avatar. Halloween 2026 only.", category: "Cosmetics", price: 6666, rarity: "epic", type: "cosmetic", rotation_type: "seasonal", ...HALLOWEEN },
  { item_id: "banner_pumpkin", name: "Pumpkin Patch", description: "Glowing jack-o'-lanterns under a harvest moon. Halloween 2026 only.", category: "Cosmetics", price: 4000, rarity: "rare", type: "cosmetic", rotation_type: "seasonal", ...HALLOWEEN },
  { item_id: "name_spooky", name: "Ectoplasm", description: "Your name glowing with eerie green slime. Halloween 2026 only.", category: "Cosmetics", price: 6666, rarity: "epic", type: "cosmetic", rotation_type: "seasonal", ...HALLOWEEN },

  // ---------- Limited drop ----------
  { item_id: "frame_crown", name: "Kingdom Crown", description: "The rarest frame in the Kingdom: a golden crown and royal glow. Only 25 will ever exist.", category: "Cosmetics", price: 100000, rarity: "mythic", type: "cosmetic", rotation_type: "limited", quantity: 25, available_from: "2026-10-01T00:00:00Z", available_until: "2026-10-15T00:00:00Z", season: "Launch drop" },
];

