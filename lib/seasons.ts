// Seasons: the website theme, the currency name/emote and the Discord look change with the season.
//   Spring  Mar 1 – May 31   Butterflies   🦋
//   Summer  Jun 1 – Aug 31   Crabs         🏖️ (channels) / 🦀
//   Autumn  Sep 1 – Nov 30   Leaves        🍂
//   Winter  Dec 1 – Feb 28/29 Snowflakes   ❄️
// Settings live in zeo_bot.bot_config {_id: "season"} (Admin → Overview → Seasons). The bots read the same doc.
//
// Client-safe: no database code in this file (lib/season-store.ts has that).

export type SeasonKey = "spring" | "summer" | "fall" | "winter";
export const SEASON_KEYS: SeasonKey[] = ["spring", "summer", "fall", "winter"];

export type AssetKind = "logo" | "banner" | "emote";
export const ASSET_KINDS: AssetKind[] = ["logo", "banner", "emote"];

/** The 11 level roles (same role ids all year; the bot renames and recolors them). */
export const LEVEL_TIERS = [
  { id: "1361677978421035180", range: "1-4" },
  { id: "1361678583713759363", range: "5-10" },
  { id: "1361678717197221968", range: "11-20" },
  { id: "1361678760327512185", range: "21-30" },
  { id: "1361679050632073398", range: "31-40" },
  { id: "1361679477700038828", range: "41-50" },
  { id: "1361680109953876049", range: "51-60" },
  { id: "1361680599672422540", range: "61-70" },
  { id: "1361680699563966605", range: "71-80" },
  { id: "1361680852064407683", range: "81-90" },
  { id: "1361681482946576504", range: "91+" },
] as const;

export type LevelRole = { emoji: string; name: string; color: string };

// Keep in step with DEFAULT_LEVELS in the bots' db/season.py
const L = (rows: [string, string, string][]): LevelRole[] => rows.map(([emoji, name, color]) => ({ emoji, name, color }));
export const DEFAULT_LEVEL_ROLES: Record<SeasonKey, LevelRole[]> = {
  fall: L([["🌰", "Acorn", "#c8a27a"], ["🪵", "Kindling", "#d9a066"], ["🍄", "Forager", "#c97b4a"], ["🌾", "Harvest", "#e0a030"], ["🎃", "Hallow", "#f08a24"], ["🍁", "Maple", "#e2531d"], ["✨", "Ember", "#ff9f43"], ["🌑", "Nightfall", "#7b5ea7"], ["🌲", "Ironwood", "#8b5a3c"], ["🔥", "Wildfire", "#ff4f1f"], ["🌳", "Elderwood", "#ffd27a"]]),
  winter: L([["🌨️", "Frost", "#dbeafe"], ["🌬️", "Flurry", "#bfdbfe"], ["🧊", "Icicle", "#a5f3fc"], ["⛄", "Snowdrift", "#e0f2fe"], ["🌲", "Evergreen", "#34a37a"], ["🏔️", "Glacier", "#7dd3fc"], ["🐻‍❄️", "Polar", "#f1f5f9"], ["🌌", "Aurora", "#a78bfa"], ["🌫️", "Whiteout", "#cbd5e1"], ["🌪️", "Blizzard", "#60a5fa"], ["🥶", "Absolute Zero", "#22d3ee"]]),
  spring: L([["🌱", "Sprout", "#86efac"], ["💧", "Dewdrop", "#93c5fd"], ["🍀", "Clover", "#4ade80"], ["🐝", "Pollen", "#fde047"], ["🌸", "Blossom", "#f9a8d4"], ["🌼", "Wildflower", "#f472b6"], ["⛈️", "Thunderhead", "#818cf8"], ["🌳", "Canopy", "#22c55e"], ["🌿", "Verdant", "#10b981"], ["🌗", "Equinox", "#c084fc"], ["🍃", "Overgrowth", "#84cc16"]]),
  summer: L([["🐚", "Seashell", "#fde2e4"], ["🪵", "Driftwood", "#d6a77a"], ["🪸", "Coral", "#ff7f6b"], ["☀️", "Sunburn", "#ff6b4a"], ["🏄", "Riptide", "#22b8cf"], ["🌡️", "Heatwave", "#ff9f1c"], ["🌞", "Solstice", "#ffd166"], ["🏜️", "Mirage", "#f4a261"], ["🦑", "Kraken", "#9b5de5"], ["🌊", "Tsunami", "#0096c7"], ["🐋", "Leviathan", "#00f5d4"]]),
};

/** Colors handed to the bot roles (Zeo, Economy, Moderation, Tickets…) in order, unless set per role. */
export const DEFAULT_BOT_COLORS: Record<SeasonKey, string[]> = {
  fall: ["#f59b2a", "#e25822", "#ffd27a", "#c85f18"],
  winter: ["#7cc4ff", "#a5b4fc", "#67e8f9", "#e0f2ff"],
  spring: ["#f9a8d4", "#c4b5fd", "#86efac", "#fde68a"],
  summer: ["#ff7a59", "#22b8cf", "#ffd166", "#34d399"],
};

