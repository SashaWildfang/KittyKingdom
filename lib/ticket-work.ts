// Ticket tools for staff: saved replies (posted with /reply in Discord), private notes on a ticket, assigning a
// ticket to someone (the Ticket Bot does the claiming and pings them), and response-time stats.
//
// zeo_bot.reply_templates {_id, name, text, types: [], uses, lastUsedAt, createdBy, updatedBy, updatedAt}
// website.ticket_notes    {_id, ticketKey, ticketId, text, by, byName, at}
// zeo_bot.ticket_actions  {type: "assign", ticketKey, ticketId, channelId, to, toName, by, byName, status, tries, createdAt}
// The Ticket Bot stamps claimed_at, first_staff_reply_at/by and staff_replies on each ticket.

import { ObjectId, type Document } from "mongodb";
import type { PanelUser } from "./admin";
import { getBotCollection, getMongoClient } from "./mongodb";
import { getStaffDirectory } from "./staff";

export class TicketWorkError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : null);
const site = async () => (await getMongoClient()).db(process.env.MONGODB_DB ?? "website");
const NSFW = /nsfw/i;

// ── Saved replies ────────────────────────────────────────────────────────────

export type ReplyTemplate = { id: string; name: string; text: string; types: string[]; uses: number; lastUsedAt: string | null; updatedAt: string | null };

const toTemplate = (d: Document): ReplyTemplate => ({
  id: String(d._id),
  name: String(d.name ?? ""),
  text: String(d.text ?? ""),
  types: Array.isArray(d.types) ? d.types.map(String) : [],
  uses: Number(d.uses ?? 0),
  lastUsedAt: iso(d.lastUsedAt),
  updatedAt: iso(d.updatedAt),
});

export async function listTemplates(): Promise<ReplyTemplate[]> {
  const rows = await (await getBotCollection("reply_templates")).find({}).sort({ uses: -1, name: 1 }).limit(200).toArray();
  return rows.map(toTemplate);
}

