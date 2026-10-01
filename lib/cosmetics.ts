// Profile cosmetics from the store, and item rarity. Shared by the server and the browser: only
// plain data here. Every cosmetic is a recipe (colors + a style); app/cosmetic-flair.tsx and
// app/cosmetic-scenes.tsx draw them, and lib/store-items.ts turns them into store items.
//
// Slots: frame (around your avatar/photo), banner (an illustrated scene behind your card and at the
// top of your Social profile), nameplate (your name), effect (animated particles on your Social
// profile and banner), theme (colors your whole Social profile page).

export type CosmeticSlot = "frame" | "banner" | "nameplate" | "effect" | "theme";
export type Rarity = "common" | "rare" | "epic" | "legendary" | "mythic";

/** What a member has equipped (cosmetic keys). */
export type Flair = { frame: string | null; banner: string | null; nameplate: string | null; effect: string | null; theme: string | null };
export const NO_FLAIR: Flair = { frame: null, banner: null, nameplate: null, effect: null, theme: null };
export const SLOTS: CosmeticSlot[] = ["banner", "frame", "nameplate", "effect", "theme"];

export type CustomTitle = { text: string; hue: string };
export type CustomBadge = { id: string; name: string; desc: string; icon: string; shape: string; hue: string };

/** Everything extra a member shows off from the store. */
export type ProfileExtras = { flair: Flair; customTitle: CustomTitle | null; customBadges: CustomBadge[] };
export const NO_EXTRAS: ProfileExtras = { flair: NO_FLAIR, customTitle: null, customBadges: [] };

export const SLOT_LABELS: Record<CosmeticSlot, string> = { frame: "Avatar frame", banner: "Banner", nameplate: "Name effect", effect: "Profile effect", theme: "Profile theme" };
export const SLOT_PLURAL: Record<CosmeticSlot, string> = { frame: "Frames", banner: "Banners", nameplate: "Name effects", effect: "Effects", theme: "Themes" };
export const SLOT_HINT: Record<CosmeticSlot, string> = {
  banner: "An illustrated scene at the top of your Social profile and behind your profile card",
  frame: "Around your photo on Social and your avatar everywhere",
  nameplate: "Your name on your Social profile, cards and profile card",
  effect: "Animated particles across your Social profile and banner",
  theme: "Colors your whole Social profile page",
};

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

const PRICE: Record<Rarity, number> = { common: 1500, rare: 4000, epic: 9000, legendary: 20000, mythic: 60000 };

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

// ---------- recipes ----------
export type Ornament = "crown" | "halo" | "wings" | "batwings" | "horns" | "ears" | "wreath" | "snow" | "flames" | "hearts" | "stars" | "blossoms" | "moon" | "wisps" | "bolts" | "petals";
export type FrameSpec = { style: "spin" | "dual" | "pulse" | "sweep" | "dots" | "flame" | "prism"; colors: string[]; glow: string; speed?: number; ornaments?: Ornament[]; ornament?: string };
export type Scene = "pumpkins" | "mountains" | "ocean" | "forest" | "city" | "space" | "aurora" | "sakura" | "candy" | "desert" | "underwater" | "retro" | "clouds" | "meadow" | "village" | "lava";
export type BannerSpec = { scene: Scene; p: string[]; stars?: boolean; snow?: boolean; alt?: boolean };
export type NameSpec = { style: "sweep" | "neon" | "glow" | "outline" | "retro" | "chrome" | "sparkle" | "glitch"; colors: string[] };
export type Particle = "snow" | "petal" | "heart" | "sparkle" | "star" | "leaf" | "bubble" | "ember" | "firefly" | "confetti" | "bat" | "ghost" | "note" | "paw" | "rain";
export type EffectSpec = { particle: Particle; colors: string[]; motion: "fall" | "rise" | "float" | "twinkle" | "drift" | "rain"; count?: number };
export type ThemeSpec = { bg: [string, string, string]; accent: string; glow: string };

type Window = { from: string; until: string; season: string; quantity?: number };
export type CosmeticDef = {
  id: string;
  slot: CosmeticSlot;
  key: string;
  name: string;
  desc: string;
  rarity: Rarity;
  price: number;
  /** Seasonal (on sale in a window) or limited (numbered, in a window) */
  window?: Window & { kind: "seasonal" | "limited" };
  frame?: FrameSpec;
  banner?: BannerSpec;
  nameplate?: NameSpec;
  effect?: EffectSpec;
  theme?: ThemeSpec;
};

const HALLOWEEN: Window & { kind: "seasonal" } = { kind: "seasonal", from: "2026-10-01T00:00:00Z", until: "2026-11-03T00:00:00Z", season: "Halloween 2026" };
const PREFIX: Record<CosmeticSlot, string> = { frame: "frame", banner: "banner", nameplate: "name", effect: "fx", theme: "theme" };

