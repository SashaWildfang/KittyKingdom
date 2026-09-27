// Admin -> Live Chat: messages as they're sent, channel activity and who's in voice. The bot
// (main_bot/events/live_chat.py) writes everything to the website database; this reads it for
// one viewer, showing only channels that viewer can see in Discord (minus the ones they've hidden).

import { type Document } from "mongodb";
import { deleteChannelMessage, getGuildChannelsRaw, guildId, viewableChannelIds, type RawChannel } from "./discord-member";
import { getMongoClient, getStaffCollection } from "./mongodb";

/** Images in these categories are always blurred until clicked (Nudes Section). */
export const SPOILER_CATEGORY_IDS = new Set(["1358488251996045388"]);
const BOT_OFFLINE_AFTER_MS = 90_000;
const TEXT_TYPES = new Set([0, 5, 15, 16]); // text, announcement, forum, media
const VOICE_TYPES = new Set([2, 13]);
const UNREAD_WINDOW_MS = 24 * 3_600_000; // older messages never count as unread

export type LiveMedia = { url: string; width: number | null; height: number | null };
export type LiveEmbed = {
  type: string | null;
  url: string | null;
  title: string | null;
  description: string | null;
  color: string | null;
  author: { name: string; url: string | null; icon: string | null } | null;
  fields: { name: string; value: string; inline: boolean }[];
  footer: { text: string; icon: string | null } | null;
  timestamp: string | null;
  thumbnail: LiveMedia | null;
  image: LiveMedia | null;
  video: LiveMedia | null;
  provider: string | null;
};
export type LiveAttachment = { id: string; filename: string; contentType: string | null; width: number | null; height: number | null; size: number | null; spoiler: boolean; image: boolean; video: boolean; audio: boolean };
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
  embeds: LiveEmbed[];
  stickers: { id: string | null; name: string; url: string | null }[];
  reply: { id: string; authorId: string | null; authorName: string | null; avatar: string | null; content: string | null; hasMedia: boolean } | null;
  forwarded: { content: string; attachments: LiveAttachment[]; embeds: LiveEmbed[] } | null;
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
const str = (v: unknown) => (typeof v === "string" && v ? v : null);
const num = (v: unknown) => (typeof v === "number" ? v : null);

function toMedia(m: unknown): LiveMedia | null {
  if (typeof m === "string") return m ? { url: m, width: null, height: null } : null;
  const o = m as Document | null;
  return o && str(o.url) ? { url: String(o.url), width: num(o.width), height: num(o.height) } : null;
}

function toEmbed(e: Document): LiveEmbed {
  return {
    type: str(e.type),
    url: str(e.url),
    title: str(e.title),
    description: str(e.description),
    color: str(e.color),
    author: e.author && str(e.author.name) ? { name: String(e.author.name), url: str(e.author.url), icon: str(e.author.icon) } : null,
    fields: ((e.fields ?? []) as Document[]).map((f) => ({ name: String(f.name ?? ""), value: String(f.value ?? ""), inline: Boolean(f.inline) })),
    footer: e.footer && str(e.footer.text) ? { text: String(e.footer.text), icon: str(e.footer.icon) } : null,
    timestamp: str(e.timestamp),
    thumbnail: toMedia(e.thumbnail),
    // Older records kept the picture as a plain "image" url
    image: toMedia(e.image),
    video: toMedia(e.video),
    provider: str(e.provider),
  };
}

