// Admin → Members → Chat Events: seasonal mini-events the Economy Bot pops into busy chats
// (Economy/events/chat_events.py). The built-in events and settings are in catalog.json, which is copied
// byte-for-byte into the bot (Economy/db/chat_events_catalog.json). The database only keeps what admins changed.
//
// Client-safe: no database code in this file.

import catalog from "./catalog.json";

export type EventSeason = "spring" | "summer" | "fall" | "winter" | "any";
export type EventType = "grab" | "draw" | "pick" | "raffle" | "goal" | "scramble" | "typer" | "trivia" | "guess" | "math";
export type Range = [number, number];
export type Reward = { leaves: Range; xp: Range };
export type Outcome = { text: string; weight: number; leaves: Range; xp: Range };
export type PickOption = { label: string; emoji?: string };
export type Question = { q: string; answers: string[] };

export type ChatEvent = {
  id: string;
  season: EventSeason;
  type: EventType;
  name: string;
  emoji: string;
  color: string;
  weight: number;
  seconds: number;
  enabled: boolean;
  title: string;
  text: string;
  button?: string;
  winText?: string;
  missText?: string;
  reward?: Reward;
  miss?: Reward;
  outcomes?: Outcome[];
  options?: PickOption[];
  winners?: number;
  goal?: number;
  maxPerUser?: number;
  words?: string[];
  phrases?: string[];
  questions?: Question[];
  min?: number;
  max?: number;
  difficulty?: "easy" | "normal" | "hard";
  custom?: boolean;
};

export type ChatEventSettings = {
  enabled: boolean;
  seasonMode: "auto" | "spring" | "summer" | "fall" | "winter" | "all";
  includeAllYear: boolean;
  channels: string[];
  excludedCategories: string[];
  minChatters: number;
  chatterSeconds: number;
  chancePercent: number;
  channelCooldownMinutes: number;
  globalCooldownMinutes: number;
  maxPerHour: number;
  rewardMultiplier: number;
  deleteAfterSeconds: number;
  streaks: boolean;
  pingRole: string | null;
};

export const CATALOG = catalog as unknown as { version: number; settings: ChatEventSettings; events: ChatEvent[] };
export const BUILT_IN = new Map(CATALOG.events.map((e) => [e.id, e]));

export const EVENT_SEASONS: { key: EventSeason; label: string; icon: string }[] = [
  { key: "fall", label: "Autumn", icon: "Leaf" },
  { key: "winter", label: "Winter", icon: "Snowflake" },
  { key: "spring", label: "Spring", icon: "Flower2" },
  { key: "summer", label: "Summer", icon: "Sun" },
  { key: "any", label: "All year", icon: "CalendarDays" },
];

/** What each kind of event is, and which extra fields it uses. */
export const EVENT_TYPES: Record<EventType, { label: string; about: string; icon: string; fields: (keyof ChatEvent)[]; seconds: number }> = {
  grab: { label: "Grab it first", about: "One button. The first person to click wins.", icon: "Hand", fields: ["button", "winText", "missText", "reward"], seconds: 45 },
  draw: { label: "Everyone draws", about: "People join with a button, then each gets a random outcome (good or bad), like the Ice Cream Truck.", icon: "Shuffle", fields: ["button", "outcomes"], seconds: 30 },
  pick: { label: "Pick a spot", about: "A few choices, one is the lucky one. Everyone who picked it wins.", icon: "Grid2x2", fields: ["options", "winText", "missText", "reward", "miss"], seconds: 30 },
  raffle: { label: "Raffle", about: "People join, then a few random winners are drawn.", icon: "Ticket", fields: ["button", "winners", "reward"], seconds: 60 },
  goal: { label: "Community goal", about: "Everyone clicks together to reach a target in time. If they make it, every helper is paid.", icon: "Users", fields: ["button", "goal", "maxPerUser", "winText", "missText", "reward"], seconds: 60 },
  scramble: { label: "Word scramble", about: "Unscramble the word in chat. First right answer wins.", icon: "Shuffle", fields: ["words", "reward"], seconds: 90 },
  typer: { label: "Fast typer", about: "Type the phrase exactly. Copy-pasting doesn't count.", icon: "Keyboard", fields: ["phrases", "reward"], seconds: 60 },
  trivia: { label: "Trivia", about: "A question with buttons. Everyone who picks the right answer wins.", icon: "Brain", fields: ["questions", "reward"], seconds: 25 },
  guess: { label: "Number guess", about: "Guess the number in chat. The bot says higher or lower.", icon: "Hash", fields: ["min", "max", "reward"], seconds: 120 },
  math: { label: "Quick maths", about: "A sum to solve in chat. First right answer wins.", icon: "Calculator", fields: ["difficulty", "reward"], seconds: 45 },
};

export const PLACEHOLDERS: Partial<Record<keyof ChatEvent, string>> = {
  text: "{reward} {seconds} {goal} {winners} {min} {max}",
  winText: "{user} {time} {reward} {answer} {players}",
};

