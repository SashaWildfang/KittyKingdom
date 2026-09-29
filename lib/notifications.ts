// Site-wide notifications (the bell next to My Account). Keyed by Discord id. Kept for 60 days.
//   { to, type, actor?, title, body?, link, at, read, key? }   key = dedupe (one unread per key)

import { ObjectId, type Collection, type Document } from "mongodb";
import { sendDatingDm } from "./dating/dm";
import { getSettings } from "./dating/settings";
import { getMongoClient } from "./mongodb";

export type NotificationType = "like" | "match" | "message" | "request" | "friend-request" | "friend-accepted" | "view" | "partner" | "system";

let ready: Promise<unknown> | null = null;

async function col(): Promise<Collection<Document>> {
  const c = (await getMongoClient()).db(process.env.MONGODB_DB ?? "website").collection("notifications");
  ready ??= Promise.all([c.createIndex({ to: 1, at: -1 }), c.createIndex({ at: 1 }, { expireAfterSeconds: 60 * 86_400 })]).catch(() => undefined);
  await ready;
  return c;
}

/** Adds a notification. With a key, an unread one with the same key is refreshed instead of duplicated. */
export async function notify(to: string, n: { type: NotificationType; actor?: string | null; title: string; body?: string; link: string; key?: string }) {
  // Members choose which kinds they get in the bell and which also come as Discord DMs (Settings → Notifications)
  const settings = n.type === "system" ? null : await getSettings(to).catch(() => null);
  if (settings) await sendDatingDm(to, settings, n).catch(() => undefined);
  if (settings?.notify[n.type as keyof typeof settings.notify] === false) return;
  const c = await col();
  const doc = { to, type: n.type, actor: n.actor ?? null, title: n.title.slice(0, 140), body: (n.body ?? "").slice(0, 200), link: n.link, at: new Date(), read: false };
  if (n.key) {
    await c.updateOne({ to, key: n.key, read: false }, { $set: doc, $inc: { count: 1 } }, { upsert: true });
  } else {
    await c.insertOne(doc);
  }
}

export async function listNotifications(to: string, limit = 30) {
  const c = await col();
  const [rows, unread] = await Promise.all([limit ? c.find({ to }).sort({ at: -1 }).limit(limit).toArray() : Promise.resolve([] as Document[]), c.countDocuments({ to, read: false })]);
  return {
    unread,
    items: rows.map((r) => ({
      id: String(r._id),
      type: String(r.type),
      actor: r.actor ? String(r.actor) : null,
      title: String(r.title),
      body: String(r.body ?? ""),
      link: String(r.link),
      at: (r.at as Date).toISOString(),
      read: Boolean(r.read),
      count: Number(r.count ?? 1),
    })),
  };
}

export async function unreadCount(to: string) {
  return (await col()).countDocuments({ to, read: false });
}

export async function markRead(to: string, ids: string[] | "all") {
  const c = await col();
  if (ids === "all") await c.updateMany({ to, read: false }, { $set: { read: true } });
  else await c.updateMany({ to, _id: { $in: ids.filter((i) => ObjectId.isValid(i)).map((i) => new ObjectId(i)) } }, { $set: { read: true } });
}

/** Clears notifications that point at something (e.g. reading a conversation clears its message alerts). */
export async function markReadByKey(to: string, key: string) {
  await (await col()).updateMany({ to, key, read: false }, { $set: { read: true } });
}

/** Clears (deletes) all of a member's notifications. */
export async function clearNotifications(to: string) {
  const r = await (await col()).deleteMany({ to });
  return r.deletedCount;
}