function toAttachment(a: Document): LiveAttachment {
  const type = a.contentType ? String(a.contentType) : null;
  const name = String(a.filename ?? "file");
  return {
    id: String(a.id),
    filename: name.replace(/^SPOILER_/, ""),
    contentType: type,
    width: num(a.width),
    height: num(a.height),
    size: num(a.size),
    spoiler: Boolean(a.spoiler),
    image: type ? type.startsWith("image/") : /\.(png|jpe?g|gif|webp)$/i.test(name),
    video: type ? type.startsWith("video/") : /\.(mp4|webm|mov)$/i.test(name),
    audio: type ? type.startsWith("audio/") : /\.(mp3|ogg|wav|m4a)$/i.test(name),
  };
}

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
    attachments: ((d.attachments ?? []) as Document[]).map(toAttachment),
    embeds: ((d.embeds ?? []) as Document[]).map(toEmbed),
    stickers: ((d.stickers ?? []) as unknown[]).map((st) =>
      typeof st === "string" ? { id: null, name: st, url: null } : { id: str((st as Document).id), name: String((st as Document).name ?? "sticker"), url: str((st as Document).url) },
    ),
    reply: d.reply
      ? {
          id: String(d.reply.id),
          authorId: str(d.reply.authorId),
          authorName: str(d.reply.authorName),
          avatar: str(d.reply.avatar),
          content: typeof d.reply.content === "string" ? d.reply.content : null,
          hasMedia: Boolean(d.reply.hasMedia),
        }
      : null,
    forwarded: d.forwarded
      ? {
          content: String(d.forwarded.content ?? ""),
          attachments: ((d.forwarded.attachments ?? []) as Document[]).map(toAttachment),
          embeds: ((d.forwarded.embeds ?? []) as Document[]).map(toEmbed),
        }
      : null,
    edited: Boolean(d.edited),
    deleted: Boolean(d.deleted),
    deletedBy: d.deletedBy ? String(d.deletedBy) : null,
    forceSpoiler: Boolean(categoryId && SPOILER_CATEGORY_IDS.has(categoryId)),
    updatedAt: iso(d.updatedAt ?? d.ts),
  };
}

// ==========================================
// Per-staff settings: hidden channels, auto-follow and what they've read (saved on the server,
// so they follow them to any device and survive logging out)
// ==========================================
export type LivePrefs = { hidden: string[]; autoFollow: boolean; readAt: Record<string, string>; baseline: string };

async function prefsCollection() {
  return (await db()).collection("admin_prefs");
}

export async function getLivePrefs(viewerId: string): Promise<LivePrefs> {
  const col = await prefsCollection();
  const doc = await col.findOne({ _id: viewerId as never });
  if (!doc?.live) {
    // First visit: everything before now counts as read
    const fresh: LivePrefs = { hidden: [], autoFollow: false, readAt: {}, baseline: new Date().toISOString() };
    await col.updateOne({ _id: viewerId as never }, { $set: { live: fresh } }, { upsert: true });
    return fresh;
  }
  const live = doc.live as Document;
  return {
    hidden: Array.isArray(live.hidden) ? live.hidden.map(String) : [],
    autoFollow: Boolean(live.autoFollow),
    readAt: (live.readAt ?? {}) as Record<string, string>,
    baseline: str(live.baseline) ?? new Date().toISOString(),
  };
}

export async function saveLivePrefs(viewerId: string, patch: { hidden?: unknown; autoFollow?: unknown }) {
  const set: Document = {};
  if (Array.isArray(patch.hidden)) set["live.hidden"] = Array.from(new Set(patch.hidden.filter((x) => typeof x === "string" && /^\d{15,21}$/.test(x)))).slice(0, 300);
  if (typeof patch.autoFollow === "boolean") set["live.autoFollow"] = patch.autoFollow;
  if (Object.keys(set).length) {
    await getLivePrefs(viewerId);
    await (await prefsCollection()).updateOne({ _id: viewerId as never }, { $set: set });
  }
  return getLivePrefs(viewerId);
}

/** Marks messages as read: { channelId: newestReadTs } for some channels, or everything. */
export async function markLiveRead(viewerId: string, read: { channels?: Record<string, unknown>; all?: boolean }) {
  const prefs = await getLivePrefs(viewerId);
  const col = await prefsCollection();
  if (read.all) {
    await col.updateOne({ _id: viewerId as never }, { $set: { "live.baseline": new Date().toISOString(), "live.readAt": {} } });
    return;
  }
  const cutoff = Date.now() - UNREAD_WINDOW_MS;
  const readAt: Record<string, string> = {};
  // Keep only recent entries so the document stays small
  for (const [id, at] of Object.entries(prefs.readAt)) if (Date.parse(at) > cutoff) readAt[id] = at;
  for (const [id, at] of Object.entries(read.channels ?? {})) {
    if (!/^\d{15,21}$/.test(id) || typeof at !== "string" || Number.isNaN(Date.parse(at))) continue;
    const ts = new Date(Math.min(Date.parse(at), Date.now())).toISOString();
    if (!readAt[id] || Date.parse(readAt[id]) < Date.parse(ts)) readAt[id] = ts;
  }
  await col.updateOne({ _id: viewerId as never }, { $set: { "live.readAt": readAt } });
}

