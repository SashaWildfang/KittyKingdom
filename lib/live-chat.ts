// Admin -> Live Chat: messages as they're sent, channel activity and who's in voice. The bot
// (main_bot/events/live_chat.py) writes everything to the website database; this reads it for
// one viewer, showing only channels that viewer can see in Discord.

import { type Document } from "mongodb";
import { deleteChannelMessage, getGuildChannelsRaw, guildId, viewableChannelIds, type RawChannel } from "./discord-member";
import { getMongoClient } from "./mongodb";

/** Images in these categories are always blurred until clicked (Nudes Section). */
export const SPOILER_CATEGORY_IDS = new Set(["1358488251996045388"]);
const BOT_OFFLINE_AFTER_MS = 90_000;
const TEXT_TYPES = new Set([0, 5, 15, 16]); // text, announcement, forum, media
const VOICE_TYPES = new Set([2, 13]);

export type LiveAttachment = { id: string; filename: string; contentType: string | null; width: number | null; height: number | null; size: number | null; spoiler: boolean; image: boolean; video: boolean };
export type LiveMessage = {
  id: string;
  ts: string;
  channelId: string;
  channelName: string;
  parentId: string | null;
  parentName: string | null;
  categoryId: string | null;
  categoryName: string | null;
  authorId: string;
  authorName: string;
  displayName: string;
  avatar: string | null;
  bot: boolean;
  content: string;
  attachments: LiveAttachment[];
  embeds: { url: string | null; title: string | null; description: string | null; image: string | null }[];
  stickers: string[];
  reply: { id: string; authorName: string | null; content: string | null } | null;
  edited: boolean;
  deleted: boolean;
  deletedBy: string | null;
  /** Blur images (spoiler category or Discord spoiler) */
  forceSpoiler: boolean;
  updatedAt: string;
};

async function db() {
  const client = await getMongoClient();
  return client.db(process.env.MONGODB_DB ?? "website");
}

const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : new Date(String(v ?? Date.now())).toISOString());

function toMessage(d: Document): LiveMessage {
  const categoryId = d.categoryId ? String(d.categoryId) : null;
  return {
    id: String(d._id),
    ts: iso(d.ts),
    channelId: String(d.channelId),
    channelName: String(d.channelName ?? "unknown"),
    parentId: d.parentId ? String(d.parentId) : null,
    parentName: d.parentName ? String(d.parentName) : null,
    categoryId,
    categoryName: d.categoryName ? String(d.categoryName) : null,
    authorId: String(d.authorId),
    authorName: String(d.authorName ?? ""),
    displayName: String(d.displayName ?? d.authorName ?? "Unknown"),
    avatar: d.avatar ? String(d.avatar) : null,
    bot: Boolean(d.bot),
    content: String(d.content ?? ""),
    attachments: ((d.attachments ?? []) as Document[]).map((a) => {
      const type = a.contentType ? String(a.contentType) : null;
      const name = String(a.filename ?? "file");
      return {
        id: String(a.id),
        filename: name.replace(/^SPOILER_/, ""),
        contentType: type,
        width: typeof a.width === "number" ? a.width : null,
        height: typeof a.height === "number" ? a.height : null,
        size: typeof a.size === "number" ? a.size : null,
        spoiler: Boolean(a.spoiler),
        image: type ? type.startsWith("image/") : /\.(png|jpe?g|gif|webp)$/i.test(name),
        video: type ? type.startsWith("video/") : /\.(mp4|webm|mov)$/i.test(name),
      };
    }),
    embeds: ((d.embeds ?? []) as Document[]).map((e) => ({ url: e.url ?? null, title: e.title ?? null, description: e.description ?? null, image: e.image ?? null })),
    stickers: ((d.stickers ?? []) as string[]).map(String),
    reply: d.reply ? { id: String(d.reply.id), authorName: d.reply.authorName ?? null, content: d.reply.content ?? null } : null,
    edited: Boolean(d.edited),
    deleted: Boolean(d.deleted),
    deletedBy: d.deletedBy ? String(d.deletedBy) : null,
    forceSpoiler: Boolean(categoryId && SPOILER_CATEGORY_IDS.has(categoryId)),
    updatedAt: iso(d.updatedAt ?? d.ts),
  };
}

/** Channels (and threads inside them) the viewer may read. */
async function visibleFilter(viewerId: string) {
  const ids = Array.from(await viewableChannelIds(viewerId));
  return { ids, filter: { $or: [{ channelId: { $in: ids } }, { parentId: { $in: ids } }] } as Document };
}

export type ChannelTile = {
  id: string;
  name: string;
  kind: "text" | "voice";
  nsfw: boolean;
  spoiler: boolean;
  count5: number;
  count60: number;
  lastAt: string | null;
  lastAuthors: { id: string; name: string; avatar: string | null }[];
  voice: { id: string; name: string; avatar: string | null; muted: boolean; deafened: boolean; streaming: boolean; video: boolean }[];
};

