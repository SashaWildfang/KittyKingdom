// The staff log channel (where the main bot's updater.py and other cogs post), mirrored into
// Mongo so staff can search, filter and sort every log instantly. New messages are pulled on
// every request (at most every few seconds); older history is backfilled a few pages at a time.

import type { Document } from "mongodb";
import { DISCORD_API, botToken } from "./discord-member";
import { getMongoClient } from "./mongodb";

export const LOG_CHANNEL_ID = "1360344042705256660";

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
  attachments: { id: string; filename: string; size: number; content_type?: string }[];
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
  subjectId: string | null;
  userIds: string[];
  attachments: { id: string; filename: string; size: number; image: boolean }[];
  postedBy: string;
};

async function db() {
  const client = await getMongoClient();
  return client.db(process.env.MONGODB_DB ?? "website");
}

// Emojis and symbols before the first letter or number
const LEADING_SYMBOLS = new RegExp("^[^\\p{L}\\p{N}]+", "u");

/** "🖼️ Avatar Changed: sasha" -> "Avatar Changed", "🌹 Gift Sent • Single Rose" -> "Gift Sent" */
export function logType(title: string | undefined, content: string) {
  const raw = (title ?? content.split("\n")[0] ?? "").replace(/<[^>]+>/g, "");
  const cleaned = raw
    .replace(LEADING_SYMBOLS, "")
    .split(/\s[•|—-]\s|:\s/)[0]
    .replace(/[!.]+$/, "")
    .trim();
  return cleaned.slice(0, 60) || "Other";
}

function toEntry(m: DiscordMessage) {
  const embed = m.embeds[0];
  const allText = [m.content, ...m.embeds.flatMap((e) => [e.title, e.description, e.footer?.text, ...(e.fields ?? []).flatMap((f) => [f.name, f.value])])]
    .filter(Boolean)
    .join("\n");
  // The updater puts the member's id in the footer ("User ID: 123 • 9/26/2026 ...")
  const footerId = embed?.footer?.text?.match(/User ID:\s*(\d{15,21})/)?.[1] ?? null;
  const mentioned = Array.from(allText.matchAll(/<@!?(\d{15,21})>/g), (x) => x[1]);
  const codeIds = Array.from(allText.matchAll(/`(\d{17,21})`/g), (x) => x[1]);
  const userIds = Array.from(new Set([footerId, ...mentioned, ...codeIds].filter((x): x is string => Boolean(x))));
  return {
    _id: m.id,
    ts: new Date(m.timestamp),
    type: logType(embed?.title, m.content),
    title: embed?.title ?? null,
    description: embed?.description ?? null,
    content: m.content || null,
    color: typeof embed?.color === "number" ? `#${embed.color.toString(16).padStart(6, "0")}` : null,
    authorName: embed?.author?.name ?? null,
    authorIcon: embed?.author?.icon_url ?? null,
    fields: (embed?.fields ?? []).map((f) => ({ name: f.name, value: f.value, inline: Boolean(f.inline) })),
    footer: embed?.footer?.text ?? null,
    subjectId: footerId ?? mentioned[0] ?? null,
    userIds,
    attachments: m.attachments.map((a) => ({ id: a.id, filename: a.filename, size: a.size, image: Boolean(a.content_type?.startsWith("image/")) })),
    postedBy: m.author.username,
    text: allText.toLowerCase(),
  };
}