/** "🍁 Maple [41-50]": the Discord name of a level role. */
export function levelRoleName(role: LevelRole, tier: number) {
  return `${role.emoji ? `${role.emoji} ` : ""}${role.name} [${LEVEL_TIERS[tier].range}]`;
}

/** What an admin can change per season. Asset ids point at zeo_bot.season_assets. */
export type SeasonSettings = {
  currencyOne: string;
  currencyMany: string;
  /** Used in bot messages: a custom emoji like <:leaf:123> or a normal emoji */
  discordEmoji: string;
  /** Put in front of channel names that carry the season emoji */
  channelEmoji: string;
  assets: Partial<Record<AssetKind, string | null>>;
  /** Show the uploaded logo on the website too (not just as the server icon) */
  siteLogo: boolean;
  /** Show the uploaded banner on the website's homepage and link previews */
  siteBanner: boolean;
  /** The level roles' emoji, name and color this season (11, lowest first) */
  levelRoles: LevelRole[];
  /** Bot role id → color this season (others get DEFAULT_BOT_COLORS in order) */
  botRoleColors: Record<string, string>;
};

export type SeasonConfig = {
  mode: "auto" | "manual";
  manual: SeasonKey;
  timezone: string;
  seasons: Record<SeasonKey, SeasonSettings>;
  site: { particles: "full" | "light" | "off"; scenery: boolean; bursts: boolean };
  discord: {
    renameChannels: boolean;
    renameCategories: boolean;
    swapIcon: boolean;
    swapBanner: boolean;
    levelRoles: boolean;
    botRoleColors: boolean;
    /** Bot roles to recolor; empty: the bots' own roles named Zeo, Economy, Moderation or Tickets */
    botRoles: string[];
  };
  version: number;
  updatedAt: string | null;
  updatedBy: string | null;
};

/** Fixed per season: names, dates, the palette and the default art. */
export type SeasonInfo = {
  key: SeasonKey;
  name: string;
  /** [month, day] the season starts (1-based months) */
  start: [number, number];
  blurb: string;
  particle: string;
  defaultEmote: string;
  defaultDiscordEmoji: string;
  defaultChannelEmoji: string;
  /** Unicode emoji shown next to the season's name */
  icon: string;
  swatch: [string, string, string];
};

export const SEASONS: Record<SeasonKey, SeasonInfo> = {
  spring: {
    key: "spring",
    name: "Spring",
    start: [3, 1],
    blurb: "Blossoms, soft pastels and butterflies",
    particle: "butterflies and petals",
    defaultEmote: "/seasons/butterfly.svg",
    defaultDiscordEmoji: "🦋",
    defaultChannelEmoji: "🦋",
    icon: "🦋",
    swatch: ["#f472b6", "#a3e635", "#fde68a"],
  },
  summer: {
    key: "summer",
    name: "Summer",
    start: [6, 1],
    blurb: "Sunny beaches, ocean waves and crabs",
    particle: "bubbles, sparkles and crabs",
    defaultEmote: "/seasons/crab.svg",
    defaultDiscordEmoji: "🦀",
    defaultChannelEmoji: "🏖️",
    icon: "🏖️",
    swatch: ["#ff7a59", "#22b8cf", "#ffd166"],
  },
  fall: {
    key: "fall",
    name: "Autumn",
    start: [9, 1],
    blurb: "Warm sunsets, maple trees and falling leaves",
    particle: "falling leaves and embers",
    defaultEmote: "/leaf-emote.png",
    defaultDiscordEmoji: "<:leaf:1524758896659660831>",
    defaultChannelEmoji: "🍂",
    icon: "🍂",
    swatch: ["#f59b2a", "#c85f18", "#ffd27a"],
  },
  winter: {
    key: "winter",
    name: "Winter",
    start: [12, 1],
    blurb: "Snowy pines, northern lights and snowflakes",
    particle: "snowflakes",
    defaultEmote: "/seasons/snowflake.svg",
    defaultDiscordEmoji: "❄️",
    defaultChannelEmoji: "❄️",
    icon: "❄️",
    swatch: ["#7cc4ff", "#3b6fd8", "#e0f2ff"],
  },
};

const CURRENCY: Record<SeasonKey, [string, string]> = {
  spring: ["Butterfly", "Butterflies"],
  summer: ["Crab", "Crabs"],
  fall: ["Leaf", "Leaves"],
  winter: ["Snowflake", "Snowflakes"],
};

export function defaultSeasonSettings(key: SeasonKey): SeasonSettings {
  const info = SEASONS[key];
  return {
    currencyOne: CURRENCY[key][0],
    currencyMany: CURRENCY[key][1],
    discordEmoji: info.defaultDiscordEmoji,
    channelEmoji: info.defaultChannelEmoji,
    assets: {},
    siteLogo: true,
    siteBanner: true,
    levelRoles: DEFAULT_LEVEL_ROLES[key].map((r) => ({ ...r })),
    botRoleColors: {},
  };
}