// ---------------------------------------------------------------------------------------------------- cleaning
export class ChatEventError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

const str = (v: unknown, max: number, fallback = "") => (typeof v === "string" ? v.replace(/\r/g, "").trim().slice(0, max) : fallback);
const int = (v: unknown, min: number, max: number, fallback: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};
const range = (v: unknown, min: number, max: number): Range => {
  const a = Array.isArray(v) ? v : [0, 0];
  const lo = int(a[0], min, max, 0);
  const hi = int(a[1], min, max, lo);
  return lo <= hi ? [lo, hi] : [hi, lo];
};
const reward = (v: unknown, allowNegative = false): Reward => {
  const r = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const lo = allowNegative ? -100_000 : 0;
  return { leaves: range(r.leaves, lo, 100_000), xp: range(r.xp, lo, 100_000) };
};
const lines = (v: unknown, maxItems: number, maxLen: number) =>
  (Array.isArray(v) ? v : typeof v === "string" ? v.split("\n") : [])
    .map((x) => str(x, maxLen))
    .filter(Boolean)
    .slice(0, maxItems);

const EMOJI_ONLY = new RegExp("^[\\p{Extended_Pictographic}\\p{Emoji_Component}\\u200d\\ufe0f\\u20e3]{1,16}$", "u");
const HAS_EMOJI = new RegExp("\\p{Extended_Pictographic}|\\u20e3", "u");

/** Unicode emoji, or a Discord custom emoji like <:name:123>. Anything else is dropped (Discord would refuse the button). */
export function cleanEmoji(v: unknown) {
  const s = str(v, 64);
  if (!s) return "";
  if (/^<a?:\w{2,32}:\d{15,21}>$/.test(s)) return s;
  if (EMOJI_ONLY.test(s) && HAS_EMOJI.test(s)) return s;
  return "";
}

/** A whole event, validated (used when saving and for custom events). */
export function cleanEvent(raw: Partial<ChatEvent>, base: ChatEvent): ChatEvent {
  const type = (raw.type && raw.type in EVENT_TYPES ? raw.type : base.type) as EventType;
  const season = (["spring", "summer", "fall", "winter", "any"].includes(String(raw.season)) ? raw.season : base.season) as EventSeason;
  const e: ChatEvent = {
    id: base.id,
    type,
    season,
    name: str(raw.name, 60, base.name) || base.name || "Event",
    emoji: cleanEmoji(raw.emoji ?? base.emoji) || "✨",
    color: /^#[0-9a-f]{6}$/i.test(String(raw.color)) ? String(raw.color) : base.color || "#d56300",
    weight: int(raw.weight, 0, 100, base.weight ?? 1),
    seconds: int(raw.seconds, 5, 900, base.seconds ?? EVENT_TYPES[type].seconds),
    enabled: typeof raw.enabled === "boolean" ? raw.enabled : base.enabled !== false,
    title: str(raw.title, 200, base.title) || base.title || "Chat event",
    text: str(raw.text, 1500, base.text),
  };
  const f = EVENT_TYPES[type].fields;
  const pick = <K extends keyof ChatEvent>(k: K) => (raw[k] !== undefined ? raw[k] : base[k]);
  if (f.includes("button")) e.button = str(pick("button"), 80) || "Join";
  if (f.includes("winText")) e.winText = str(pick("winText"), 500);
  if (f.includes("missText")) e.missText = str(pick("missText"), 500);
  if (f.includes("reward")) e.reward = reward(pick("reward"));
  if (f.includes("miss")) e.miss = reward(pick("miss"), true);
  if (f.includes("winners")) e.winners = int(pick("winners"), 1, 25, 3);
  if (f.includes("goal")) e.goal = int(pick("goal"), 1, 1000, 25);
  if (f.includes("maxPerUser")) e.maxPerUser = int(pick("maxPerUser"), 0, 1000, 6);
  if (f.includes("min")) e.min = int(pick("min"), -1_000_000, 1_000_000, 1);
  if (f.includes("max")) e.max = int(pick("max"), -1_000_000, 1_000_000, 100);
  if (e.min !== undefined && e.max !== undefined && e.max <= e.min) throw new ChatEventError("The highest number has to be bigger than the lowest.");
  if (f.includes("difficulty")) e.difficulty = (["easy", "normal", "hard"].includes(String(pick("difficulty"))) ? pick("difficulty") : "normal") as ChatEvent["difficulty"];
  if (f.includes("words")) {
    e.words = lines(pick("words"), 300, 40);
    if (!e.words.length) throw new ChatEventError("Add at least one word.");
  }
  if (f.includes("phrases")) {
    e.phrases = lines(pick("phrases"), 200, 120);
    if (!e.phrases.length) throw new ChatEventError("Add at least one phrase.");
  }
  if (f.includes("outcomes")) {
    const list = (Array.isArray(pick("outcomes")) ? (pick("outcomes") as Outcome[]) : []).slice(0, 20);
    e.outcomes = list.map((o) => ({ text: str(o?.text, 150) || "got something", weight: int(o?.weight, 0, 1000, 10), ...reward(o, true) }));
    if (!e.outcomes.some((o) => o.weight > 0)) throw new ChatEventError("Add at least one outcome with a chance above 0.");
  }
  if (f.includes("options")) {
    const list = (Array.isArray(pick("options")) ? (pick("options") as PickOption[]) : []).slice(0, 5);
    e.options = list.map((o) => ({ label: str(o?.label, 80), emoji: cleanEmoji(o?.emoji) || undefined })).filter((o) => o.label);
    if (e.options.length < 2) throw new ChatEventError("Give at least two choices.");
  }
  if (f.includes("questions")) {
    const list = (Array.isArray(pick("questions")) ? (pick("questions") as Question[]) : []).slice(0, 200);
    e.questions = list
      .map((q) => ({ q: str(q?.q, 250), answers: (Array.isArray(q?.answers) ? q.answers : []).map((a) => str(a, 80)).filter(Boolean).slice(0, 5) }))
      .filter((q) => q.q && q.answers.length >= 2);
    if (!e.questions.length) throw new ChatEventError("Add at least one question with two or more answers (the first one is right).");
  }
  if (raw.custom || base.custom) e.custom = true;
  return e;
}

