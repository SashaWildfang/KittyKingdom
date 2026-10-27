// Announcements: write a message (text and/or an embed), pick a channel and who to ping, preview it, then post
// now or schedule it. Scheduled ones go out from the bot's status ping (every minute).
//
// website.announcements {_id, channelId, content, embed: {title, description, color, image} | null, ping: "" | "everyone" | "here" | roleId,
//                        sendAt, status: draft|scheduled|sending|sent|failed, messageId, error, createdBy, createdByName, sentAt, updatedAt}

import { ObjectId, type Document } from "mongodb";
import type { PanelUser } from "./admin";
import { discordRequest, getGuildChannelsRaw, guildId } from "./discord-member";
import { getMongoClient } from "./mongodb";

export type Announcement = {
  id: string;
  channelId: string;
  content: string;
  embed: { title: string; description: string; color: string; image: string } | null;
  ping: string;
  sendAt: string | null;
  status: "draft" | "scheduled" | "sending" | "sent" | "failed";
  messageId: string | null;
  error: string | null;
  createdBy: string;
  createdByName: string;
  sentAt: string | null;
  updatedAt: string;
};

export class AnnouncementError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : null);
async function col() {
  const c = (await getMongoClient()).db(process.env.MONGODB_DB ?? "website").collection("announcements");
  await c.createIndex({ status: 1, sendAt: 1 }).catch(() => undefined);
  return c;
}
const toA = (d: Document): Announcement => ({
  id: String(d._id),
  channelId: String(d.channelId ?? ""),
  content: String(d.content ?? ""),
  embed: d.embed ? { title: String(d.embed.title ?? ""), description: String(d.embed.description ?? ""), color: String(d.embed.color ?? "#f59b2a"), image: String(d.embed.image ?? "") } : null,
  ping: String(d.ping ?? ""),
  sendAt: iso(d.sendAt),
  status: d.status,
  messageId: d.messageId ? String(d.messageId) : null,
  error: d.error ? String(d.error) : null,
  createdBy: String(d.createdBy ?? ""),
  createdByName: String(d.createdByName ?? ""),
  sentAt: iso(d.sentAt),
  updatedAt: iso(d.updatedAt) ?? "",
});

export async function listAnnouncements() {
  const rows = await (await col()).find({}).sort({ status: 1, sendAt: 1, updatedAt: -1 }).limit(100).toArray();
  return rows.map(toA);
}

function clean(input: Record<string, unknown>) {
  const channelId = String(input.channelId ?? "");
  if (!/^\d{15,21}$/.test(channelId)) throw new AnnouncementError("Pick a channel.");
  const content = String(input.content ?? "").trim().slice(0, 2000);
  const e = (input.embed ?? null) as Record<string, unknown> | null;
  const embed = e && (String(e.title ?? "").trim() || String(e.description ?? "").trim() || String(e.image ?? "").trim())
    ? {
        title: String(e.title ?? "").trim().slice(0, 256),
        description: String(e.description ?? "").trim().slice(0, 4000),
        color: /^#[0-9a-f]{6}$/i.test(String(e.color ?? "")) ? String(e.color) : "#f59b2a",
        image: /^https:\/\/\S+$/i.test(String(e.image ?? "").trim()) ? String(e.image).trim().slice(0, 500) : "",
      }
    : null;
  if (!content && !embed) throw new AnnouncementError("Write a message or fill in the embed.");
  const ping = String(input.ping ?? "");
  if (ping && !["everyone", "here"].includes(ping) && !/^\d{15,21}$/.test(ping)) throw new AnnouncementError("Pick who to ping.");
  let sendAt: Date | null = null;
  if (input.sendAt) {
    sendAt = new Date(String(input.sendAt));
    if (Number.isNaN(sendAt.getTime())) throw new AnnouncementError("That send time isn't a date.");
    if (sendAt.getTime() < Date.now() - 60_000) throw new AnnouncementError("That send time is in the past.");
  }
  return { channelId, content, embed, ping, sendAt };
}

