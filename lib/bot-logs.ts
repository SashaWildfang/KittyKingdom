// The staff log channel (where the main bot's updater.py and other cogs post), mirrored into
// Mongo so staff can search, filter and sort every log instantly. New messages are pulled on
// every request (at most every few seconds); older history is backfilled a few pages at a time.

import type { Document } from "mongodb";
import { DISCORD_API, botToken } from "./discord-member";
import { getMongoClient } from "./mongodb";

export const LOG_CHANNEL_ID = "1360344042705256660";

// Channels mirrored into the Bot Logs tab
export const LOG_CHANNELS = [
  { key: "bot", id: LOG_CHANNEL_ID, label: "Bot logs", meta: "sync" },
  { key: "vc", id: "1503203701580365974", label: "VC logs", meta: "sync:vc" },
] as const;
export type LogChannelKey = (typeof LOG_CHANNELS)[number]["key"];

const SYNC_EVERY_MS = 5_000;
const NEW_PAGES_PER_SYNC = 5;
const BACKFILL_PAGES_PER_SYNC = 4;

type DiscordEmbed = {
  title?: string;
  description?: string;
  color?: number;
  timestamp?: string;
  author?: { name?: string; icon_url?: string };
  footer?: { text?: string };
  fields?: { name: string; value: string; inline?: boolean }[];
  image?: { url?: string };
  thumbnail?: { url?: string };
};

type DiscordMessage = {
  id: string;
  content: string;
  timestamp: string;
  author: { id: string; username: string; bot?: boolean };
  embeds: DiscordEmbed[];
  attachments: { id: string; filename: string; size: number; content_type?: string; url: string }[];
};

export type LogEntry = {
  id: string;
  ts: string;
  type: string;
  title: string | null;
  description: string | null;
  content: string | null;
  color: string | null;
  authorName: string | null;
  authorIcon: string | null;
  fields: { name: string; value: string; inline: boolean }[];
  footer: string | null;
  thumbnail?: string | null;
  image?: string | null;
  subjectId: string | null;
  userIds: string[];
  attachments: { id: string; filename: string; size: number; image: boolean; kind?: "image" | "video" | "audio" | "file" }[];
  postedBy: string;
  category: string;
};

async function db() {
  const client = await getMongoClient();
  return client.db(process.env.MONGODB_DB ?? "website");
}

// Emojis and symbols before the first letter or number
const LEADING_SYMBOLS = new RegExp("^[^\\p{L}\\p{N}]+", "u");

// Titles that carry a name or detail get folded into one clean type
const TYPE_RULES: [RegExp, string | ((m: RegExpMatchArray) => string)][] = [
  // "🎙️ VC Event: Joined VC" -> "Joined VC"
  [/^vc event:\s*(.+)$/i, (m) => m[1].trim()],
  [/^avatar changed/i, "Avatar Changed"],
  [/^gift sent/i, "Gift Sent"],
  [/^ticket action:?\s*(\w+)/i, (m) => `Ticket ${({ OPEN: "Opened", CLAIM: "Claimed", CLOSE: "Closed", DELETE: "Deleted", REOPEN: "Reopened" } as Record<string, string>)[m[1].toUpperCase()] ?? m[1].toLowerCase()}`],
  [/^operations concluded/i, "Operations Concluded"],
  [/^(channel )?locked\b/i, "Channel Locked"],
  [/^auto-?unlocked|^(channel )?unlocked\b/i, "Channel Unlocked"],
  [/^disboard/i, "Disboard Bump"],
  [/^new level tier/i, "New Level Tier Reached"],
  [/^server boosted/i, "Server Boosted"],
  [/^role (added|removed) from the website/i, (m) => `Role ${m[1].toLowerCase() === "added" ? "Added" : "Removed"} (Website)`],
];