async function fetchPage(params: string): Promise<DiscordMessage[] | null> {
  const token = botToken();
  if (!token) return null;
  const response = await fetch(`${DISCORD_API}/channels/${LOG_CHANNEL_ID}/messages?limit=100${params}`, {
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
  const d = await db();
  const logs = d.collection("bot_logs");
  const meta = d.collection<{ _id: string; newestId?: string; oldestId?: string; backfillDone?: boolean; syncedAt?: Date; lockedUntil?: Date }>("bot_logs_meta");
  const now = new Date();
  await meta.updateOne({ _id: "sync" }, { $setOnInsert: { syncedAt: new Date(0) } }, { upsert: true });
  const state = await meta.findOneAndUpdate(
    {
      _id: "sync",
      syncedAt: { $lt: new Date(now.getTime() - SYNC_EVERY_MS) },
      $or: [{ lockedUntil: { $lt: now } }, { lockedUntil: { $exists: false } }],
    },
    { $set: { lockedUntil: new Date(now.getTime() + 20_000) } },
  );
  if (!state) return;

  let newestId = state.newestId;
  let oldestId = state.oldestId;
  let backfillDone = Boolean(state.backfillDone);
  const save = async (messages: DiscordMessage[]) => {
    if (!messages.length) return;
    await logs.bulkWrite(
      messages.map((m) => ({ replaceOne: { filter: { _id: m.id } as never, replacement: toEntry(m) as never, upsert: true } })),
      { ordered: false },
    );
    const ids = messages.map((m) => m.id);
    newestId = newestId ? maxId([newestId, ...ids]) : maxId(ids);
    oldestId = oldestId ? minId([oldestId, ...ids]) : minId(ids);
  };

  try {
    // New messages since last time
    for (let i = 0; i < NEW_PAGES_PER_SYNC; i += 1) {
      const page = await fetchPage(newestId ? `&after=${newestId}` : "");
      if (!page) break;
      await save(page);
      if (page.length < 100 || !newestId) break;
    }
    // Older history, a few pages per sync until the start of the channel
    for (let i = 0; i < BACKFILL_PAGES_PER_SYNC && !backfillDone && oldestId; i += 1) {
      const page = await fetchPage(`&before=${oldestId}`);
      if (!page) break;
      await save(page);
      if (page.length < 100) backfillDone = true;
    }
  } finally {
    await meta.updateOne({ _id: "sync" }, { $set: { newestId, oldestId, backfillDone, syncedAt: new Date() }, $unset: { lockedUntil: "" } });
  }
}

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export async function queryLogs(q: {
  types?: string[];
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
  if (q.types?.length) match.type = { $in: q.types };
  if (q.userId) match.userIds = q.userId;
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
  delete withoutType.type;
  const [rows, total, types, meta, oldest] = await Promise.all([
    logs.find(page, { projection: { text: 0 } }).sort({ ts: order, _id: order }).limit(limit).toArray(),
    logs.countDocuments(match),
    logs.aggregate([{ $match: withoutType }, { $group: { _id: "$type", n: { $sum: 1 } } }, { $sort: { n: -1 } }]).toArray(),
    d.collection("bot_logs_meta").findOne({ _id: "sync" as never }),
    logs.find({}, { projection: { ts: 1 } }).sort({ ts: 1 }).limit(1).toArray(),
  ]);

  return {
    rows: rows.map((r) => ({ ...r, id: String(r._id), ts: (r.ts as Date).toISOString() })) as unknown as LogEntry[],
    total,
    types: types.map((t) => ({ type: String(t._id), count: t.n as number })),
    sync: {
      backfillDone: Boolean(meta?.backfillDone),
      oldest: oldest[0]?.ts ? (oldest[0].ts as Date).toISOString() : null,
    },
  };
}

/** A fresh link for a logged attachment (Discord's links expire). */
export async function freshAttachmentUrl(messageId: string, attachmentId: string) {
  const token = botToken();
  if (!token || !/^\d{15,21}$/.test(messageId)) return null;
  const response = await fetch(`${DISCORD_API}/channels/${LOG_CHANNEL_ID}/messages/${messageId}`, { headers: { Authorization: `Bot ${token}` }, cache: "no-store" });
  if (!response.ok) return null;
  const message = (await response.json()) as { attachments: { id: string; url: string }[] };
  return message.attachments.find((a) => a.id === attachmentId)?.url ?? null;
}