function def(slot: CosmeticSlot, key: string, name: string, desc: string, rarity: Rarity, spec: Partial<CosmeticDef>, price?: number): CosmeticDef {
  return { id: `${PREFIX[slot]}_${key}`, slot, key, name, desc, rarity, price: price ?? PRICE[rarity], ...spec };
}
const fr = (key: string, name: string, desc: string, rarity: Rarity, frame: FrameSpec, extra: Partial<CosmeticDef> = {}, price?: number) => def("frame", key, name, desc, rarity, { frame, ...extra }, price);
const bn = (key: string, name: string, desc: string, rarity: Rarity, banner: BannerSpec, extra: Partial<CosmeticDef> = {}, price?: number) => def("banner", key, name, desc, rarity, { banner, ...extra }, price);
const nm = (key: string, name: string, desc: string, rarity: Rarity, nameplate: NameSpec, extra: Partial<CosmeticDef> = {}, price?: number) => def("nameplate", key, name, desc, rarity, { nameplate, ...extra }, price);
const fx = (key: string, name: string, desc: string, rarity: Rarity, effect: EffectSpec, extra: Partial<CosmeticDef> = {}, price?: number) => def("effect", key, name, desc, rarity, { effect, ...extra }, price);
const th = (key: string, name: string, desc: string, rarity: Rarity, theme: ThemeSpec, extra: Partial<CosmeticDef> = {}, price?: number) => def("theme", key, name, desc, rarity, { theme, ...extra }, price);

