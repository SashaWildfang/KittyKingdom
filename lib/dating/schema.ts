// Dating profile fields: the bot's schema (generated into schema-data.ts) plus website-only
// extras (photos, prompts, looks, privacy). Everything that reads or writes a profile goes
// through here, so a field is defined once.

import { ANY, DATING_ONLY_KEYS, EMPTY_VALUES, EVERYONE, FIELD_LIST, SECTIONS, TIMEZONES, type FieldDef } from "./schema-data";

export { ANY, EVERYONE, SECTIONS, FIELD_LIST, DATING_ONLY_KEYS, TIMEZONES };
export type { FieldDef };

// Website override: relationship status can be more than one thing (e.g. Taken + Open relationship +
// Polyamorous). Stored as a list (relationship_statuses) plus the joined text the bot shows.
const REL = FIELD_LIST.find((f) => f.key === "relationship_status");
if (REL && REL.kind !== "multi") {
  Object.assign(REL, {
    kind: "multi",
    listKey: "relationship_statuses",
    prompt: "What's your relationship status? (pick all that apply)",
    options: ["Single", "Taken", "Open relationship", "Polyamorous", "Married", "Engaged", "It's complicated"].map((value) => ({ value, emoji: null })),
  });
}

export const FIELDS: Record<string, FieldDef> = Object.fromEntries(FIELD_LIST.map((f) => [f.key, f]));
const EMPTY = new Set(EMPTY_VALUES);
const TZ_OFFSET = new Map(TIMEZONES);

export type ProfileDoc = Record<string, unknown> & { _id?: unknown };

export function isFilled(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (Array.isArray(value)) return value.length > 0;
  return !EMPTY.has(String(value).trim().toLowerCase());
}

/** The list for a multi field (falls back to splitting the display string). */
export function getList(profile: ProfileDoc, key: string): string[] {
  const f = FIELDS[key];
  const list = f?.listKey ? profile[f.listKey] : null;
  if (Array.isArray(list)) return list.map(String);
  const raw = profile[key];
  if (!isFilled(raw)) return [];
  return String(raw)
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

/** The original free-text answer the converter couldn't read (shown until they fix it). */
export function legacyText(profile: ProfileDoc, key: string): string | null {
  const raw = (profile.legacy as Record<string, unknown> | undefined)?.[key];
  return isFilled(raw) ? String(raw).trim().slice(0, 300) : null;
}

/** Human-readable value, or null. `legacy` is true when it's an old free-text answer. */
export function display(profile: ProfileDoc, key: string): { text: string; legacy: boolean } | null {
  const f = FIELDS[key];
  if (f?.kind === "multi") {
    const list = getList(profile, key);
    if (list.length) return { text: list.join(", "), legacy: false };
  } else {
    const v = profile[key];
    if (isFilled(v)) {
      const text = (key === "independence_level" || key === "partner_independence_level") && /^\d+$/.test(String(v)) ? `${v}/10` : String(v).trim();
      return { text, legacy: false };
    }
  }
  const legacy = legacyText(profile, key);
  return legacy ? { text: legacy, legacy: true } : null;
}

export function utcOffset(profile: ProfileDoc): number | null {
  if (typeof profile.utc_offset === "number") return profile.utc_offset;
  const tz = profile.timezone;
  return typeof tz === "string" && TZ_OFFSET.has(tz) ? TZ_OFFSET.get(tz)! : null;
}

export const asInt = (v: unknown) => {
  const n = typeof v === "number" ? v : parseInt(String(v ?? ""), 10);
  return Number.isFinite(n) ? Math.trunc(n) : null;
};

/**
 * Checks one field's new value. Returns the Mongo $set pieces (multi fields also store their
 * list) or an error message. Empty values return { unset: true } so the field is cleared.
 */
export function cleanField(key: string, raw: unknown): { set: Record<string, unknown>; unset?: boolean } | string {
  const f = FIELDS[key];
  if (!f) return "Unknown field.";
  const empty = raw === null || raw === undefined || (typeof raw === "string" && !raw.trim()) || (Array.isArray(raw) && !raw.length);
  if (empty) return { set: {}, unset: true };
  const allowed = new Set(f.options.map((o) => o.value));
  switch (f.kind) {
    case "choice": {
      const v = String(raw);
      if (!allowed.has(v)) return `Pick one of the options for ${f.label}.`;
      return { set: { [key]: v } };
    }
    case "multi": {
      const list = Array.from(new Set((Array.isArray(raw) ? raw : [raw]).map(String))).filter((v) => allowed.has(v));
      if (!list.length) return `Pick at least one option for ${f.label}.`;
      // "Everyone" / "Any" means everything, so it stands alone
      const final = list.includes(EVERYONE) ? [EVERYONE] : list.includes(ANY) ? [ANY] : list;
      return { set: { [key]: final.join(", "), ...(f.listKey ? { [f.listKey]: final } : {}) } };
    }
    case "number": {
      const n = asInt(raw);
      if (n === null || (f.min !== null && n < f.min) || (f.max !== null && n > f.max)) return `${f.label} must be between ${f.min} and ${f.max}.`;
      return { set: { [key]: n } };
    }
    default: {
      const v = String(raw).replace(/\r\n?/g, "\n").trim();
      if (v.length > f.maxLen) return `${f.label} can be up to ${f.maxLen} characters.`;
      return { set: { [key]: v } };
    }
  }
}

// ---------- Website extras ----------
/** Conversation prompts members can answer (up to three), like "My perfect date is…". */
export const PROMPTS = [
  "My perfect date is…",
  "You'll win me over if…",
  "The way to my heart is…",
  "My most controversial opinion is…",
  "A green flag I look for is…",
  "I geek out about…",
  "My ideal Sunday looks like…",
  "Two truths and a lie…",
  "The best trip I've taken was…",
  "My fursona would…",
  "I'm weirdly good at…",
  "Let's argue about…",
  "My comfort show / game is…",
  "Together we could…",
  "I'll know it's right when…",
];
export const MAX_PROMPTS = 3;
export const MAX_PHOTOS = 6;
export const ACCENTS = ["#f59b2a", "#e5484d", "#d6409f", "#8e4ec6", "#3e63dd", "#0ea5e9", "#12a594", "#46a758"];
/** Any #rrggbb color is allowed (members can pick their own). */
export const isHexColor = (v: unknown): v is string => typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v);
export const MAX_FURSONAS = 5;
/** A member's profile color: their pick, or a stable one from their id so placeholders vary. */
export function accentFor(id: string, chosen?: string | null) {
  if (isHexColor(chosen)) return chosen.toLowerCase();
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return ACCENTS[h % ACCENTS.length];
}