export type LiveSnapshot = {
  bot: { online: boolean; lastSeen: string | null };
  messages: LiveMessage[];
  changed: LiveMessage[];
  categories: { id: string | null; name: string; channels: ChannelTile[] }[];
  stats: { perMinute: number; activeChannels: number; chatters: number; inVoice: number };
  guildId: string | null;
  serverTime: string;
};

function groupChannels(channels: RawChannel[], visible: Set<string>) {
  const cats = new Map(channels.filter((c) => c.type === 4).map((c) => [c.id, c]));
  const groups = new Map<string | null, RawChannel[]>();
  for (const c of channels) {
    if (!visible.has(c.id) || !(TEXT_TYPES.has(c.type) || VOICE_TYPES.has(c.type))) continue;
    const key = c.parent_id && cats.has(c.parent_id) ? c.parent_id : null;
    groups.set(key, [...(groups.get(key) ?? []), c]);
  }
  return Array.from(groups.entries())
    .map(([id, list]) => ({
      id,
      name: id ? cats.get(id)!.name : "No category",
      position: id ? cats.get(id)!.position : -1,
      channels: list.sort((a, b) => Number(VOICE_TYPES.has(a.type)) - Number(VOICE_TYPES.has(b.type)) || a.position - b.position),
    }))
    .sort((a, b) => a.position - b.position);
}

/**
 * One poll of the live view: new messages after `afterTs`, messages edited/deleted since
 * `since`, and the channel map. The first poll (no afterTs) returns the latest messages.
 */
export async function liveSnapshot(viewerId: string, q: { afterTs?: string | null; since?: string | null; channelId?: string | null; limit?: number }): Promise<LiveSnapshot> {
  const d = await db();
  const col = d.collection("live_messages");
  const [{ ids, filter }, channels, meta, voiceDocs] = await Promise.all([
    visibleFilter(viewerId),
    getGuildChannelsRaw(),
    d.collection("live_meta").findOne({ _id: "bot" as never }),
    d.collection("live_voice").find({}).toArray(),
  ]);
  const visible = new Set(ids);
  const scope: Document = { ...filter };
  if (q.channelId) {
    if (!visible.has(q.channelId)) scope.channelId = "__none__";
    else Object.assign(scope, { $or: [{ channelId: q.channelId }, { parentId: q.channelId }] });
  }

  const limit = Math.min(200, Math.max(20, q.limit ?? 80));
  const after = q.afterTs ? new Date(q.afterTs) : null;
  const since = q.since ? new Date(q.since) : null;
  const hourAgo = new Date(Date.now() - 3_600_000);
  const fiveAgo = new Date(Date.now() - 300_000);

  const [newDocs, changedDocs, activity] = await Promise.all([
    after
      ? col.find({ ...scope, ts: { $gte: after } }).sort({ ts: 1 }).limit(limit).toArray()
      : col.find(scope).sort({ ts: -1 }).limit(limit).toArray().then((r) => r.reverse()),
    since ? col.find({ ...scope, updatedAt: { $gt: since }, ...(after ? { ts: { $lt: after } } : {}) }).limit(200).toArray() : Promise.resolve([]),
    col
      .aggregate([
        { $match: { ...filter, ts: { $gte: hourAgo } } },
        { $sort: { ts: -1 } },
        {
          $group: {
            _id: { $ifNull: ["$parentId", "$channelId"] },
            count60: { $sum: 1 },
            count5: { $sum: { $cond: [{ $gte: ["$ts", fiveAgo] }, 1, 0] } },
            lastAt: { $first: "$ts" },
            authors: { $push: { id: "$authorId", name: "$displayName", avatar: "$avatar", bot: "$bot" } },
          },
        },
        { $project: { count60: 1, count5: 1, lastAt: 1, authors: { $slice: ["$authors", 25] } } },
      ])
      .toArray(),
  ]);

  const byChannel = new Map(activity.map((a) => [String(a._id), a]));
  const voiceBy = new Map(voiceDocs.map((v) => [String(v._id), (v.members ?? []) as Document[]]));
  const categories = groupChannels(channels, visible).map((g) => ({
    id: g.id,
    name: g.name,
    channels: g.channels.map((c): ChannelTile => {
      const a = byChannel.get(c.id);
      const seen = new Set<string>();
      const lastAuthors = ((a?.authors ?? []) as Document[])
        .filter((x) => !x.bot && !seen.has(x.id) && seen.add(x.id))
        .slice(0, 4)
        .map((x) => ({ id: String(x.id), name: String(x.name ?? ""), avatar: x.avatar ? String(x.avatar) : null }));
      return {
        id: c.id,
        name: c.name,
        kind: VOICE_TYPES.has(c.type) ? "voice" : "text",
        nsfw: Boolean(c.nsfw),
        spoiler: Boolean(g.id && SPOILER_CATEGORY_IDS.has(g.id)),
        count5: a?.count5 ?? 0,
        count60: a?.count60 ?? 0,
        lastAt: a?.lastAt ? iso(a.lastAt) : null,
        lastAuthors,
        voice: (voiceBy.get(c.id) ?? []).map((m) => ({
          id: String(m.id),
          name: String(m.name ?? ""),
          avatar: m.avatar ? String(m.avatar) : null,
          muted: Boolean(m.muted),
          deafened: Boolean(m.deafened),
          streaming: Boolean(m.streaming),
          video: Boolean(m.video),
        })),
      };
    }),
  }));

  // Chatters in the last hour (from each channel's recent authors) and messages in the last minute
  const recentAuthors = new Set<string>();
  for (const a of activity) for (const x of a.authors as Document[]) if (!x.bot) recentAuthors.add(String(x.id));
  const perMinuteCount = await col.countDocuments({ ...filter, ts: { $gte: new Date(Date.now() - 60_000) } });

  const lastSeen = meta?.at instanceof Date ? meta.at : null;
  return {
    bot: { online: Boolean(lastSeen && Date.now() - lastSeen.getTime() < BOT_OFFLINE_AFTER_MS), lastSeen: lastSeen?.toISOString() ?? null },
    messages: newDocs.map(toMessage),
    changed: changedDocs.map(toMessage),
    categories,
    stats: {
      perMinute: perMinuteCount,
      activeChannels: activity.filter((a) => a.count5 > 0).length,
      chatters: recentAuthors.size,
      inVoice: categories.reduce((n, c) => n + c.channels.reduce((m, ch) => m + ch.voice.length, 0), 0),
    },
    guildId: await guildId().catch(() => null),
    serverTime: new Date().toISOString(),
  };
}

