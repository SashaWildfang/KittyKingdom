// Staff notes and the watchlist. Both live in the bot database so the Moderation Bot can use them too
// (/note and /watch in Discord, and a heads-up in the mod logs when a watched member joins).
//
// zeo_bot.staff_notes  {_id, discordId: "123", text, by: "456", byName, at, pinned, source: "web" | "discord"}
// zeo_bot.watchlist    {_id: "123", reason, by, byName, at}

import { Long, ObjectId } from "mongodb";
import { getBotCollection, getMongoClient } from "./mongodb";
import type { PanelUser } from "./admin";

export type StaffNote = { id: string; discordId: string; text: string; by: string; byName: string; at: string; pinned: boolean; source: string };
export type WatchEntry = { discordId: string; reason: string; by: string; byName: string; at: string };

const MAX_NOTE = 1500;
const isId = (v: string) => /^\d{15,21}$/.test(v);

export class NoteError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

let indexed: Promise<unknown> | null = null;
async function notes() {
  const c = await getBotCollection("staff_notes");
  indexed ??= c.createIndex({ discordId: 1, at: -1 }).catch(() => undefined);
  await indexed;
  return c;
}

const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : String(v ?? ""));
const toNote = (d: Record<string, unknown>): StaffNote => ({
  id: String(d._id),
  discordId: String(d.discordId),
  text: String(d.text ?? ""),
  by: String(d.by ?? ""),
  byName: String(d.byName ?? "Staff"),
  at: iso(d.at),
  pinned: Boolean(d.pinned),
  source: String(d.source ?? "web"),
});

/** A member's notes: pinned first, then newest. */
export async function listNotes(discordId: string): Promise<StaffNote[]> {
  if (!isId(discordId)) return [];
  const rows = await (await notes()).find({ discordId }).sort({ pinned: -1, at: -1 }).limit(200).toArray();
  return rows.map((r) => toNote(r));
}

export async function noteCounts(ids: string[]): Promise<Record<string, number>> {
  if (!ids.length) return {};
  const rows = await (await notes()).aggregate([{ $match: { discordId: { $in: ids } } }, { $group: { _id: "$discordId", n: { $sum: 1 } } }]).toArray();
  return Object.fromEntries(rows.map((r) => [String(r._id), Number(r.n)]));
}

export async function addNote(panel: PanelUser, discordId: string, text: string) {
  const body = text.trim().slice(0, MAX_NOTE);
  if (!isId(discordId)) throw new NoteError("Invalid Discord ID.");
  if (!body) throw new NoteError("Write something first.");
  const doc = { discordId, text: body, by: panel.discordId, byName: panel.name, at: new Date(), pinned: false, source: "web" };
  const r = await (await notes()).insertOne(doc);
  return toNote({ ...doc, _id: r.insertedId });
}

/** Edit, pin or delete. Your own notes; admins can change anyone's. */
export async function changeNote(panel: PanelUser, id: string, change: { text?: string; pinned?: boolean; remove?: boolean }) {
  if (!ObjectId.isValid(id)) throw new NoteError("Note not found.", 404);
  const c = await notes();
  const note = await c.findOne({ _id: new ObjectId(id) });
  if (!note) throw new NoteError("Note not found.", 404);
  const own = String(note.by) === panel.discordId;
  // Pinning is shared housekeeping; editing and deleting are the author's (or an admin's)
  if ((change.remove || change.text !== undefined) && !own && panel.level !== "admin") throw new NoteError("Only the person who wrote it (or an admin) can change this note.", 403);
  if (change.remove) {
    await c.deleteOne({ _id: note._id });
    return null;
  }
  const set: Record<string, unknown> = {};
  if (change.text !== undefined) {
    const body = change.text.trim().slice(0, MAX_NOTE);
    if (!body) throw new NoteError("A note can't be empty. Delete it instead.");
    set.text = body;
    set.editedAt = new Date();
  }
  if (change.pinned !== undefined) set.pinned = Boolean(change.pinned);
  await c.updateOne({ _id: note._id }, { $set: set });
  return toNote({ ...note, ...set });
}

// ── Watchlist ────────────────────────────────────────────────────────────────

const toWatch = (d: Record<string, unknown>): WatchEntry => ({ discordId: String(d._id), reason: String(d.reason ?? ""), by: String(d.by ?? ""), byName: String(d.byName ?? "Staff"), at: iso(d.at) });

export async function listWatch(): Promise<WatchEntry[]> {
  const rows = await (await getBotCollection("watchlist")).find({}).sort({ at: -1 }).limit(500).toArray();
  return rows.map((r) => toWatch(r));
}