/** Create (no id) or update a saved reply. Admins only (the route checks). */
export async function saveTemplate(panel: PanelUser, input: { id?: string; name?: unknown; text?: unknown; types?: unknown }) {
  const name = String(input.name ?? "").trim().slice(0, 80);
  const text = String(input.text ?? "").trim().slice(0, 1900);
  const types = Array.isArray(input.types) ? Array.from(new Set(input.types.map((t) => String(t).trim()).filter(Boolean))).slice(0, 12) : [];
  if (!name) throw new TicketWorkError("Give it a short name (that's what staff pick in /reply).");
  if (!text) throw new TicketWorkError("Write the reply itself.");
  const c = await getBotCollection("reply_templates");
  const clash = await c.findOne({ name: { $regex: `^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" }, ...(input.id && ObjectId.isValid(input.id) ? { _id: { $ne: new ObjectId(input.id) } } : {}) });
  if (clash) throw new TicketWorkError("There's already a saved reply with that name.");
  const now = new Date();
  if (input.id) {
    if (!ObjectId.isValid(input.id)) throw new TicketWorkError("Saved reply not found.", 404);
    const res = await c.findOneAndUpdate({ _id: new ObjectId(input.id) }, { $set: { name, text, types, updatedBy: panel.discordId, updatedAt: now } }, { returnDocument: "after" });
    if (!res) throw new TicketWorkError("Saved reply not found.", 404);
    return toTemplate(res);
  }
  const doc = { name, text, types, uses: 0, createdBy: panel.discordId, updatedBy: panel.discordId, updatedAt: now };
  const r = await c.insertOne(doc);
  return toTemplate({ ...doc, _id: r.insertedId });
}

export async function deleteTemplate(id: string) {
  if (!ObjectId.isValid(id)) throw new TicketWorkError("Saved reply not found.", 404);
  await (await getBotCollection("reply_templates")).deleteOne({ _id: new ObjectId(id) });
}

// ── The ticket itself ────────────────────────────────────────────────────────

/** An open ticket by its database key, checked against what this person may see. */
async function openTicket(panel: PanelUser, key: string) {
  if (!ObjectId.isValid(key)) throw new TicketWorkError("Ticket not found.", 404);
  const t = await (await getBotCollection("activeTickets")).findOne({ _id: new ObjectId(key) });
  if (!t || (panel.level !== "admin" && NSFW.test(String(t.ticket_type ?? "")))) throw new TicketWorkError("That ticket isn't open any more.", 404);
  return t;
}

async function anyTicket(panel: PanelUser, key: string) {
  if (!ObjectId.isValid(key)) throw new TicketWorkError("Ticket not found.", 404);
  const id = new ObjectId(key);
  const t = (await (await getBotCollection("activeTickets")).findOne({ _id: id })) ?? (await (await getBotCollection("resolvedTickets")).findOne({ _id: id }));
  if (!t || (panel.level !== "admin" && NSFW.test(String(t.ticket_type ?? "")))) throw new TicketWorkError("Ticket not found.", 404);
  return t;
}

// ── Notes ────────────────────────────────────────────────────────────────────

export type TicketNote = { id: string; text: string; by: string; byName: string; at: string };

export async function listTicketNotes(panel: PanelUser, key: string): Promise<TicketNote[]> {
  await anyTicket(panel, key);
  const rows = await (await site()).collection("ticket_notes").find({ ticketKey: key }).sort({ at: 1 }).limit(200).toArray();
  return rows.map((r) => ({ id: String(r._id), text: String(r.text ?? ""), by: String(r.by ?? ""), byName: String(r.byName ?? "Staff"), at: iso(r.at) ?? "" }));
}

export async function addTicketNote(panel: PanelUser, key: string, text: string) {
  const t = await anyTicket(panel, key);
  const body = text.trim().slice(0, 1500);
  if (!body) throw new TicketWorkError("Write something first.");
  const c = (await site()).collection("ticket_notes");
  await c.createIndex({ ticketKey: 1, at: 1 }).catch(() => undefined);
  await c.insertOne({ ticketKey: key, ticketId: Number(t.ticket_id), text: body, by: panel.discordId, byName: panel.name, at: new Date() });
}

export async function deleteTicketNote(panel: PanelUser, id: string) {
  if (!ObjectId.isValid(id)) throw new TicketWorkError("Note not found.", 404);
  const c = (await site()).collection("ticket_notes");
  const res = await c.deleteOne({ _id: new ObjectId(id), ...(panel.level === "admin" ? {} : { by: panel.discordId }) });
  if (!res.deletedCount) throw new TicketWorkError("Only the person who wrote it (or an admin) can delete this note.", 403);
}

// ── Assigning ────────────────────────────────────────────────────────────────

/** Staff who can be assigned tickets (18+ tickets: admins and up only see them, so only they're offered). */
export async function assignableStaff(adultTicket: boolean) {
  const dir = await getStaffDirectory();
  return dir.groups
    .flatMap((g) => g.members)
    .filter((m) => m.role !== "Content Creator" && (!adultTicket || ["Owner", "Sr Admin", "Admin"].includes(m.role)))
    .sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name))
    .map((m) => ({ id: m.id, name: m.name, role: m.role, status: m.status }));
}

export async function assignTicket(panel: PanelUser, key: string, to: string) {
  // Staff who aren't admins have view-only tickets on the website
  if (panel.level !== "admin") throw new TicketWorkError("Only admins can assign tickets from the website.", 403);
  const t = await openTicket(panel, key);
  const staff = await assignableStaff(NSFW.test(String(t.ticket_type ?? "")));
  const who = staff.find((s) => s.id === to);
  if (!who) throw new TicketWorkError("Pick someone on staff who can see this ticket.");
  if (!t.channel_id) throw new TicketWorkError("That ticket has no channel to assign in.");
  const c = await getBotCollection("ticket_actions");
  // One pending assignment per ticket: a newer pick replaces one the bot hasn't done yet
  await c.deleteMany({ ticketKey: key, status: "pending" });
  const r = await c.insertOne({ type: "assign", ticketKey: key, ticketId: Number(t.ticket_id), channelId: String(t.channel_id), to: who.id, toName: who.name, by: panel.discordId, byName: panel.name, status: "pending", tries: 0, createdAt: new Date() });
  return { id: String(r.insertedId), toName: who.name };
}

export async function assignmentStatus(key: string) {
  const a = await (await getBotCollection("ticket_actions")).findOne({ ticketKey: key, type: "assign" }, { sort: { createdAt: -1 } });
  return a ? { to: String(a.to), toName: String(a.toName ?? ""), byName: String(a.byName ?? ""), status: String(a.status), error: a.error ? String(a.error) : null, at: iso(a.createdAt) } : null;
}

// ── Response times ───────────────────────────────────────────────────────────

const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export type ResponseStats = {
  days: number;
  tracked: number;
  firstReply: { median: number | null; within1h: number | null; noReply: number };
  close: { median: number | null };
  byType: { type: string; count: number; firstReply: number | null; close: number | null }[];
  byStaff: { id: string; firstReplies: number; median: number | null; closed: number }[];
  since: string | null;
};

/** First staff reply and time-to-close over the last `days` days (manual tickets left out: staff opened them). */
export async function responseStats(panel: PanelUser, days: number): Promise<ResponseStats> {
  const from = new Date(Date.now() - days * 86_400_000);
  const match: Document = { created: { $gte: from }, manual_ticket: { $ne: true }, ...(panel.level === "admin" ? {} : { ticket_type: { $not: NSFW } }) };
  const fields = { ticket_type: 1, created: 1, resolved_at: 1, resolved_by: 1, status: 1, first_staff_reply_at: 1, first_staff_reply_by: 1, opened_by: 1 };
  const [open, closed, firstTracked] = await Promise.all([
    getBotCollection("activeTickets").then((c) => c.find(match, { projection: fields }).toArray()),
    getBotCollection("resolvedTickets").then((c) => c.find({ ...match, status: { $ne: "Deleted" } }, { projection: fields }).toArray()),
    // Reply times only exist from when the Ticket Bot started recording them
    Promise.all([getBotCollection("activeTickets"), getBotCollection("resolvedTickets")]).then(([a, r]) =>
      Promise.all([a.find({ first_staff_reply_at: { $exists: true } }).sort({ created: 1 }).limit(1).toArray(), r.find({ first_staff_reply_at: { $exists: true } }).sort({ created: 1 }).limit(1).toArray()]),
    ),
  ]);
  const since = [...firstTracked[0], ...firstTracked[1]].map((d) => d.created as Date).filter((d) => d instanceof Date).sort((a, b) => a.getTime() - b.getTime())[0] ?? null;
  const all = [...open, ...closed];
  const mins = (a: unknown, b: unknown) => (a instanceof Date && b instanceof Date ? Math.max(0, (b.getTime() - a.getTime()) / 60_000) : null);

  const replyMins: number[] = [];
  const closeMins: number[] = [];
  let noReply = 0;
  const types = new Map<string, { count: number; reply: number[]; close: number[] }>();
  const staff = new Map<string, { first: number[]; closed: number }>();
  for (const t of all) {
    const type = String(t.ticket_type ?? "support");
    const ty = types.get(type) ?? { count: 0, reply: [], close: [] };
    ty.count += 1;
    const tracked = since && t.created instanceof Date && t.created >= since;
    const reply = mins(t.created, t.first_staff_reply_at);
    if (reply !== null) {
      replyMins.push(reply);
      ty.reply.push(reply);
      const by = String(t.first_staff_reply_by ?? "");
      if (by) {
        const s = staff.get(by) ?? { first: [], closed: 0 };
        s.first.push(reply);
        staff.set(by, s);
      }
    } else if (tracked && t.resolved_at) noReply += 1;
    const close = mins(t.created, t.resolved_at);
    if (close !== null) {
      closeMins.push(close);
      ty.close.push(close);
    }
    if (t.resolved_by && t.resolved_by !== t.opened_by) {
      const s = staff.get(String(t.resolved_by)) ?? { first: [], closed: 0 };
      s.closed += 1;
      staff.set(String(t.resolved_by), s);
    }
    types.set(type, ty);
  }

  return {
    days,
    tracked: replyMins.length,
    firstReply: { median: median(replyMins), within1h: replyMins.length ? replyMins.filter((m) => m <= 60).length / replyMins.length : null, noReply },
    close: { median: median(closeMins) },
    byType: Array.from(types, ([type, v]) => ({ type, count: v.count, firstReply: median(v.reply), close: median(v.close) })).sort((a, b) => b.count - a.count),
    byStaff: Array.from(staff, ([id, v]) => ({ id, firstReplies: v.first.length, median: median(v.first), closed: v.closed }))
      .filter((s) => s.firstReplies || s.closed)
      .sort((a, b) => b.firstReplies + b.closed - (a.firstReplies + a.closed)),
    since: since ? since.toISOString() : null,
  };
}