export const COSMETIC_DEFS: CosmeticDef[] = [
  // ================= BANNERS (illustrated scenes) =================
  bn("pumpkin", "Pumpkin Patch", "Carved jack-o'-lanterns glowing under a harvest moon, with bats on the wind. Halloween 2026 only.", "epic", { scene: "pumpkins", p: ["#140726", "#3b1450", "#fff2c2", "#24103a", "#1a0b22", "#ff8a1f", "#c4560b", "#ffd75e"] }, { window: HALLOWEEN }, 6666),
  bn("harvest", "Harvest Dusk", "A pumpkin patch at sunset, every lantern lit. Halloween 2026 only.", "rare", { scene: "pumpkins", p: ["#3a1240", "#ff7b39", "#ffe3a1", "#5a2330", "#2c1018", "#ff9a2e", "#c9600f", "#fff1a8"] }, { window: HALLOWEEN }, 4000),
  bn("graveyard", "Witching Hour", "Eerie green pumpkins in a haunted glow. Halloween 2026 only.", "legendary", { scene: "pumpkins", p: ["#02130e", "#0f3b2c", "#d8ffe9", "#0b241c", "#04140f", "#8bff7a", "#2fa84f", "#e9ff8a"] }, { window: HALLOWEEN }, 13000),

  bn("starry", "Starry Night", "Snowy peaks under a sky full of twinkling stars and a silver moon.", "epic", { scene: "mountains", p: ["#050816", "#1b2560", "#f4f1ff", "#2b3470", "#1a2050", "#0d1235", "#e8ecff"], stars: true, snow: true }, {}, 9000),
  bn("alpine", "Alpine Dawn", "Golden sunrise over snowy mountains.", "rare", { scene: "mountains", p: ["#ffb88a", "#ffe3b0", "#fff2c7", "#9aa7c7", "#6b7aa8", "#3d4a78", "#ffffff"], snow: true }),
  bn("dusk", "Purple Dusk", "Layered violet ridges fading into twilight.", "rare", { scene: "mountains", p: ["#2a0f4a", "#ff7eb3", "#ffd6a5", "#7b3f8f", "#52296b", "#2e1745", "#f3d1ff"], stars: true }),
  bn("highlands", "Misty Highlands", "Soft green hills under a pale morning sun.", "common", { scene: "mountains", p: ["#cfe9e1", "#f6fbe9", "#fffbe0", "#8fc1a9", "#5f9d82", "#356b55", "#ffffff"] }),

  bn("ocean", "Deep Ocean", "Rolling waves under a glittering moonlit sky.", "rare", { scene: "ocean", p: ["#061633", "#1d3b78", "#f4f6ff", "#123e7a", "#0b2c5e", "#071d40", "#cfe6ff"], stars: true }, {}, 4500),
  bn("tropical", "Tropical Tide", "Turquoise waves and a bright island sun.", "rare", { scene: "ocean", p: ["#4fc3f7", "#c8f3ff", "#fff59d", "#26c6da", "#00acc1", "#00838f", "#ffffff"] }),
  bn("sunsetsea", "Sunset Sea", "A blazing sun melting into the waves.", "epic", { scene: "ocean", p: ["#3b0f5c", "#ff6f61", "#ffd27a", "#b0306a", "#7a1f5c", "#42124a", "#ffd0b5"] }),

  bn("autumn", "Autumn Canopy", "A golden autumn forest, leaves drifting through warm light.", "rare", { scene: "forest", p: ["#ffcf8a", "#ff8e53", "#fff1c1", "#e0782a", "#b84a14", "#7a2c0c", "#ffd9a0", "#ffe08a"], alt: true }, {}, 3500),
  bn("mistwood", "Mistwood", "Pine forest wrapped in silver fog and fireflies.", "epic", { scene: "forest", p: ["#0d2a2a", "#3f6f6a", "#e8fff4", "#25524b", "#163a35", "#0a221f", "#cfeee4", "#d6ff8a"] }),
  bn("enchanted", "Enchanted Grove", "A violet forest glowing with magic fireflies.", "legendary", { scene: "forest", p: ["#1a0b3a", "#5b2a86", "#ffd6ff", "#43206b", "#2c1450", "#1a0b35", "#e3c2ff", "#9dfcff"] }),

  bn("neoncity", "Neon City", "A cyberpunk skyline glowing under a pink moon.", "epic", { scene: "city", p: ["#0b0221", "#3a0f6b", "#ff4dd8", "#26104d", "#140733", "#ffe66d", "#00f0ff"] }),
  bn("goldenhour", "Golden Hour City", "Warm city lights as the sun goes down.", "rare", { scene: "city", p: ["#ff9a5a", "#ffd6a0", "#fff1c9", "#7a3e4a", "#4a2034", "#ffe08a", "#ffffff"] }),
  bn("rainynight", "Rainy Night", "A quiet blue city in the rain.", "rare", { scene: "city", p: ["#0a1830", "#1f3d66", "#cfe2ff", "#1d3557", "#11223d", "#9bd1ff", "#7fd3ff"] }),

  bn("nebula", "Nebula", "Swirling violet nebula and a ringed planet.", "legendary", { scene: "space", p: ["#05010f", "#1a0638", "#b46cff", "#ff4dd8", "#ffcf8a", "#c4602f", "#ffe9c4"] }),
  bn("cosmos", "Cosmic Teal", "Deep space in teal and blue with a giant planet.", "epic", { scene: "space", p: ["#010a12", "#06283d", "#2bd9c7", "#3e9bff", "#7ee8fa", "#2a6f97", "#d4fbff"] }),
  bn("redgiant", "Red Giant", "A crimson nebula around a burning planet.", "epic", { scene: "space", p: ["#0f0103", "#3d0710", "#ff4d4d", "#ff9a3c", "#ffb38a", "#a8321e", "#ffe0c4"] }),

  bn("aurora", "Northern Lights", "Living ribbons of aurora over snowy pines.", "legendary", { scene: "aurora", p: ["#020b1a", "#0b2645", "#3dffb4", "#2bb8ff", "#b46cff", "#dfeaf6", "#0e2337"] }, {}, 20000),
  bn("pinkaurora", "Rose Aurora", "Pink and violet lights dancing in the sky.", "epic", { scene: "aurora", p: ["#12041f", "#2d0d3f", "#ff6fd8", "#b46cff", "#ffd1f0", "#f1e4ff", "#24123a"] }),

  bn("sakura", "Sakura Spring", "Cherry blossoms in full bloom, petals on the breeze.", "epic", { scene: "sakura", p: ["#ffe3ef", "#fff7fb", "#f4c6da", "#5b3a3a", "#ff9cc7", "#ffd1e3", "#ffb3d1"] }),
  bn("plum", "Moon Plum", "White plum blossoms under a night sky.", "rare", { scene: "sakura", p: ["#1b1838", "#3d3570", "#4b4486", "#2a1f2e", "#ffffff", "#e6e0ff", "#f3eefe"] }),
  bn("wisteria", "Wisteria", "Lavender blooms over soft purple hills.", "rare", { scene: "sakura", p: ["#efe4ff", "#fbf8ff", "#d8c7f5", "#5a4a6b", "#b98cf0", "#d9c2ff", "#c9a7ff"] }),

  bn("candy", "Cotton Candy", "Candy clouds, lollipops and gumdrop hills.", "common", { scene: "candy", p: ["#ffc8e6", "#c8e3ff", "#ffffff", "#ff7eb6", "#7ec8ff", "#ffe066", "#ffb3d9"] }, {}, 1500),
  bn("berry", "Berry Sweet", "A berry-pink candy land.", "rare", { scene: "candy", p: ["#ff9ac1", "#ffd1e3", "#fff0f6", "#e8457c", "#9b5de5", "#ffd166", "#ff6f9f"] }),
  bn("mintcandy", "Mint Swirl", "Cool mint candy hills and swirls.", "common", { scene: "candy", p: ["#c9fff0", "#e8f9ff", "#ffffff", "#2ec4b6", "#ff9f80", "#ffd6a5", "#9be7d8"] }),

  bn("dunes", "Golden Dunes", "Rolling desert dunes under a blazing sun.", "common", { scene: "desert", p: ["#ffd59e", "#fff3d6", "#fff6b0", "#f2b36b", "#e09a4f", "#c47a35", "#3d6b3f"] }),
  bn("desertnight", "Desert Night", "Starry desert dunes and silhouetted cacti.", "rare", { scene: "desert", p: ["#0c1029", "#2a2d5c", "#f3f0d7", "#3a3560", "#2a2648", "#1c1933", "#0f2a1c"], stars: true }),

  bn("reef", "Coral Reef", "Sunlit water, swaying seaweed and bright coral.", "epic", { scene: "underwater", p: ["#0aa3c2", "#04496b", "#c8fbff", "#2e8b57", "#ff7f7f", "#ffb86b", "#e6fbff"] }),
  bn("abyss", "Abyss", "The deep sea, lit by drifting glowing bubbles.", "legendary", { scene: "underwater", p: ["#04182b", "#000814", "#5ee7ff", "#0f3d3e", "#b46cff", "#ff4dd8", "#9ef6ff"] }),

  bn("sunset", "Sunset Drive", "A synthwave sun over a glowing neon grid.", "rare", { scene: "retro", p: ["#120024", "#ff2a6d", "#ffd319", "#ff2975", "#f222ff", "#1a0033", "#8c1eff"] }, {}, 4500),
  bn("vaporwave", "Vaporwave", "Cyan and pink retro horizon.", "epic", { scene: "retro", p: ["#06021f", "#5f3dc4", "#7df9ff", "#ff71ce", "#01cdfe", "#120a3a", "#b967ff"] }),

  bn("skyday", "Blue Skies", "Fluffy clouds drifting across a sunny sky.", "common", { scene: "clouds", p: ["#7cc6ff", "#d9f1ff", "#fff3a8", "#ffffff", "#eaf6ff", "#cfe9ff"] }),
  bn("pastelsky", "Pastel Sky", "Peach and lilac clouds at golden hour.", "rare", { scene: "clouds", p: ["#ffb7c5", "#ffe5c4", "#fff6d6", "#fff4f8", "#ffd9e6", "#f1d4ff"] }),
  bn("storm", "Stormfront", "Dark rolling storm clouds lit by distant light.", "epic", { scene: "clouds", p: ["#1b2333", "#46546e", "#cfd8ea", "#58657e", "#3d4860", "#2a3346"] }),

  bn("meadow", "Spring Meadow", "Rolling green hills covered in wildflowers.", "common", { scene: "meadow", p: ["#a8e0ff", "#e9f8ff", "#fff3a1", "#7cc576", "#5aa65a", "#ff8fab", "#ffe066"] }),
  bn("lavender", "Lavender Fields", "Rows of lavender under a warm evening sky.", "rare", { scene: "meadow", p: ["#ffc6a8", "#ffe9d6", "#fff1c1", "#8f6bbd", "#6d4c9e", "#c39bff", "#f3e1ff"] }),
  bn("sunflower", "Sunflower Hills", "Sunny hills dotted with sunflowers.", "rare", { scene: "meadow", p: ["#8fd3ff", "#e7f7ff", "#fff59d", "#9ccc65", "#7cb342", "#ffca28", "#ffa000"] }),

  bn("village", "Cozy Village", "A snowy village at night, every window glowing warm.", "epic", { scene: "village", p: ["#0d1b3a", "#2c4a7a", "#f2f7ff", "#5a3a2e", "#ffffff", "#ffc56b", "#1e3d33"], stars: true, snow: true }),

  bn("volcano", "Volcano", "An erupting volcano with rivers of flowing lava and rising embers.", "legendary", { scene: "lava", p: ["#14070a", "#5a1608", "#3a2420", "#24140f", "#ff4d0d", "#ffc23a", "#ffe08a"] }),
  bn("emberforge", "Ember Forge", "A volcano of molten gold under a smoky violet sky.", "epic", { scene: "lava", p: ["#120a1f", "#4a2a3a", "#3b3040", "#211a28", "#f59e0b", "#fff1a8", "#ffe8a3"] }),

  // ================= FRAMES =================
  fr("ember", "Ember Ring", "A warm ring of firelight turning around your avatar.", "rare", { style: "spin", colors: ["#ffb347", "#ff6a00", "#ffe08a"], glow: "rgba(255,120,0,.6)" }, {}, 3000),
  fr("sakura", "Sakura", "Soft pink ring with cherry blossoms tucked in.", "rare", { style: "spin", colors: ["#ffd1e3", "#ff86b6", "#fff0f6"], glow: "rgba(255,134,182,.55)", speed: 10, ornaments: ["blossoms"] }, {}, 4000),
  fr("neon", "Neon Pulse", "A pink and cyan neon ring that breathes with light.", "rare", { style: "pulse", colors: ["#ff2bd6", "#00e5ff"], glow: "rgba(0,229,255,.7)" }, {}, 5000),
  fr("aurora", "Aurora", "Shifting greens and violets of the northern lights.", "epic", { style: "spin", colors: ["#3dffb4", "#2bb8ff", "#b46cff"], glow: "rgba(61,255,180,.5)", speed: 8 }, {}, 8000),
  fr("gold", "Royal Gold", "Polished gold with light sweeping across it.", "epic", { style: "sweep", colors: ["#8a5a00", "#ffd56a", "#fff6c9", "#e0a526"], glow: "rgba(255,196,64,.6)" }, {}, 12000),
  fr("galaxy", "Galaxy", "A spinning ring of nebula with stars in orbit.", "legendary", { style: "spin", colors: ["#1b1464", "#8a2be2", "#4fc3ff", "#ff4dd8"], glow: "rgba(138,43,226,.65)", speed: 5, ornaments: ["stars"] }, {}, 25000),
  fr("haunted", "Haunted", "Ghostly wisps circling a pale green ring. Halloween 2026 only.", "epic", { style: "pulse", colors: ["#3b6e58", "#c8ffe0"], glow: "rgba(125,255,184,.7)", ornaments: ["wisps"] }, { window: HALLOWEEN }, 6666),
  fr("batwing", "Bat Wings", "Leathery bat wings spread around a blood-red ring. Halloween 2026 only.", "legendary", { style: "dual", colors: ["#2a0a14", "#c1121f", "#ff4d4d"], glow: "rgba(193,18,31,.6)", ornaments: ["batwings"] }, { window: HALLOWEEN }, 13000),
  fr("crown", "Kingdom Crown", "The rarest frame in the Kingdom: a golden crown and royal glow. Only 25 will ever exist.", "mythic", { style: "sweep", colors: ["#8a5a00", "#ffe9a0", "#fff8dc", "#d4a017"], glow: "rgba(255,200,60,.85)", ornaments: ["crown"] }, { window: { kind: "limited", from: "2026-10-01T00:00:00Z", until: "2026-10-15T00:00:00Z", season: "Launch drop", quantity: 25 } }, 100000),
  fr("silver", "Silver Sweep", "Brushed silver with a cool sweeping shine.", "common", { style: "sweep", colors: ["#6b7280", "#e5e7eb", "#ffffff", "#9ca3af"], glow: "rgba(229,231,235,.45)" }),
  fr("rosegold", "Rose Gold", "Warm rose gold, softly gleaming.", "rare", { style: "sweep", colors: ["#9e5a4f", "#f4c2b6", "#fff1ec", "#d4877a"], glow: "rgba(244,194,182,.55)" }),
  fr("obsidian", "Obsidian", "Glassy black stone with a violet edge.", "rare", { style: "sweep", colors: ["#050505", "#3a2a4a", "#9b7bd4", "#1a1424"], glow: "rgba(155,123,212,.5)" }),
  fr("tide", "Ocean Tide", "Deep blues rolling around your avatar.", "common", { style: "spin", colors: ["#0b3d91", "#1fa2ff", "#a6ffcb"], glow: "rgba(31,162,255,.5)" }),
  fr("toxic", "Toxic", "A radioactive green ring that pulses.", "rare", { style: "pulse", colors: ["#39ff14", "#b6ff00"], glow: "rgba(57,255,20,.7)" }),
  fr("candy", "Candy Stripe", "Pastel candy dots spinning round and round.", "common", { style: "dots", colors: ["#ff8fc7", "#8fd3ff", "#ffe066"], glow: "rgba(255,143,199,.45)" }),
  fr("heartbeat", "Heartbeat", "A pink ring with little hearts in orbit.", "epic", { style: "pulse", colors: ["#ff4d8d", "#ffb3cf"], glow: "rgba(255,77,141,.65)", ornaments: ["hearts"] }),
  fr("starfall", "Starfall", "Golden starlight dotted around your avatar.", "epic", { style: "dots", colors: ["#ffe08a", "#fff6d6", "#ffb21e"], glow: "rgba(255,210,90,.6)", ornaments: ["stars"] }),
  fr("angel", "Angelic", "A shining halo and feathered wings.", "legendary", { style: "sweep", colors: ["#d9c58b", "#fffaf0", "#ffffff", "#f1e3b0"], glow: "rgba(255,248,220,.8)", ornaments: ["halo", "wings"] }),
  fr("demon", "Demonic", "Burning red ring and curling horns.", "legendary", { style: "flame", colors: ["#2b0000", "#ff1e1e", "#ff7a00"], glow: "rgba(255,40,0,.7)", ornaments: ["horns"] }),
  fr("kitty", "Kitty Ears", "A playful ring with fluffy cat ears on top.", "rare", { style: "spin", colors: ["#ffb3c6", "#ffd6e0", "#ff8fab"], glow: "rgba(255,143,171,.5)", ornaments: ["ears"], ornament: "#ffb3c6" }),
  fr("foxears", "Fox Ears", "Orange fox ears on a warm autumn ring.", "rare", { style: "spin", colors: ["#ff8a3d", "#ffd0a1", "#c4501b"], glow: "rgba(255,138,61,.5)", ornaments: ["ears"], ornament: "#ff8a3d" }),
  fr("wreath", "Forest Wreath", "A leafy green wreath around a golden ring.", "rare", { style: "sweep", colors: ["#1f5f3a", "#a8e6a3", "#f5ffe6", "#3f8f4f"], glow: "rgba(120,220,140,.5)", ornaments: ["wreath"] }),
  fr("frost", "Frostbite", "An icy ring dusted with snowflakes.", "epic", { style: "spin", colors: ["#bfefff", "#5ac8fa", "#ffffff"], glow: "rgba(140,220,255,.7)", ornaments: ["snow"] }),
  fr("phoenix", "Phoenix", "A ring of living flame that never goes out.", "legendary", { style: "flame", colors: ["#ff3d00", "#ffb300", "#fff176"], glow: "rgba(255,120,0,.8)", ornaments: ["flames"] }),
  fr("electric", "Electric", "Crackling yellow energy with lightning bolts.", "epic", { style: "dots", colors: ["#fff200", "#ffe066", "#ffffff"], glow: "rgba(255,242,0,.75)", ornaments: ["bolts"], speed: 2 }),
  fr("prism", "Prism", "Every color of the rainbow, always moving.", "legendary", { style: "prism", colors: ["#ff4d4d", "#ffd84d", "#4dff88", "#4dc3ff", "#b44dff"], glow: "rgba(255,255,255,.55)" }),
  fr("void", "Void", "A dark ring that swallows the light.", "epic", { style: "dual", colors: ["#000000", "#3c096c", "#9d4edd"], glow: "rgba(157,78,221,.65)" }),
  fr("moonlit", "Moonlit", "Silver moonlight with a crescent moon.", "rare", { style: "spin", colors: ["#c9d6ff", "#e2e2e2", "#7f8fd8"], glow: "rgba(201,214,255,.6)", ornaments: ["moon"] }),
  fr("sunflower", "Sunflower", "Bright golden petals all the way around.", "epic", { style: "sweep", colors: ["#7a4a12", "#ffd23f", "#fff3a0", "#f4a259"], glow: "rgba(255,210,63,.6)", ornaments: ["petals"], ornament: "#ffd23f" }),

  // ================= NAME EFFECTS =================
  nm("frost", "Frostbite", "Your name in icy blue with a frosty glint.", "rare", { style: "sweep", colors: ["#7fd3ff", "#e8f9ff", "#5ab7ff"] }, {}, 5000),
  nm("gold", "Gilded", "Your name in shimmering gold.", "epic", { style: "sweep", colors: ["#b8860b", "#ffd56a", "#fff6c9"] }, {}, 7500),
  nm("fire", "Inferno", "Your name burning in flickering flame colors.", "epic", { style: "sweep", colors: ["#ff3d00", "#ff9100", "#ffd600"] }, {}, 10000),
  nm("rainbow", "Prism", "Your name flowing through every color.", "legendary", { style: "sweep", colors: ["#ff4d4d", "#ffd84d", "#4dff88", "#4dc3ff", "#b44dff"] }, {}, 18000),
  nm("glitch", "Glitch", "Your name flickering like a broken screen.", "legendary", { style: "glitch", colors: ["#ff2bd6", "#00e5ff"] }, {}, 22000),
  nm("spooky", "Ectoplasm", "Your name glowing with eerie green slime. Halloween 2026 only.", "epic", { style: "glow", colors: ["#9dff9a", "#3cc83c"] }, { window: HALLOWEEN }, 6666),
  nm("pumpkin", "Jack-o'-Lantern", "Your name glowing orange like a carved pumpkin. Halloween 2026 only.", "rare", { style: "glow", colors: ["#ffb347", "#ff6a00"] }, { window: HALLOWEEN }, 4000),
  nm("sunset", "Sunset", "Warm orange fading into pink.", "rare", { style: "sweep", colors: ["#ff7e5f", "#feb47b", "#ff6fd8"] }),
  nm("ocean", "Ocean", "Cool waves of blue and teal.", "rare", { style: "sweep", colors: ["#00c6ff", "#0072ff", "#7ff7ff"] }),
  nm("toxic", "Toxic", "Radioactive green that glows.", "rare", { style: "glow", colors: ["#b6ff00", "#39ff14"] }),
  nm("candy", "Candy", "Sweet pink and blue swirl.", "common", { style: "sweep", colors: ["#ff8fc7", "#8fd3ff", "#ffd1f0"] }),
  nm("galaxy", "Galaxy", "Deep space purples and blues.", "epic", { style: "sweep", colors: ["#8a2be2", "#4fc3ff", "#ff4dd8", "#2b1a6b"] }),
  nm("rosegold", "Rose Gold", "Soft, elegant rose gold.", "rare", { style: "sweep", colors: ["#b76e79", "#f4c2b6", "#fff1ec"] }),
  nm("mint", "Mint", "Fresh mint green.", "common", { style: "sweep", colors: ["#3eb489", "#b8f2e6", "#5ed6a8"] }),
  nm("lava", "Lava", "Molten red and gold.", "epic", { style: "sweep", colors: ["#7a0000", "#ff3c00", "#ffb703"] }),
  nm("aurora", "Aurora", "Green and violet light shifting through your name.", "epic", { style: "sweep", colors: ["#3dffb4", "#2bb8ff", "#b46cff"] }),
  nm("berry", "Berry", "Juicy berry pinks and purples.", "common", { style: "sweep", colors: ["#c9184a", "#ff4d8d", "#9b5de5"] }),
  nm("chrome", "Chrome", "Polished, reflective chrome.", "epic", { style: "chrome", colors: ["#f5f7fa", "#8e9eab", "#ffffff", "#5c6b7a"] }),
  nm("neonpink", "Neon Pink", "A buzzing pink neon sign.", "epic", { style: "neon", colors: ["#ffe1f5", "#ff2bd6"] }),
  nm("neoncyan", "Neon Cyan", "A buzzing cyan neon sign.", "epic", { style: "neon", colors: ["#e0fdff", "#00e5ff"] }),
  nm("neonlime", "Neon Lime", "A buzzing lime neon sign.", "rare", { style: "neon", colors: ["#f2ffd6", "#9dff00"] }),
  nm("outline", "Hollow", "A crisp glowing outline.", "rare", { style: "outline", colors: ["#ffffff", "#b46cff"] }),
  nm("retro", "Retro 3D", "Bold stacked 80s lettering.", "rare", { style: "retro", colors: ["#ffe066", "#ff4d8d", "#3e9bff"] }),
  nm("sparkle", "Sparkle", "A golden shimmer with a twinkling star.", "legendary", { style: "sparkle", colors: ["#ffd56a", "#fff6c9", "#ff9ec7"] }),
  nm("bubblegum", "Bubblegum", "Puffy pink 3D letters.", "common", { style: "retro", colors: ["#ffd6e8", "#ff8fc7", "#c2185b"] }),

  // ================= PROFILE EFFECTS =================
  fx("snow", "Snowfall", "Soft snow drifting down your profile.", "rare", { particle: "snow", colors: ["#ffffff", "#e3f2ff"], motion: "fall", count: 30 }),
  fx("petals", "Cherry Petals", "Pink petals floating on the breeze.", "epic", { particle: "petal", colors: ["#ffb3d1", "#ffd1e3", "#ff8fbf"], motion: "fall" }),
  fx("hearts", "Floating Hearts", "Little hearts rising up your profile.", "epic", { particle: "heart", colors: ["#ff4d8d", "#ff8fb1", "#ffc2d6"], motion: "rise" }),
  fx("sparkles", "Sparkles", "Twinkling sparkles everywhere.", "rare", { particle: "sparkle", colors: ["#fff6c9", "#ffd56a", "#ffffff"], motion: "twinkle", count: 26 }),
  fx("fireflies", "Fireflies", "Glowing fireflies drifting in the dark.", "epic", { particle: "firefly", colors: ["#d6ff8a", "#fff59d"], motion: "float", count: 24 }),
  fx("leaves", "Autumn Leaves", "Golden leaves tumbling down.", "rare", { particle: "leaf", colors: ["#ff8c32", "#ffcf6a", "#c84b14", "#e85d04"], motion: "fall" }),
  fx("bubbles", "Bubbles", "Shimmering bubbles floating up.", "common", { particle: "bubble", colors: ["#bfefff", "#e3d4ff", "#ffffff"], motion: "rise" }),
  fx("embers", "Embers", "Hot embers rising from below.", "epic", { particle: "ember", colors: ["#ff6a00", "#ffb703", "#ff3d00"], motion: "rise", count: 28 }),
  fx("stars", "Starlight", "Golden stars twinkling around you.", "legendary", { particle: "star", colors: ["#ffe08a", "#ffffff", "#b6d7ff"], motion: "twinkle" }),
  fx("confetti", "Confetti", "A never-ending party.", "rare", { particle: "confetti", colors: ["#ff4d8d", "#ffd84d", "#4dc3ff", "#4dff88", "#b46cff"], motion: "fall", count: 30 }),
  fx("notes", "Music Notes", "Melodies drifting across your profile.", "rare", { particle: "note", colors: ["#b46cff", "#3e9bff", "#ff4d8d"], motion: "drift" }),
  fx("paws", "Paw Prints", "Tiny paw prints wandering by.", "common", { particle: "paw", colors: ["#f59b2a", "#ffd27a", "#c85f18"], motion: "drift" }),
  fx("rain", "Rainfall", "Calm, steady rain.", "common", { particle: "rain", colors: ["#9bd1ff", "#cfe8ff"], motion: "rain", count: 36 }),
  fx("bats", "Bats", "Bats fluttering across your profile. Halloween 2026 only.", "epic", { particle: "bat", colors: ["#4a2366", "#2b1238"], motion: "drift" }, { window: HALLOWEEN }, 6666),
  fx("ghosts", "Ghosts", "Friendly ghosts floating by. Halloween 2026 only.", "legendary", { particle: "ghost", colors: ["#f4fff9", "#d8ffe9"], motion: "float", count: 14 }, { window: HALLOWEEN }, 13000),

  // ================= PROFILE THEMES =================
  th("midnight", "Midnight", "Deep navy with a soft blue glow.", "common", { bg: ["#050a1f", "#0f1d4a", "#1b2f6b"], accent: "#6ea8ff", glow: "rgba(110,168,255,.35)" }),
  th("rosequartz", "Rose Quartz", "Soft blush pinks.", "rare", { bg: ["#2a0f1d", "#5e1f3d", "#a8456f"], accent: "#ff9ec7", glow: "rgba(255,158,199,.35)" }),
  th("forest", "Enchanted Forest", "Deep greens with a magical glow.", "rare", { bg: ["#04140c", "#0f3a24", "#1f6b44"], accent: "#7dffb0", glow: "rgba(125,255,176,.3)" }),
  th("deepsea", "Deep Sea", "Ocean blues and teal.", "rare", { bg: ["#011627", "#033a5c", "#0a6f8f"], accent: "#5ee7ff", glow: "rgba(94,231,255,.32)" }),
  th("sunset", "Sunset Boulevard", "Warm orange into purple.", "epic", { bg: ["#1f0533", "#7a1f5c", "#ff7b39"], accent: "#ffb36b", glow: "rgba(255,123,57,.35)" }),
  th("lavender", "Lavender Dream", "Calm violet and lilac.", "rare", { bg: ["#140a26", "#3a2466", "#7a5bb5"], accent: "#cfb3ff", glow: "rgba(207,179,255,.35)" }),
  th("mint", "Mint Breeze", "Fresh mint and teal.", "common", { bg: ["#04201c", "#0d4a40", "#1f8a73"], accent: "#8ff5d6", glow: "rgba(143,245,214,.3)" }),
  th("crimson", "Crimson", "Bold deep reds.", "epic", { bg: ["#140003", "#4a0010", "#9b0f2a"], accent: "#ff5a6e", glow: "rgba(255,90,110,.35)" }),
  th("royal", "Royal Gold", "Black and gold, fit for royalty.", "legendary", { bg: ["#0b0802", "#2b1f05", "#6b4e0a"], accent: "#ffd56a", glow: "rgba(255,213,106,.4)" }),
  th("cyber", "Cyberpunk", "Neon pink and cyan on black.", "legendary", { bg: ["#05010f", "#2a0a4a", "#00384d"], accent: "#ff2bd6", glow: "rgba(0,229,255,.35)" }),
  th("cottoncandy", "Cotton Candy", "Pastel pink and blue.", "rare", { bg: ["#3a1f47", "#7a4f9a", "#4f7ac7"], accent: "#ffc2e2", glow: "rgba(255,194,226,.35)" }),
  th("noir", "Noir", "Sleek black and silver.", "epic", { bg: ["#000000", "#111111", "#2a2a2a"], accent: "#e5e7eb", glow: "rgba(229,231,235,.25)" }),
  th("harvest", "Autumn Harvest", "Pumpkin orange and warm browns.", "rare", { bg: ["#1a0a03", "#4a2008", "#a8450f"], accent: "#ffb347", glow: "rgba(255,179,71,.35)" }),
  th("frost", "Frost", "Icy whites and pale blues.", "epic", { bg: ["#06121f", "#1d3b5c", "#5f8fb8"], accent: "#cdeeff", glow: "rgba(205,238,255,.35)" }),
  th("haunted", "Haunted", "Ghostly green on deepest night. Halloween 2026 only.", "epic", { bg: ["#020806", "#0c2a1c", "#1f4a2f"], accent: "#9dff9a", glow: "rgba(157,255,154,.35)" }, { window: HALLOWEEN }, 6666),
];

