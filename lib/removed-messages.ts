// Admin → Removed messages: archives the Moderation bot made when it removed messages (people who left,
// deleted accounts, /wipe, and old /wipe logs it imported). Messages are in zeo_bot.cleanup_archive_messages;
// media lives as attachments in a private storage channel and is streamed through the bot token
// (Moderation db/archive_store.py writes all of this).

import { ObjectId, type Document } from "mongodb";
import { DISCORD_API, botToken } from "./discord-member";
import { getBotCollection } from "./mongodb";

export class RemovedError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

export type ArchiveRow = {
  id: string;
  userId: string | null;
  name: string;
  reason: string;
  source: string;
  at: string | null;
  messages: number;
  files: number;
  bytes: number;
  channels: string[];
  status: string;
};

export type ArchivedFile = { name: string; type: string; size: number; url: string | null };
export type ArchivedMessage = { id: string; messageId: string | null; channel: string; at: string | null; content: string; links: string[]; stickers: string[]; files: ArchivedFile[] };

const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : typeof v === "string" ? v : null);
const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function toRow(d: Document): ArchiveRow {
  return {
    id: String(d._id),
    userId: d.userId ? String(d.userId) : null,
    name: String(d.name ?? "Unknown"),
    reason: String(d.reason ?? "cleanup"),
    source: String(d.source ?? "cleanup"),
    at: iso(d.at),
    messages: Number(d.messages ?? 0),
    files: Number(d.files ?? 0),
    bytes: Number(d.bytes ?? 0),
    channels: Array.isArray(d.channels) ? d.channels.map(String) : [],
    status: String(d.status ?? "ready"),
  };
}

export async function listArchives(q: { search?: string; reason?: string; page?: number }) {
  const filter: Document = {};
  const search = (q.search ?? "").trim().slice(0, 80);
  if (search) filter.$or = [{ name: { $regex: escapeRegex(search), $options: "i" } }, { userId: search }];
  if (q.reason && ["left", "deleted", "wipe", "manual"].includes(q.reason)) filter.reason = q.reason;
  const page = Math.max(1, Math.min(500, Number(q.page) || 1));
  const pageSize = 30;
  const col = await getBotCollection("cleanup_archives");
  const [rows, total, totals] = await Promise.all([
    col.find(filter).sort({ at: -1 }).skip((page - 1) * pageSize).limit(pageSize).toArray(),
    col.countDocuments(filter),
    col.aggregate([{ $group: { _id: null, archives: { $sum: 1 }, messages: { $sum: "$messages" }, files: { $sum: "$files" }, bytes: { $sum: "$bytes" } } }]).toArray(),
  ]);
  const t = totals[0] ?? {};
  return {
    rows: rows.map(toRow),
    total,
    page,
    pageSize,
    totals: { archives: Number(t.archives ?? 0), messages: Number(t.messages ?? 0), files: Number(t.files ?? 0), bytes: Number(t.bytes ?? 0) },
  };
}

function fileUrl(f: Document) {
  if (f.missing || !f.c || !f.m || typeof f.i !== "number") return null;
  return `/api/admin/removed/media/${f.c}/${f.m}/${f.i}?name=${encodeURIComponent(String(f.name ?? "file"))}`;
}