// ---------- Profile strength (same tips as the bot, plus photos) ----------
type Check = [number, string, string, (p: ProfileDoc) => boolean];
const STRENGTH: Check[] = [
  [14, "Bio", "Write a bio of a few sentences (150+ characters)", (p) => String(p.bio ?? "").length >= 150],
  [10, "Photos", "Add at least one photo or piece of art", (p) => Array.isArray(p.photos) && p.photos.length > 0],
  [11, "Hobbies & interests", "Add your hobbies & interests (matching weighs these most)", (p) => isFilled(p.hobbies_interests)],
  [7, "Likes", "List some things you like", (p) => isFilled(p.likes)],
  [4, "Favorite games", "Add your favorite games", (p) => isFilled(p.favorite_games)],
  [9, "Identity", "Set your gender and sexuality", (p) => isFilled(p.gender) && isFilled(p.sexuality)],
  [13, "Dating targets", "Set who you're looking for (genders, ages, relationship type)", (p) => getList(p, "looking_for_gender").length > 0 && asInt(p.looking_for_min_age) !== null && getList(p, "looking_for_relationship_type").length > 0],
  [8, "Lifestyle", "Fill in your lifestyle (sleep, activity, kids, marriage)", (p) => ["sleep_schedule", "activity_level", "want_kids", "marriage_goals"].filter((k) => isFilled(p[k])).length >= 3],
  [4, "Your habits", "Say whether you smoke, drink or use 420", (p) => ["smokes", "drinks", "uses_weed"].filter((k) => isFilled(p[k])).length >= 2],
  [4, "Partner habits comfort", "Say what habits you're OK with in a partner", (p) => ["smoking_ok", "drinking_ok", "substance_ok"].filter((k) => isFilled(p[k])).length >= 2],
  [7, "Location & timezone", "Add your location, timezone and distance comfort", (p) => isFilled(p.location) && isFilled(p.timezone) && isFilled(p.distance_comfort)],
  [4, "Flags & dealbreakers", "Add green/red flags or dealbreakers", (p) => ["green_flags", "red_flags", "dealbreakers"].some((k) => isFilled(p[k]))],
  [5, "Prompts", "Answer a prompt or two so people have something to reply to", (p) => Array.isArray(p.prompts) && p.prompts.length > 0],
];

export function profileStrength(p: ProfileDoc) {
  let score = 0;
  const missing: { points: number; label: string; tip: string }[] = [];
  for (const [points, label, tip, check] of STRENGTH) {
    if (check(p)) score += points;
    else missing.push({ points, label, tip });
  }
  missing.sort((a, b) => b.points - a.points);
  return { score: Math.min(100, score), missing };
}

/** Fields the converter flagged for the member to double-check (old profiles). */
export function reviewFields(p: ProfileDoc): string[] {
  return Array.isArray(p.needs_review) ? p.needs_review.map(String).filter((k) => FIELDS[k]) : [];
}