/** Save a draft, schedule it (sendAt), or send it right now (now: true). */
export async function saveAnnouncement(panel: PanelUser, input: Record<string, unknown>) {
  const data = clean(input);
  const c = await col();
  const id = input.id && ObjectId.isValid(String(input.id)) ? new ObjectId(String(input.id)) : null;
  if (id) {
    const cur = await c.findOne({ _id: id });
    if (!cur) throw new AnnouncementError("Announcement not found.", 404);
    if (cur.status === "sent" || cur.status === "sending") throw new AnnouncementError("That one has already gone out.");
  }
  const status = input.now ? "sending" : data.sendAt ? "scheduled" : "draft";
  const set = { ...data, status, error: null, updatedAt: new Date() };
  let docId = id;
  if (id) {
    // Only one request can move it out of draft/scheduled/failed, so two clicks can't post it twice
    const r = await c.updateOne({ _id: id, status: { $nin: ["sent", "sending"] } }, { $set: set });
    if (!r.matchedCount) throw new AnnouncementError("That one is already going out.");
  } else docId = (await c.insertOne({ ...set, createdBy: panel.discordId, createdByName: panel.name, createdAt: new Date() })).insertedId;
  if (input.now) await sendOne(docId!);
  return toA((await c.findOne({ _id: docId! }))!);
}

async function sendOne(id: ObjectId) {
  const c = await col();
  const a = await c.findOne({ _id: id });
  if (!a) return;
  const guild = await guildId();
  const prefix = a.ping === "everyone" ? "@everyone" : a.ping === "here" ? "@here" : a.ping ? `<@&${a.ping}>` : "";
  const content = [prefix, a.content].filter(Boolean).join(" ").slice(0, 2000);
  const embed = a.embed
    ? [{ title: a.embed.title || undefined, description: a.embed.description || undefined, color: parseInt(String(a.embed.color).slice(1), 16), image: a.embed.image ? { url: a.embed.image } : undefined }]
    : [];
  const res = await discordRequest<{ id: string }>("POST", `/channels/${a.channelId}/messages`, {
    content: content || undefined,
    embeds: embed,
    allowed_mentions: { parse: a.ping === "everyone" || a.ping === "here" ? ["everyone"] : [], roles: a.ping && /^\d+$/.test(a.ping) ? [a.ping] : [] },
  });
  if (res.ok && res.data?.id) {
    await c.updateOne({ _id: id }, { $set: { status: "sent", messageId: res.data.id, sentAt: new Date(), guildId: guild } });
  } else {
    await c.updateOne({ _id: id }, { $set: { status: "failed", error: res.status === 403 ? "The bot isn't allowed to post (or ping) in that channel." : `Discord said no (${res.status}).` } });
  }
}

/** Sends scheduled announcements that are due (called from the bot ping). */
export async function runDueAnnouncements() {
  const c = await col();
  for (let i = 0; i < 5; i += 1) {
    const due = await c.findOneAndUpdate({ status: "scheduled", sendAt: { $lte: new Date() } }, { $set: { status: "sending" } }, { sort: { sendAt: 1 } });
    if (!due) return;
    await sendOne(due._id);
  }
}

export async function cancelOrDelete(panel: PanelUser, id: string, fromDiscord: boolean) {
  if (!ObjectId.isValid(id)) throw new AnnouncementError("Announcement not found.", 404);
  const c = await col();
  const a = await c.findOne({ _id: new ObjectId(id) });
  if (!a) throw new AnnouncementError("Announcement not found.", 404);
  if (fromDiscord && a.messageId) {
    const r = await discordRequest("DELETE", `/channels/${a.channelId}/messages/${a.messageId}`);
    if (!r.ok && r.status !== 404) throw new AnnouncementError("Discord didn't delete it. Try again.", 502);
  }
  await c.deleteOne({ _id: a._id });
}

/** Channels the bot can post announcements in (text and announcement channels). */
export async function announceChannels() {
  const channels = await getGuildChannelsRaw();
  const cats = new Map(channels.filter((c) => c.type === 4).map((c) => [c.id, c]));
  return channels
    .filter((c) => c.type === 0 || c.type === 5)
    .sort((a, b) => (cats.get(a.parent_id ?? "")?.position ?? -1) - (cats.get(b.parent_id ?? "")?.position ?? -1) || a.position - b.position)
    .map((c) => ({ id: c.id, name: c.name, category: c.parent_id ? cats.get(c.parent_id)?.name ?? null : null }));
}