export async function getWatch(discordId: string): Promise<WatchEntry | null> {
  if (!isId(discordId)) return null;
  const d = await (await getBotCollection("watchlist")).findOne({ _id: discordId as never });
  return d ? toWatch(d) : null;
}

export async function setWatch(panel: PanelUser, discordId: string, watch: boolean, reason = "") {
  if (!isId(discordId)) throw new NoteError("Invalid Discord ID.");
  const c = await getBotCollection("watchlist");
  if (!watch) {
    await c.deleteOne({ _id: discordId as never });
    return null;
  }
  const why = reason.trim().slice(0, 300);
  if (!why) throw new NoteError("Say why you're watching them, so other staff know what to look for.");
  const doc = { reason: why, by: panel.discordId, byName: panel.name, at: new Date() };
  await c.updateOne({ _id: discordId as never }, { $set: doc }, { upsert: true });
  return toWatch({ _id: discordId, ...doc });
}

export type WatchActivity = { discordId: string; kind: "punishment" | "automod" | "ticket" | "joined"; label: string; at: string; ref: string };

/** What watched members have been up to since `since`: punishments, AutoMod hits, tickets and rejoins. */
export async function watchActivity(ids: string[], since: Date): Promise<WatchActivity[]> {
  if (!ids.length) return [];
  const both = ids.flatMap((id) => [id, Long.fromString(id)]);
  const site = (await getMongoClient()).db(process.env.MONGODB_DB ?? "website");
  const safe = <T>(p: Promise<T[]>) => p.catch(() => [] as T[]);
  const [pun, am, open, closed, logs] = await Promise.all([
    safe((await getBotCollection("punishments")).find({ $or: [{ discordId: { $in: both } }, { user_discord_id: { $in: both } }], timestamp: { $gte: since } } as never, { projection: { discordId: 1, user_discord_id: 1, action: 1, timestamp: 1 } }).sort({ timestamp: -1 }).limit(200).toArray()),
    safe((await getBotCollection("automod_events")).find({ userId: { $in: both }, at: { $gte: since } } as never, { projection: { userId: 1, rule: 1, action: 1, at: 1 } }).sort({ at: -1 }).limit(200).toArray()),
    safe((await getBotCollection("activeTickets")).find({ opened_by: { $in: both }, created: { $gte: since } } as never, { projection: { opened_by: 1, ticket_id: 1, ticket_type: 1, created: 1 } }).sort({ created: -1 }).limit(100).toArray()),
    safe((await getBotCollection("resolvedTickets")).find({ opened_by: { $in: both }, created: { $gte: since } } as never, { projection: { opened_by: 1, ticket_id: 1, ticket_type: 1, created: 1 } }).sort({ created: -1 }).limit(100).toArray()),
    // The Moderation Bot's own "Watched member joined" alert isn't a second join
    safe(site.collection("bot_logs").find({ userIds: { $in: ids }, $and: [{ type: /member joined/i }, { type: { $not: /watched/i } }], ts: { $gte: since } }, { projection: { userIds: 1, subjectId: 1, ts: 1 } }).sort({ ts: -1 }).limit(100).toArray()),
  ]);
  const out: WatchActivity[] = [];
  const watched = new Set(ids);
  for (const p of pun) out.push({ discordId: String(p.discordId ?? p.user_discord_id), kind: "punishment", label: `Got a ${String(p.action).replace(/_/g, " ")}`, at: iso(p.timestamp), ref: String(p._id) });
  for (const a of am) {
    const what = a.action === "alert" ? "flagged a message" : a.action === "delete" ? "deleted a message" : `gave a ${String(a.action)}`;
    out.push({ discordId: String(a.userId), kind: "automod", label: `AutoMod ${what} (${String(a.rule ?? "rule").replace(/[-_]/g, " ")})`, at: iso(a.at), ref: String(a._id) });
  }
  for (const t of [...open, ...closed]) out.push({ discordId: String(t.opened_by), kind: "ticket", label: `Opened ticket #${t.ticket_id} (${String(t.ticket_type ?? "support").replace(/[-_]/g, " ")})`, at: iso(t.created), ref: String(t._id) });
  for (const l of logs) {
    const who = String(l.subjectId ?? (l.userIds as string[]).find((u) => watched.has(u)) ?? "");
    if (watched.has(who)) out.push({ discordId: who, kind: "joined", label: "Joined the server", at: iso(l.ts), ref: String(l._id) });
  }
  return out.filter((a) => watched.has(a.discordId)).sort((a, b) => b.at.localeCompare(a.at));
}
