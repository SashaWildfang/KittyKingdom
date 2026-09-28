// Each member's Dating settings (website DB, `dating_settings`, keyed by Discord id): which
// notifications they get, privacy choices and Discover defaults. Missing values use DEFAULTS, so new
// settings can be added here without migrating anyone.

import { getMongoClient } from "../mongodb";

export const NOTIFY_TYPES = [
  { key: "like", label: "Someone likes you", hint: "Non-boosters see who for their 3 most recent likes" },
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
  /** Look at profiles without them being told. */
  anonymousViews: boolean;
  /** Who can start a chat: anyone (as a request) or only matches and friends. */
  messagesFrom: "everyone" | "connections";
  /** Show members who have left the Discord server in Discover and Browse. */
  showLeft: boolean;
  /** Which Discover opens in. */
  discoverMode: "dating" | "friends";
};

export const DEFAULTS: DatingSettings = {
  notify: { like: true, match: true, message: true, request: true, "friend-request": true, "friend-accepted": true, view: true },
  anonymousViews: false,
  messagesFrom: "everyone",
  showLeft: true,
  discoverMode: "dating",
};

async function col() {
  return (await getMongoClient()).db(process.env.MONGODB_DB ?? "website").collection("dating_settings");
}

function merge(doc: Partial<DatingSettings> | null | undefined): DatingSettings {
  return { ...DEFAULTS, ...(doc ?? {}), notify: { ...DEFAULTS.notify, ...(doc?.notify ?? {}) } };
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
  if (typeof p.anonymousViews === "boolean") $set.anonymousViews = p.anonymousViews;
  if (p.messagesFrom === "everyone" || p.messagesFrom === "connections") $set.messagesFrom = p.messagesFrom;
  if (typeof p.showLeft === "boolean") $set.showLeft = p.showLeft;
  if (p.discoverMode === "dating" || p.discoverMode === "friends") $set.discoverMode = p.discoverMode;
  if (Object.keys($set).length) await (await col()).updateOne({ _id: discordId } as never, { $set: { ...$set, updatedAt: new Date() } }, { upsert: true });
  return getSettings(discordId);
}