/** Unread messages per channel (threads count toward their channel). */
async function unreadCounts(filter: Document, prefs: LivePrefs) {
  const col = (await db()).collection("live_messages");
  const floor = new Date(Math.max(Date.parse(prefs.baseline), Date.now() - UNREAD_WINDOW_MS));
  const branches = Object.entries(prefs.readAt)
    .filter(([, at]) => Date.parse(at) > floor.getTime())
    .map(([id, at]) => ({ case: { $eq: ["$ck", id] }, then: new Date(at) }));
  const rows = await col
    .aggregate([
      { $match: { ...filter, ts: { $gt: floor } } },
      { $addFields: { ck: { $ifNull: ["$parentId", "$channelId"] } } },
      ...(prefs.hidden.length ? [{ $match: { ck: { $nin: prefs.hidden } } }] : []),
      ...(branches.length ? [{ $match: { $expr: { $gt: ["$ts", { $switch: { branches, default: floor } }] } } }] : []),
      { $group: { _id: "$ck", n: { $sum: 1 } } },
    ])
    .toArray();
  return Object.fromEntries(rows.map((r) => [String(r._id), r.n as number])) as Record<string, number>;
}

/** Channels (and threads inside them) the viewer may read. */
async function visibleFilter(viewerId: string) {
  const ids = Array.from(await viewableChannelIds(viewerId));
  return { ids, filter: { $or: [{ channelId: { $in: ids } }, { parentId: { $in: ids } }] } as Document };
}

/** Total unread for the Live Chat tab's bubble. */
export async function liveUnreadTotal(viewerId: string) {
  const [{ filter }, prefs] = await Promise.all([visibleFilter(viewerId), getLivePrefs(viewerId)]);
  const counts = await unreadCounts(filter, prefs);
  return Object.values(counts).reduce((a, b) => a + b, 0);
}

export type ChannelTile = {
  id: string;
  name: string;
  kind: "text" | "voice";
  nsfw: boolean;
  spoiler: boolean;
  hidden: boolean;
  count5: number;
  count60: number;
  unread: number;
  lastAt: string | null;
  lastAuthors: { id: string; name: string; avatar: string | null }[];
  voice: { id: string; name: string; avatar: string | null; muted: boolean; deafened: boolean; streaming: boolean; video: boolean }[];
};