/** A starting point for a new custom event. */
export function blankEvent(type: EventType, season: EventSeason, id: string): ChatEvent {
  const like = CATALOG.events.find((e) => e.type === type && (e.season === season || season === "any")) ?? CATALOG.events.find((e) => e.type === type)!;
  return { ...structuredClone(like), id, season, name: `New ${EVENT_TYPES[type].label.toLowerCase()}`, enabled: false, custom: true };
}

export function cleanSettings(raw: Partial<ChatEventSettings>): Partial<ChatEventSettings> {
  const d = CATALOG.settings;
  const out: Partial<ChatEventSettings> = {};
  const ids = (v: unknown) => (Array.isArray(v) ? v.map(String).filter((x) => /^\d{15,21}$/.test(x)).slice(0, 100) : []);
  if ("enabled" in raw) out.enabled = Boolean(raw.enabled);
  if ("seasonMode" in raw) out.seasonMode = (["auto", "spring", "summer", "fall", "winter", "all"].includes(String(raw.seasonMode)) ? raw.seasonMode : d.seasonMode) as ChatEventSettings["seasonMode"];
  if ("includeAllYear" in raw) out.includeAllYear = Boolean(raw.includeAllYear);
  if ("channels" in raw) out.channels = ids(raw.channels);
  if ("excludedCategories" in raw) out.excludedCategories = ids(raw.excludedCategories);
  if ("minChatters" in raw) out.minChatters = int(raw.minChatters, 1, 50, d.minChatters);
  if ("chatterSeconds" in raw) out.chatterSeconds = int(raw.chatterSeconds, 15, 3600, d.chatterSeconds);
  if ("chancePercent" in raw) out.chancePercent = int(raw.chancePercent, 0, 100, d.chancePercent);
  if ("channelCooldownMinutes" in raw) out.channelCooldownMinutes = int(raw.channelCooldownMinutes, 0, 1440, d.channelCooldownMinutes);
  if ("globalCooldownMinutes" in raw) out.globalCooldownMinutes = int(raw.globalCooldownMinutes, 0, 1440, d.globalCooldownMinutes);
  if ("maxPerHour" in raw) out.maxPerHour = int(raw.maxPerHour, 0, 60, d.maxPerHour);
  if ("rewardMultiplier" in raw) {
    const m = Number(raw.rewardMultiplier);
    out.rewardMultiplier = Number.isFinite(m) ? Math.min(10, Math.max(0, Math.round(m * 4) / 4)) : 1;
  }
  if ("deleteAfterSeconds" in raw) out.deleteAfterSeconds = int(raw.deleteAfterSeconds, 0, 86400, d.deleteAfterSeconds);
  if ("streaks" in raw) out.streaks = Boolean(raw.streaks);
  if ("pingRole" in raw) out.pingRole = raw.pingRole && /^\d{15,21}$/.test(String(raw.pingRole)) ? String(raw.pingRole) : null;
  return out;
}

/** "50–100" or "50" */
export function rangeLabel(r?: Range) {
  if (!r) return "0";
  return r[0] === r[1] ? r[0].toLocaleString("en-US") : `${r[0].toLocaleString("en-US")}–${r[1].toLocaleString("en-US")}`;
}

/** Chance of each outcome, in %. */
export function outcomeChances(outcomes: Outcome[]) {
  const total = outcomes.reduce((s, o) => s + Math.max(0, o.weight), 0) || 1;
  return outcomes.map((o) => (100 * Math.max(0, o.weight)) / total);
}