export function defaultSeasonConfig(): SeasonConfig {
  return {
    mode: "auto",
    manual: "fall",
    timezone: "US/Mountain",
    seasons: { spring: defaultSeasonSettings("spring"), summer: defaultSeasonSettings("summer"), fall: defaultSeasonSettings("fall"), winter: defaultSeasonSettings("winter") },
    site: { particles: "full", scenery: true, bursts: true },
    discord: { renameChannels: true, renameCategories: true, swapIcon: true, swapBanner: true, levelRoles: true, botRoleColors: true, botRoles: [] },
    version: 0,
    updatedAt: null,
    updatedBy: null,
  };
}

/** Today's month/day in a time zone (falls back to UTC for a bad zone). */
function monthDay(date: Date, timezone: string): [number, number, number] {
  try {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: timezone, year: "numeric", month: "numeric", day: "numeric" }).formatToParts(date);
    const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
    return [get("year"), get("month"), get("day")];
  } catch {
    return [date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate()];
  }
}

/** The season by the calendar: Spring Mar–May, Summer Jun–Aug, Autumn Sep–Nov, Winter Dec–Feb. */
export function seasonForDate(date: Date, timezone = "US/Mountain"): SeasonKey {
  const [, m] = monthDay(date, timezone);
  if (m >= 3 && m <= 5) return "spring";
  if (m >= 6 && m <= 8) return "summer";
  if (m >= 9 && m <= 11) return "fall";
  return "winter";
}

/** The current or next time a season runs: [start, end) as yyyy-mm-dd calendar dates in the zone. */
export function seasonWindow(key: SeasonKey, date: Date, timezone = "US/Mountain") {
  const [y, m, d] = monthDay(date, timezone);
  const today = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const [sm] = SEASONS[key].start;
  for (const year of [y - 1, y, y + 1]) {
    const endMonth = ((sm + 2) % 12) + 1;
    const endYear = sm + 3 > 12 ? year + 1 : year;
    const start = `${year}-${String(sm).padStart(2, "0")}-01`;
    const end = `${endYear}-${String(endMonth).padStart(2, "0")}-01`;
    if (end > today) return { start, end };
  }
  return { start: today, end: today };
}

export function nextSeason(key: SeasonKey): SeasonKey {
  return SEASON_KEYS[(SEASON_KEYS.indexOf(key) + 1) % 4];
}

/** The season that's live now under a config (manual override or by date). */
export function activeSeasonKey(config: Pick<SeasonConfig, "mode" | "manual" | "timezone">, now = new Date()): SeasonKey {
  return config.mode === "manual" && SEASON_KEYS.includes(config.manual) ? config.manual : seasonForDate(now, config.timezone);
}

/** What the website needs to draw a season (sent to the browser). */
export type SeasonView = {
  key: SeasonKey;
  name: string;
  one: string;
  many: string;
  emote: string;
  logo: string;
  banner: string;
  particles: SeasonConfig["site"]["particles"];
  scenery: boolean;
  bursts: boolean;
  version: number;
  /** The level roles this season, lowest first */
  levels: { emoji: string; name: string; range: string; color: string }[];
};

export function seasonView(config: SeasonConfig, key: SeasonKey): SeasonView {
  const s = config.seasons[key] ?? defaultSeasonSettings(key);
  const v = config.version;
  const asset = (kind: AssetKind) => (s.assets?.[kind] ? `/season/${kind}?s=${key}&v=${v}` : null);
  return {
    key,
    name: SEASONS[key].name,
    one: s.currencyOne,
    many: s.currencyMany,
    emote: asset("emote") ?? SEASONS[key].defaultEmote,
    logo: (s.siteLogo && asset("logo")) || "/logo.png",
    banner: (s.siteBanner && asset("banner")) || "/banner.jpg",
    particles: config.site.particles,
    scenery: config.site.scenery,
    bursts: config.site.bursts,
    version: v,
    levels: LEVEL_TIERS.map((t, i) => {
      const r = s.levelRoles?.[i] ?? DEFAULT_LEVEL_ROLES[key][i];
      return { emoji: r.emoji, name: r.name, range: t.range, color: r.color };
    }),
  };
}

/** Bot roles recolored when none are picked: the bots' own roles with these names */
export const BOT_ROLE_NAMES = ["zeo", "economy", "moderation", "tickets", "ticket", "ticketing"];

/** Swaps the fall currency words in a sentence for the season's (keeps capitals): "50 Leaves" → "50 Snowflakes". */
export function seasonalText(text: string, view: Pick<SeasonView, "one" | "many">) {
  const keepCase = (word: string, to: string) => (word[0] === word[0].toLowerCase() ? to.toLowerCase() : to);
  // Names that aren't the currency stay as they are: the Golden Leaf / Maple Leaf roles, "Autumn Leaves"
  return text
    .replace(/(?<!Autumn )\b(Leaves|leaves|Leafs|leafs)\b/g, (w) => keepCase(w, view.many))
    .replace(/(?<!Golden |Maple )\b(Leaf|leaf)\b/g, (w) => keepCase(w, view.one));
}