export type LiveSnapshot = {
  bot: { online: boolean; lastSeen: string | null };
  messages: LiveMessage[];
  changed: LiveMessage[];
  categories: { id: string | null; name: string; channels: ChannelTile[] }[];
  stats: { perMinute: number; activeChannels: number; chatters: number; inVoice: number; unread: number };
  staff: Record<string, { rank: string; color: string | null }>;
  prefs: LivePrefs;
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

/** Replies the bot couldn't fill in (the original wasn't cached) come from our own copy. */
async function fillReplies(docs: Document[]) {
  const missing = Array.from(new Set(docs.filter((d) => d.reply?.id && !d.reply.authorName).map((d) => String(d.reply.id))));
  if (!missing.length) return;
  const originals = await (await db())
    .collection("live_messages")
    .find({ _id: { $in: missing as never[] } }, { projection: { authorId: 1, displayName: 1, avatar: 1, content: 1, attachments: 1, embeds: 1 } })
    .toArray();
  const byId = new Map(originals.map((o) => [String(o._id), o]));
  for (const d of docs) {
    const o = d.reply?.id ? byId.get(String(d.reply.id)) : null;
    if (o) {
      d.reply = { ...d.reply, authorId: o.authorId, authorName: o.displayName, avatar: o.avatar, content: String(o.content ?? "").slice(0, 300), hasMedia: Boolean(o.attachments?.length || o.embeds?.length) };
    }
  }
}

/** Staff rank labels (and colors) for the people in view, from the bot-synced staff list. */
async function staffRanks(ids: string[]) {
  if (!ids.length) return {};
  const docs = await (await getStaffCollection()).find({ _id: { $in: ids as never[] } }, { projection: { role: 1, role_color: 1 } }).toArray();
  return Object.fromEntries(docs.map((d) => [String(d._id), { rank: String(d.role ?? "Staff"), color: str(d.role_color) }]));
}

/**
 * One poll of the live view: new messages after `afterTs`, messages edited/deleted since
 * `since`, the channel map and unread counts. `channels` narrows the feed to those channels.
 */
export async function liveSnapshot(viewerId: string, q: { afterTs?: string | null; since?: string | null; channels?: string[]; limit?: number }): Promise<LiveSnapshot> {
  const d = await db();
  const col = d.collection("live_messages");
  const [{ ids, filter }, channels, meta, voiceDocs, prefs] = await Promise.all([
    visibleFilter(viewerId),
    getGuildChannelsRaw(),
    d.collection("live_meta").findOne({ _id: "bot" as never }),
    d.collection("live_voice").find({}).toArray(),
    getLivePrefs(viewerId),
  ]);
  const visible = new Set(ids);
  const hidden = new Set(prefs.hidden);
  const focus = (q.channels ?? []).filter((c) => visible.has(c));
  const shown = focus.length ? focus : ids.filter((c) => !hidden.has(c));
  const scope: Document = { $or: [{ channelId: { $in: shown } }, { parentId: { $in: shown } }] };
  if (q.channels?.length && !focus.length) scope.channelId = "__none__";

  const limit = Math.min(200, Math.max(20, q.limit ?? 80));
  const after = q.afterTs ? new Date(q.afterTs) : null;
  const since = q.since ? new Date(q.since) : null;
  const hourAgo = new Date(Date.now() - 3_600_000);
  const fiveAgo = new Date(Date.now() - 300_000);

  const [newDocs, changedDocs, activity, unread, perMinute] = await Promise.all([
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
    unreadCounts(filter, prefs),
    col.countDocuments({ ...filter, ts: { $gte: new Date(Date.now() - 60_000) } }),
  ]);
  await fillReplies([...newDocs, ...changedDocs]);

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
        hidden: hidden.has(c.id),
        count5: a?.count5 ?? 0,
        count60: a?.count60 ?? 0,
        unread: unread[c.id] ?? 0,
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

  const recentAuthors = new Set<string>();
  for (const a of activity) if (!hidden.has(String(a._id))) for (const x of a.authors as Document[]) if (!x.bot) recentAuthors.add(String(x.id));
  const messages = newDocs.map(toMessage);
  const changed = changedDocs.map(toMessage);
  const authorIds = Array.from(new Set([...messages, ...changed].flatMap((m) => [m.authorId, m.reply?.authorId ?? ""]).filter(Boolean)));
  const lastSeen = meta?.at instanceof Date ? meta.at : null;
  return {
    bot: { online: Boolean(lastSeen && Date.now() - lastSeen.getTime() < BOT_OFFLINE_AFTER_MS), lastSeen: lastSeen?.toISOString() ?? null },
    messages,
    changed,
    categories,
    stats: {
      perMinute,
      activeChannels: activity.filter((a) => a.count5 > 0 && !hidden.has(String(a._id))).length,
      chatters: recentAuthors.size,
      inVoice: categories.reduce((n, c) => n + c.channels.reduce((m, ch) => m + ch.voice.length, 0), 0),
      unread: Object.values(unread).reduce((a, b) => a + b, 0),
    },
    staff: await staffRanks(authorIds),
    prefs,
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
  const doc = await d.collection("live_messages").findOne({ _id: messageId as never }, { projection: { attachments: 1, "forwarded.attachments": 1, channelId: 1, parentId: 1 } });
  if (!doc) return null;
  const visible = await viewableChannelIds(viewerId);
  if (!visible.has(String(doc.channelId)) && !(doc.parentId && visible.has(String(doc.parentId)))) return null;
  const saved = [...((doc.attachments ?? []) as Document[]), ...((doc.forwarded?.attachments ?? []) as Document[])].find((a) => String(a.id) === attachmentId);
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
