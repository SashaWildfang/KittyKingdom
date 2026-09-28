// Each member's Dating settings (website DB, `dating_settings`, keyed by Discord id): which
// notifications they get, privacy choices and Discover defaults. Missing values use DEFAULTS, so new
// settings can be added here without migrating anyone.

import { getMongoClient } from "../mongodb";

export const NOTIFY_TYPES = [
  { key: "like", label: "Someone likes you" },
  { key: "partner", label: "Partner link requests and confirmations" },
  { key: "match", label: "You match with someone" },
  { key: "message", label: "New messages" },
  { key: "request", label: "Message requests" },
  { key: "friend-request", label: "Friend requests" },
  { key: "friend-accepted", label: "Friend request accepted" },
  { key: "view", label: "Someone views your profile" },
] as const;
export type NotifyKey = (typeof NOTIFY_TYPES)[number]["key"];

export type DatingSettings = {
  notify: Record<NotifyKey, boolean>;
  /** Which notifications the bot also sends as a Discord DM (all off unless they turn them on). */
  dm: Record<NotifyKey, boolean>;
  /** Look at profiles without them being told. */
  anonymousViews: boolean;
  /** Who can start a chat: anyone (as a request) or only matches and friends. */
  messagesFrom: "everyone" | "connections";
  /** Show members who have left the Discord server in Discover and Browse. */
  showLeft: boolean;
  /** Which Discover opens in. */
  discoverMode: "dating" | "friends";
  /** Appear in "Online now" on the Social home. */
  showInOnline: boolean;
  /** Show how many people viewed my profile. */
  showViewCount: boolean;
  /** "Seen" in chats. Works both ways: turning it off also hides theirs. */
  readReceipts: boolean;
  /** Who can send me friend requests. */
  friendRequestsFrom: "everyone" | "matches" | "nobody";
  /** Include me in the hourly featured draw. */
  featured: boolean;
  /** Hide Discover matches below this score (0 = show everyone who fits). */
  discoverMinScore: 0 | 40 | 55 | 70;
  /** How Browse is sorted until I pick something else. */
  browseSort: "best" | "active" | "new";
  /** Enter sends a message (Shift+Enter for a new line); off = Enter adds a line. */
  enterToSend: boolean;
  /** Show my confirmed partners on my profile. */
  showPartners: boolean;
};

export const DEFAULTS: DatingSettings = {
  notify: { like: true, partner: true, match: true, message: true, request: true, "friend-request": true, "friend-accepted": true, view: true },
  dm: { like: false, partner: false, match: false, message: false, request: false, "friend-request": false, "friend-accepted": false, view: false },
  anonymousViews: false,
  messagesFrom: "everyone",
  showLeft: true,
  discoverMode: "dating",
  showInOnline: true,
  showViewCount: true,
  readReceipts: true,
  friendRequestsFrom: "everyone",
  featured: true,
  discoverMinScore: 0,
  browseSort: "best",
  enterToSend: true,
  showPartners: true,
};

async function col() {
  return (await getMongoClient()).db(process.env.MONGODB_DB ?? "website").collection("dating_settings");
}

function merge(doc: Partial<DatingSettings> | null | undefined): DatingSettings {
  return { ...DEFAULTS, ...(doc ?? {}), notify: { ...DEFAULTS.notify, ...(doc?.notify ?? {}) }, dm: { ...DEFAULTS.dm, ...(doc?.dm ?? {}) } };
}

/** Everyone's settings at once (for the pool: Online now, featured draw). */
export async function allSettings(): Promise<Map<string, DatingSettings>> {
  const rows = (await (await col()).find({}).toArray()) as (Partial<DatingSettings> & { _id: unknown })[];
  return new Map(rows.map((r) => [String(r._id), merge(r)]));
}

export async function getSettings(discordId: string): Promise<DatingSettings> {
  const doc = (await (await col()).findOne({ _id: discordId } as never)) as Partial<DatingSettings> | null;
  return merge(doc);
}

/** Validates and saves a (partial) settings change. Returns the full settings. */
export async function saveSettings(discordId: string, patch: unknown): Promise<DatingSettings> {
  const p = (patch ?? {}) as Record<string, unknown>;
  const $set: Record<string, unknown> = {};
  const notify = (p.notify ?? {}) as Record<string, unknown>;
  for (const t of NOTIFY_TYPES) if (typeof notify[t.key] === "boolean") $set[`notify.${t.key}`] = notify[t.key];
  const dm = (p.dm ?? {}) as Record<string, unknown>;
  for (const t of NOTIFY_TYPES) if (typeof dm[t.key] === "boolean") $set[`dm.${t.key}`] = dm[t.key];
  if (typeof p.anonymousViews === "boolean") $set.anonymousViews = p.anonymousViews;
  if (p.messagesFrom === "everyone" || p.messagesFrom === "connections") $set.messagesFrom = p.messagesFrom;
  if (typeof p.showLeft === "boolean") $set.showLeft = p.showLeft;
  if (p.discoverMode === "dating" || p.discoverMode === "friends") $set.discoverMode = p.discoverMode;
  for (const k of ["showInOnline", "showViewCount", "readReceipts", "featured", "enterToSend", "showPartners"] as const) if (typeof p[k] === "boolean") $set[k] = p[k];
  if (["everyone", "matches", "nobody"].includes(String(p.friendRequestsFrom))) $set.friendRequestsFrom = p.friendRequestsFrom;
  if ([0, 40, 55, 70].includes(Number(p.discoverMinScore)) && p.discoverMinScore !== null && p.discoverMinScore !== "") $set.discoverMinScore = Number(p.discoverMinScore);
  if (["best", "active", "new"].includes(String(p.browseSort))) $set.browseSort = p.browseSort;
  if (Object.keys($set).length) await (await col()).updateOne({ _id: discordId } as never, { $set: { ...$set, updatedAt: new Date() } }, { upsert: true });
  return getSettings(discordId);
}