export class LiveChatError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

/** Deletes a message in Discord (as the bot) for a staff member who can see its channel. */
export async function deleteLiveMessage(actor: { discordId: string; name: string }, messageId: string) {
  if (!/^\d{15,21}$/.test(messageId)) throw new LiveChatError("That message doesn't exist.", 404);
  const d = await db();
  const col = d.collection("live_messages");
  const doc = await col.findOne({ _id: messageId as never });
  if (!doc) throw new LiveChatError("That message is no longer in the live feed.", 404);
  const visible = await viewableChannelIds(actor.discordId);
  if (!visible.has(String(doc.channelId)) && !(doc.parentId && visible.has(String(doc.parentId)))) throw new LiveChatError("You can't see that channel.", 403);
  if (doc.deleted) return toMessage(doc);

  const result = await deleteChannelMessage(String(doc.channelId), messageId, `Deleted from the website Live Chat by ${actor.name}`);
  if (!result.ok) {
    throw new LiveChatError(result.status === 403 ? "The bot doesn't have permission to delete messages in that channel." : "Discord didn't delete it. Try again.", 502);
  }
  const at = new Date();
  await col.updateOne({ _id: messageId as never }, { $set: { deleted: true, deletedAt: at, deletedBy: actor.name, deletedById: actor.discordId, updatedAt: at } });
  return toMessage({ ...doc, deleted: true, deletedBy: actor.name, updatedAt: at });
}

/** A working link for a live message's file, if the viewer can see its channel. */
export async function liveAttachmentUrl(viewerId: string, messageId: string, attachmentId: string) {
  if (!/^\d{15,21}$/.test(messageId) || !/^\d{15,21}$/.test(attachmentId)) return null;
  const d = await db();
  const doc = await d.collection("live_messages").findOne({ _id: messageId as never }, { projection: { attachments: 1, channelId: 1, parentId: 1 } });
  if (!doc) return null;
  const visible = await viewableChannelIds(viewerId);
  if (!visible.has(String(doc.channelId)) && !(doc.parentId && visible.has(String(doc.parentId)))) return null;
  const saved = ((doc.attachments ?? []) as Document[]).find((a) => String(a.id) === attachmentId);
  const url = saved?.url ? String(saved.url) : null;
  // Discord's links carry their expiry in "ex" (hex seconds); refresh through the API when close
  const ex = url ? new URL(url).searchParams.get("ex") : null;
  if (url && (!ex || parseInt(ex, 16) * 1000 - Date.now() > 5 * 60_000)) return url;
  const { DISCORD_API, botToken } = await import("./discord-member");
  const token = botToken();
  if (!token) return url;
  const res = await fetch(`${DISCORD_API}/channels/${doc.channelId}/messages/${messageId}`, { headers: { Authorization: `Bot ${token}` }, cache: "no-store" });
  if (!res.ok) return url;
  const fresh = ((await res.json()) as { attachments: { id: string; url: string }[] }).attachments.find((a) => a.id === attachmentId)?.url ?? url;
  if (fresh && fresh !== url) {
    await d.collection("live_messages").updateOne({ _id: messageId as never, "attachments.id": attachmentId }, { $set: { "attachments.$.url": fresh } }).catch(() => undefined);
  }
  return fresh;
}
