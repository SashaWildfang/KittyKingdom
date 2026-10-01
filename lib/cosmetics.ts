// Profile cosmetics from the store (frames, banners, name effects) and item rarity.
// Shared by the server and the browser: only plain data here. The looks themselves are CSS
// classes (.cos-frame--*, .cos-banner--*, .cos-name--* in globals.css).

export type CosmeticSlot = "frame" | "banner" | "nameplate";
export type Rarity = "common" | "rare" | "epic" | "legendary" | "mythic";

/** What a member has equipped (cosmetic keys), shown on their profile card and Social profile. */
export type Flair = { frame: string | null; banner: string | null; nameplate: string | null };
export const NO_FLAIR: Flair = { frame: null, banner: null, nameplate: null };

export type CustomTitle = { text: string; hue: string };
export type CustomBadge = { id: string; name: string; desc: string; icon: string; shape: string; hue: string };

/** Everything extra a member shows off from the store. */
export type ProfileExtras = { flair: Flair; customTitle: CustomTitle | null; customBadges: CustomBadge[] };
export const NO_EXTRAS: ProfileExtras = { flair: NO_FLAIR, customTitle: null, customBadges: [] };

export const SLOT_LABELS: Record<CosmeticSlot, string> = { frame: "Avatar frame", banner: "Card banner", nameplate: "Name effect" };

export const RARITY: Record<Rarity, { label: string; color: string; order: number }> = {
  common: { label: "Common", color: "#9aa3ad", order: 0 },
  rare: { label: "Rare", color: "#3e9bff", order: 1 },
  epic: { label: "Epic", color: "#b46cff", order: 2 },
  legendary: { label: "Legendary", color: "#ffb21e", order: 3 },
  mythic: { label: "Mythic", color: "#ff4d8d", order: 4 },
};

/** Rarity from price, for items that don't set one. */
export function rarityFor(price: number, explicit?: unknown): Rarity {
  if (typeof explicit === "string" && explicit in RARITY) return explicit as Rarity;
  if (price >= 50_000) return "mythic";
  if (price >= 15_000) return "legendary";
  if (price >= 6_000) return "epic";
  if (price >= 2_000) return "rare";
  return "common";
}

/** Custom title colors to pick from. */
export const TITLE_HUES = ["#f59b2a", "#ff4d8d", "#b46cff", "#3e9bff", "#12a594", "#46a758", "#ffb21e", "#e5484d"];

/** Custom badge parts to pick from (icons are names from the badge medal icon set). */
export const BADGE_ICONS = [
  "Crown", "Heart", "Star", "Flame", "Gem", "Ghost", "Leaf", "Moon", "Sun", "Rocket", "Music", "Gift",
  "Rainbow", "Snowflake", "Skull", "Zap", "Wand2", "Clover", "Cake", "Castle", "Rabbit", "Headphones", "Sticker", "PartyPopper",
];
export const BADGE_SHAPES = ["circle", "hex", "shield", "diamond", "star", "burst", "octagon", "squircle"];
export const BADGE_HUES = ["#f59b2a", "#ff4d8d", "#b46cff", "#3e9bff", "#12a594", "#46a758", "#ffb21e", "#e5484d", "#8b8d98", "#d6409f"];

export const MAX_CUSTOM_BADGES = 3;
export const MAX_STREAK_SHIELDS = 5;
/** Missed days a shield stack can cover in one go (one shield per missed day). */
export const SHIELD_MAX_GAP = 3;

/** Item ids with special behavior. */
export const ITEM = {
  shield: "streak_shield",
  customTitle: "custom_title",
  customBadge: "custom_badge",
  superLike: "super_like",
  spotlight: "booster_spotlight",
} as const;

/** The cosmetic each store item applies (by item id). */
export const COSMETICS: Record<string, { slot: CosmeticSlot; key: string }> = {
  frame_ember: { slot: "frame", key: "ember" },
  frame_sakura: { slot: "frame", key: "sakura" },
  frame_neon: { slot: "frame", key: "neon" },
  frame_aurora: { slot: "frame", key: "aurora" },
  frame_gold: { slot: "frame", key: "gold" },
  frame_galaxy: { slot: "frame", key: "galaxy" },
  frame_haunted: { slot: "frame", key: "haunted" },
  frame_crown: { slot: "frame", key: "crown" },
  banner_candy: { slot: "banner", key: "candy" },
  banner_autumn: { slot: "banner", key: "autumn" },
  banner_sunset: { slot: "banner", key: "sunset" },
  banner_ocean: { slot: "banner", key: "ocean" },
  banner_starry: { slot: "banner", key: "starry" },
  banner_aurora: { slot: "banner", key: "aurora" },
  banner_pumpkin: { slot: "banner", key: "pumpkin" },
  name_frost: { slot: "nameplate", key: "frost" },
  name_gold: { slot: "nameplate", key: "gold" },
  name_fire: { slot: "nameplate", key: "fire" },
  name_rainbow: { slot: "nameplate", key: "rainbow" },
  name_glitch: { slot: "nameplate", key: "glitch" },
  name_spooky: { slot: "nameplate", key: "spooky" },
};

export const cosmeticOf = (itemId: string) => COSMETICS[itemId] ?? null;

/** The item id for an equipped cosmetic key in a slot (to tell it apart in the Locker). */
export function itemForCosmetic(slot: CosmeticSlot, key: string | null) {
  if (!key) return null;
  return Object.keys(COSMETICS).find((id) => COSMETICS[id].slot === slot && COSMETICS[id].key === key) ?? null;
}

const SAFE_KEY = /^[a-z]{2,20}$/;
/** Flair from a stored document, with anything unknown dropped. */
export function cleanFlair(raw: unknown): Flair {
  const f = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const pick = (slot: CosmeticSlot) => {
    const v = f[slot];
    return typeof v === "string" && SAFE_KEY.test(v) && Object.values(COSMETICS).some((c) => c.slot === slot && c.key === v) ? v : null;
  };
  return { frame: pick("frame"), banner: pick("banner"), nameplate: pick("nameplate") };
}

export function hasFlair(f: Flair | null | undefined) {
  return Boolean(f && (f.frame || f.banner || f.nameplate));
}