export async function getArchive(id: string, q: { channel?: string; search?: string; media?: boolean; page?: number }) {
  if (!ObjectId.isValid(id)) throw new RemovedError("Unknown archive.", 404);
  const _id = new ObjectId(id);
  const doc = await (await getBotCollection("cleanup_archives")).findOne({ _id });
  if (!doc) throw new RemovedError("Unknown archive.", 404);
  const filter: Document = { archiveId: _id };
  if (q.channel) filter.channelName = q.channel;
  const search = (q.search ?? "").trim().slice(0, 80);
  if (search) filter.content = { $regex: escapeRegex(search), $options: "i" };
  if (q.media) filter["files.0"] = { $exists: true };
  const page = Math.max(1, Math.min(1000, Number(q.page) || 1));
  const pageSize = 100;
  const col = await getBotCollection("cleanup_archive_messages");
  const [rows, total, perChannel] = await Promise.all([
    col.find(filter).sort({ at: 1, _id: 1 }).skip((page - 1) * pageSize).limit(pageSize).toArray(),
    col.countDocuments(filter),
    col.aggregate([{ $match: { archiveId: _id } }, { $group: { _id: "$channelName", n: { $sum: 1 } } }, { $sort: { n: -1 } }]).toArray(),
  ]);
  return {
    archive: toRow(doc),
    channels: perChannel.map((c) => ({ name: String(c._id ?? "unknown"), count: Number(c.n) })),
    messages: rows.map(
      (m): ArchivedMessage => ({
        id: String(m._id),
        messageId: m.messageId ? String(m.messageId) : null,
        channel: String(m.channelName ?? "unknown"),
        at: iso(m.at),
        content: String(m.content ?? ""),
        links: Array.isArray(m.links) ? m.links.map(String).filter((u: string) => /^https?:\/\//.test(u)) : [],
        stickers: Array.isArray(m.stickers) ? m.stickers.map(String) : [],
        files: (Array.isArray(m.files) ? m.files : []).map((f: Document) => ({ name: String(f.name ?? "file"), type: String(f.type ?? ""), size: Number(f.size ?? 0), url: fileUrl(f) })),
      }),
    ),
    total,
    page,
    pageSize,
  };
}

/** The storage channel media may come from (so the media route can't be used to read other channels). */
async function storageChannelIds() {
  const cfg = (await (await getBotCollection("bot_config")).findOne({ _id: "cleanup_storage" } as never)) as { channelId?: string } | null;
  const ids = new Set<string>();
  if (cfg?.channelId) ids.add(String(cfg.channelId));
  const s = (await (await getBotCollection("bot_settings")).findOne({ _id: "moderation" } as never)) as { values?: { cleanup?: { storageChannel?: string } } } | null;
  if (s?.values?.cleanup?.storageChannel) ids.add(String(s.values.cleanup.storageChannel));
  return ids;
}

const linkCache = new Map<string, { urls: { url: string; filename: string; content_type?: string; size: number }[]; at: number }>();

/** A fresh CDN link for one stored file. */
export async function storedFile(channelId: string, messageId: string, index: number) {
  if (!/^\d{15,25}$/.test(channelId) || !/^\d{15,25}$/.test(messageId) || !Number.isInteger(index) || index < 0 || index > 9) throw new RemovedError("Bad file.", 400);
  if (!(await storageChannelIds()).has(channelId)) throw new RemovedError("Not an archive file.", 403);
  const key = `${channelId}/${messageId}`;
  let hit = linkCache.get(key);
  if (!hit || Date.now() - hit.at > 20 * 60 * 1000) {
    const token = botToken();
    if (!token) throw new RemovedError("The website can't reach Discord.", 503);
    const res = await fetch(`${DISCORD_API}/channels/${channelId}/messages/${messageId}`, { headers: { Authorization: `Bot ${token}` }, cache: "no-store" });
    if (!res.ok) throw new RemovedError("That file isn't available any more.", 404);
    const msg = (await res.json()) as { attachments?: { url: string; filename: string; content_type?: string; size: number }[] };
    hit = { urls: msg.attachments ?? [], at: Date.now() };
    linkCache.set(key, hit);
    if (linkCache.size > 500) linkCache.delete(linkCache.keys().next().value as string);
  }
  const att = hit.urls[index];
  if (!att) throw new RemovedError("That file isn't available any more.", 404);
  return att;
}

/** Deletes an archive, its messages and its stored media. */
export async function deleteArchive(id: string) {
  if (!ObjectId.isValid(id)) throw new RemovedError("Unknown archive.", 404);
  const _id = new ObjectId(id);
  const msgs = await getBotCollection("cleanup_archive_messages");
  const stored = new Set<string>();
  for await (const m of msgs.find({ archiveId: _id }, { projection: { files: 1 } })) {
    for (const f of (m.files ?? []) as Document[]) if (f.c && f.m) stored.add(`${f.c}/${f.m}`);
  }
  const token = botToken();
  const allowed = await storageChannelIds();
  let removedFiles = 0;
  for (const key of Array.from(stored)) {
    const [c, m] = key.split("/");
    if (!token || !allowed.has(c)) continue;
    const res = await fetch(`${DISCORD_API}/channels/${c}/messages/${m}`, { method: "DELETE", headers: { Authorization: `Bot ${token}` } }).catch(() => null);
    if (res?.ok || res?.status === 404) removedFiles++;
    await new Promise((r) => setTimeout(r, 300));
  }
  await msgs.deleteMany({ archiveId: _id });
  await (await getBotCollection("cleanup_archives")).deleteOne({ _id });
  return { removedFiles };
}