const byId = new Map(COSMETIC_DEFS.map((d) => [d.id, d]));
const byKey = new Map(COSMETIC_DEFS.map((d) => [`${d.slot}:${d.key}`, d]));

/** The cosmetic each store item applies (by item id). */
export const COSMETICS: Record<string, { slot: CosmeticSlot; key: string }> = Object.fromEntries(COSMETIC_DEFS.map((d) => [d.id, { slot: d.slot, key: d.key }]));
export const cosmeticOf = (itemId: string) => COSMETICS[itemId] ?? null;
export const cosmeticDef = (itemId: string) => byId.get(itemId) ?? null;
/** A cosmetic's recipe from its slot and key. */
export const specOf = (slot: CosmeticSlot, key: string | null | undefined) => (key ? byKey.get(`${slot}:${key}`) ?? null : null);

/** The item id for an equipped cosmetic key in a slot. */
export function itemForCosmetic(slot: CosmeticSlot, key: string | null) {
  return key ? specOf(slot, key)?.id ?? null : null;
}

/** Flair from a stored document, with anything unknown dropped. */
export function cleanFlair(raw: unknown): Flair {
  const f = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const pick = (slot: CosmeticSlot) => {
    const v = f[slot];
    return typeof v === "string" && specOf(slot, v) ? v : null;
  };
  return { frame: pick("frame"), banner: pick("banner"), nameplate: pick("nameplate"), effect: pick("effect"), theme: pick("theme") };
}

export function hasFlair(f: Flair | null | undefined) {
  return Boolean(f && SLOTS.some((s) => f[s]));
}