/** "🖼️ Avatar Changed: sasha" -> "Avatar Changed", "🎟️ Ticket Action: DELETE" -> "Ticket Deleted" */
export function logType(title: string | null | undefined, content: string | null | undefined) {
  const raw = (title || (content ?? "").split("\n")[0] || "").replace(/<[^>]+>/g, "").replace(LEADING_SYMBOLS, "").trim();
  for (const [pattern, result] of TYPE_RULES) {
    const m = raw.match(pattern);
    if (m) return typeof result === "string" ? result : result(m);
  }
  const cleaned = raw.split(/\s[•|—-]\s|:\s/)[0].replace(/[!.`]+$/, "").trim();
  return cleaned.slice(0, 60) || "Other";
}

export const LOG_CATEGORIES = [
  { key: "voice", label: "Voice", icon: "🎙️" },
  { key: "messages", label: "Messages", icon: "💬" },
  { key: "members", label: "Member updates", icon: "👤" },
  { key: "moderation", label: "Moderation", icon: "🛡️" },
  { key: "tickets", label: "Tickets", icon: "🎫" },
  { key: "economy", label: "Levels & economy", icon: "📈" },
  { key: "boosts", label: "Boosts & bumps", icon: "💎" },
  { key: "system", label: "Scans & system", icon: "🔍" },
  { key: "other", label: "Other", icon: "📦" },
] as const;

export function logCategory(type: string) {
  const t = type.toLowerCase();
  if (/\bvc\b|afk|voice/.test(t)) return "voice";
  if (/^message /.test(t)) return "messages";
  if (/avatar|nickname|username|roles updated|display name/.test(t)) return "members";
  if (/^ticket/.test(t)) return "tickets";
  if (/timed out|timeout|kick|ban|mute|muzzle|warn|lock|wipe|verification|verif|purge|clear|slowmode|automod|punish/.test(t)) return "moderation";
  if (/level|xp|economy|gift|leaf|store|shop|daily|wordle|qotd|role (added|removed)/.test(t)) return "economy";
  if (/boost|bump|disboard/.test(t)) return "boosts";
  if (/operations concluded|scan|sync|restart|console|backup|update/.test(t)) return "system";
  return "other";
}

const TYPE_VERSION = 4;

function toEntry(m: DiscordMessage, channel: LogChannelKey) {
  const embed = m.embeds[0];
  const allText = [m.content, ...m.embeds.flatMap((e) => [e.title, e.description, e.footer?.text, ...(e.fields ?? []).flatMap((f) => [f.name, f.value])])]
    .filter(Boolean)
    .join("\n");
  // The updater puts the member's id in the footer ("User ID: 123 • 9/26/2026 ...")
  // The member's id: updater.py puts it in the footer, the VC logs in the author line ("name (123)")
  const footerId = embed?.footer?.text?.match(/User ID:\s*(\d{15,21})/)?.[1] ?? embed?.author?.name?.match(/\((\d{15,21})\)/)?.[1] ?? null;
  const mentioned = Array.from(allText.matchAll(/<@!?(\d{15,21})>/g), (x) => x[1]);
  const codeIds = Array.from(allText.matchAll(/`(\d{17,21})`/g), (x) => x[1]);
  const userIds = Array.from(new Set([footerId, ...mentioned, ...codeIds].filter((x): x is string => Boolean(x))));
  return {
    _id: m.id,
    channel,
    ts: new Date(m.timestamp),
    type: logType(embed?.title, m.content),
    category: logCategory(logType(embed?.title, m.content)),
    title: embed?.title ?? null,
    description: embed?.description ?? null,
    content: m.content || null,
    color: typeof embed?.color === "number" ? `#${embed.color.toString(16).padStart(6, "0")}` : null,
    authorName: embed?.author?.name ?? null,
    authorIcon: embed?.author?.icon_url ?? null,
    fields: (embed?.fields ?? []).map((f) => ({ name: f.name, value: f.value, inline: Boolean(f.inline) })),
    footer: embed?.footer?.text ?? null,
    // e.g. the new avatar on "Avatar Changed" logs
    thumbnail: embed?.thumbnail?.url ?? null,
    image: embed?.image?.url ?? null,
    subjectId: footerId ?? mentioned[0] ?? null,
    userIds,
    attachments: m.attachments.map((a) => ({
      id: a.id,
      filename: a.filename,
      size: a.size,
      kind: a.content_type?.startsWith("image/") ? "image" : a.content_type?.startsWith("video/") ? "video" : a.content_type?.startsWith("audio/") ? "audio" : "file",
      image: Boolean(a.content_type?.startsWith("image/")),
      url: a.url,
    })),
    postedBy: m.author.username,
    text: allText.toLowerCase(),
  };
}

async function fetchPage(channelId: string, params: string): Promise<DiscordMessage[] | null> {
  const token = botToken();
  if (!token) return null;
  const response = await fetch(`${DISCORD_API}/channels/${channelId}/messages?limit=100${params}`, {
    headers: { Authorization: `Bot ${token}` },
    cache: "no-store",
  });
  if (response.status === 429) return [];
  return response.ok ? ((await response.json()) as DiscordMessage[]) : null;
}

const maxId = (ids: string[]) => ids.reduce((a, b) => (BigInt(b) > BigInt(a) ? b : a));
const minId = (ids: string[]) => ids.reduce((a, b) => (BigInt(b) < BigInt(a) ? b : a));

/** Pulls anything new (and a bit more history). Only one request does this at a time. */
export async function syncLogs() {
  for (const channel of LOG_CHANNELS) await syncChannel(channel);
}

/** Same as syncLogs, for one mirrored channel (e.g. the VC logs for the stats page). */
export async function syncLogChannel(key: LogChannelKey) {
  const channel = LOG_CHANNELS.find((c) => c.key === key);
  if (channel) await syncChannel(channel);
}

async function syncChannel(channel: (typeof LOG_CHANNELS)[number]) {
  const d = await db();
  const logs = d.collection("bot_logs");
  const meta = d.collection<{ _id: string; newestId?: string; oldestId?: string; backfillDone?: boolean; syncedAt?: Date; lockedUntil?: Date }>("bot_logs_meta");
  const now = new Date();
  await meta.updateOne({ _id: channel.meta }, { $setOnInsert: { syncedAt: new Date(0) } }, { upsert: true });
  const state = await meta.findOneAndUpdate(
    {
      _id: channel.meta,
      syncedAt: { $lt: new Date(now.getTime() - SYNC_EVERY_MS) },
      $or: [{ lockedUntil: { $lt: now } }, { lockedUntil: { $exists: false } }],
    },
    { $set: { lockedUntil: new Date(now.getTime() + 20_000) } },
  );
  if (!state) return;

  // Older copies were typed with the first version of the rules: re-type them once
  const stateVersion = (state as { typeVersion?: number }).typeVersion ?? 1;
  if (stateVersion < 4) {
    // Version 4 also saves embed images/thumbnails: fetch the whole channel again once
    state.newestId = undefined;
    state.oldestId = undefined;
    state.backfillDone = false;
    if (channel.key !== "bot") await meta.updateOne({ _id: channel.meta }, { $set: { typeVersion: TYPE_VERSION } });
  }
  if (channel.key === "bot" && stateVersion < TYPE_VERSION) {
    // Logs mirrored before channels were tracked all came from the bot log channel
    await logs.updateMany({ channel: { $exists: false } }, { $set: { channel: "bot" } });
    const old = await logs.find({}, { projection: { title: 1, content: 1 } }).toArray();
    if (old.length) {
      await logs.bulkWrite(
        old.map((d) => {
          const type = logType(d.title as string | null, d.content as string | null);
          return { updateOne: { filter: { _id: d._id }, update: { $set: { type, category: logCategory(type) } } } };
        }),
        { ordered: false },
      );
    }
    await meta.updateOne({ _id: channel.meta }, { $set: { typeVersion: TYPE_VERSION } });
  }

  let newestId = state.newestId;
  let oldestId = state.oldestId;
  let backfillDone = Boolean(state.backfillDone);
  const save = async (messages: DiscordMessage[]) => {
    if (!messages.length) return;
    await logs.bulkWrite(
      messages.map((m) => ({ replaceOne: { filter: { _id: m.id } as never, replacement: toEntry(m, channel.key) as never, upsert: true } })),
      { ordered: false },
    );
    const ids = messages.map((m) => m.id);
    newestId = newestId ? maxId([newestId, ...ids]) : maxId(ids);
    oldestId = oldestId ? minId([oldestId, ...ids]) : minId(ids);
  };

  try {
    // New messages since last time
    for (let i = 0; i < NEW_PAGES_PER_SYNC; i += 1) {
      const page = await fetchPage(channel.id, newestId ? `&after=${newestId}` : "");
      if (!page) break;
      await save(page);
      if (page.length < 100 || !newestId) break;
    }
    // Older history, a few pages per sync until the start of the channel
    for (let i = 0; i < BACKFILL_PAGES_PER_SYNC && !backfillDone && oldestId; i += 1) {
      const page = await fetchPage(channel.id, `&before=${oldestId}`);
      if (!page) break;
      await save(page);
      if (page.length < 100) backfillDone = true;
    }
  } finally {
    await meta.updateOne({ _id: channel.meta }, { $set: { newestId, oldestId, backfillDone, syncedAt: new Date() }, $unset: { lockedUntil: "" } });
  }
}

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Store and inventory activity (purchases, gifts, items given or taken): admins only. */
export const ADMIN_ONLY_LOG_TYPES = /gift|store|shop|purchase|bought|inventory|items? (added|removed|given|taken)|redeem/i;

export async function queryLogs(q: {
  /** Leave out store and inventory logs (for staff who aren't admins) */
  hideAdminOnly?: boolean;
  types?: string[];
  categories?: string[];
  channels?: string[];
  userId?: string;
  search?: string;
  from?: Date | null;
  to?: Date | null;
  order?: "asc" | "desc";
  before?: string;
  after?: string;
  limit?: number;
}) {
  const d = await db();
  const logs = d.collection("bot_logs");
  const match: Document = {};
  if (q.types?.length || q.categories?.length) {
    const or: Document[] = [];
    if (q.types?.length) or.push({ type: { $in: q.types } });
    if (q.categories?.length) or.push({ category: { $in: q.categories } });
    match.$or = or;
  }
  if (q.hideAdminOnly) match.type = { $not: ADMIN_ONLY_LOG_TYPES };
  if (q.userId) match.userIds = q.userId;
  if (q.channels?.length) match.channel = { $in: q.channels };
  if (q.search?.trim()) match.text = { $regex: escapeRegex(q.search.trim().toLowerCase().slice(0, 100)) };
  if (q.from || q.to) match.ts = { ...(q.from ? { $gte: q.from } : {}), ...(q.to ? { $lte: q.to } : {}) };

  // Keyset paging so new logs arriving don't shift the pages you've already loaded
  const order = q.order === "asc" ? 1 : -1;
  const page: Document = { ...match };
  if (q.before) page._id = { $lt: q.before };
  if (q.after) page._id = { $gt: q.after };
  const limit = Math.min(100, Math.max(10, q.limit ?? 40));

  // Type counts ignore the type filter itself, so the list doesn't collapse when you pick one
  const withoutType = { ...match };
  delete withoutType.$or;
  const [rows, total, types, meta, oldest] = await Promise.all([
    logs.find(page, { projection: { text: 0 } }).sort({ ts: order, _id: order }).limit(limit).toArray(),
    logs.countDocuments(match),
    logs.aggregate([{ $match: withoutType }, { $group: { _id: { type: "$type", category: "$category" }, n: { $sum: 1 } } }, { $sort: { n: -1 } }]).toArray(),
    d.collection("bot_logs_meta").find({ _id: { $in: LOG_CHANNELS.map((c) => c.meta) } as never }).toArray(),
    logs.find({}, { projection: { ts: 1 } }).sort({ ts: 1 }).limit(1).toArray(),
  ]);

  return {
    rows: rows.map((r) => ({ ...r, id: String(r._id), ts: (r.ts as Date).toISOString() })) as unknown as LogEntry[],
    total,
    types: types.map((t) => ({ type: String(t._id.type), category: String(t._id.category ?? logCategory(String(t._id.type))), count: t.n as number })),
    sync: {
      backfillDone: meta.length === LOG_CHANNELS.length && meta.every((m) => Boolean(m.backfillDone)),
      oldest: oldest[0]?.ts ? (oldest[0].ts as Date).toISOString() : null,
    },
  };
}

/** Discord attachment links carry their expiry as hex seconds in "ex". */
function linkStillValid(url: string | undefined) {
  if (!url) return false;
  const ex = new URL(url).searchParams.get("ex");
  return ex ? parseInt(ex, 16) * 1000 - Date.now() > 5 * 60_000 : false;
}

/** A working link for a logged attachment: the saved one while it's valid, else a fresh one from Discord. */
export async function freshAttachmentUrl(messageId: string, attachmentId: string) {
  if (!/^\d{15,21}$/.test(messageId)) return null;
  const d = await db();
  const logs = d.collection("bot_logs");
  const doc = await logs.findOne({ _id: messageId as never }, { projection: { attachments: 1, channel: 1 } });
  const channelId = LOG_CHANNELS.find((c) => c.key === doc?.channel)?.id ?? LOG_CHANNEL_ID;
  const saved = (doc?.attachments as { id: string; url?: string }[] | undefined)?.find((a) => a.id === attachmentId);
  if (saved?.url && linkStillValid(saved.url)) return saved.url;

  const token = botToken();
  if (!token) return null;
  const response = await fetch(`${DISCORD_API}/channels/${channelId}/messages/${messageId}`, { headers: { Authorization: `Bot ${token}` }, cache: "no-store" });
  if (!response.ok) return null;
  const message = (await response.json()) as { attachments: { id: string; url: string }[] };
  // Save every fresh link on the message so its other files don't need another lookup
  if (doc) {
    await logs.updateOne(
      { _id: messageId as never },
      { $set: Object.fromEntries(message.attachments.map((a) => [`attachments.$[a${a.id}].url`, a.url])) },
      { arrayFilters: message.attachments.map((a) => ({ [`a${a.id}.id`]: a.id })) },
    ).catch(() => undefined);
  }
  return message.attachments.find((a) => a.id === attachmentId)?.url ?? null;
}
