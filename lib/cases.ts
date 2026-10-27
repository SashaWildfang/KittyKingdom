// Cases: a file for an ongoing issue (a member causing trouble across several reports, a dispute between
// members, a suspected alt ring). A case collects the members involved, notes, and links to reports, tickets
// and AutoMod catches, with an owner and open/closed status.
//
// website.cases {_id, number, title, status: open|closed, members: [id], owner, ownerName, createdBy, createdByName,
//                createdAt, updatedAt, closedAt, entries: [{id, at, by, byName, kind: note|link|status|owner|member, text, ref?}]}

import { ObjectId, type Document } from "mongodb";
import type { PanelUser } from "./admin";
import { getMongoClient } from "./mongodb";

export type CaseRef = { type: "report" | "ticket" | "automod" | "punishment"; id: string; label: string };
export type CaseEntry = { id: string; at: string; by: string; byName: string; kind: "note" | "link" | "status" | "owner" | "member"; text: string; ref: CaseRef | null; member?: string };
export type CaseFile = {
  id: string;
  number: number;
  title: string;
  status: "open" | "closed";
  members: string[];
  owner: string | null;
  ownerName: string | null;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
  entries: CaseEntry[];
};

export class CaseError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : "");
const isId = (v: unknown) => typeof v === "string" && /^\d{15,21}$/.test(v);
async function db() {
  return (await getMongoClient()).db(process.env.MONGODB_DB ?? "website");
}
async function col() {
  const c = (await db()).collection("cases");
  await c.createIndex({ status: 1, updatedAt: -1 }).catch(() => undefined);
  await c.createIndex({ members: 1 }).catch(() => undefined);
  return c;
}

const toCase = (d: Document): CaseFile => ({
  id: String(d._id),
  number: Number(d.number ?? 0),
  title: String(d.title ?? ""),
  status: d.status === "closed" ? "closed" : "open",
  members: Array.isArray(d.members) ? d.members.map(String) : [],
  owner: d.owner ? String(d.owner) : null,
  ownerName: d.ownerName ? String(d.ownerName) : null,
  createdBy: String(d.createdBy ?? ""),
  createdByName: String(d.createdByName ?? ""),
  createdAt: iso(d.createdAt),
  updatedAt: iso(d.updatedAt),
  entries: (Array.isArray(d.entries) ? d.entries : []).map((e: Document) => ({ id: String(e.id), at: iso(e.at), by: String(e.by ?? ""), byName: String(e.byName ?? ""), kind: e.kind, text: String(e.text ?? ""), ref: e.ref ?? null, ...(e.member ? { member: String(e.member) } : {}) })),
});

function cleanRef(ref: unknown): CaseRef | null {
  if (!ref || typeof ref !== "object") return null;
  const r = ref as Record<string, unknown>;
  if (!["report", "ticket", "automod", "punishment"].includes(String(r.type)) || !String(r.id ?? "").trim()) return null;
  return { type: r.type as CaseRef["type"], id: String(r.id).slice(0, 40), label: String(r.label ?? "").slice(0, 120) };
}

const entry = (panel: PanelUser, kind: CaseEntry["kind"], text: string, ref: CaseRef | null = null) => ({ id: new ObjectId().toString(), at: new Date(), by: panel.discordId, byName: panel.name, kind, text: text.slice(0, 2000), ref });

export async function listCases(q: { status?: string; member?: string; mine?: boolean; me: string }) {
  const filter: Document = {};
  if (q.status === "open" || q.status === "closed") filter.status = q.status;
  // "all" (or anything else) shows both
  if (isId(q.member)) filter.members = q.member;
  if (q.mine) filter.owner = q.me;
  const rows = await (await col()).find(filter, { projection: { entries: { $slice: -1 } } }).sort({ status: -1, updatedAt: -1 }).limit(100).toArray();
  return rows.map(toCase);
}

export async function getCase(id: string) {
  if (!ObjectId.isValid(id)) throw new CaseError("Case not found.", 404);
  const d = await (await col()).findOne({ _id: new ObjectId(id) });
  if (!d) throw new CaseError("Case not found.", 404);
  return toCase(d);
}

export async function createCase(panel: PanelUser, input: { title?: unknown; members?: unknown; note?: unknown; ref?: unknown }) {
  const title = String(input.title ?? "").trim().slice(0, 120);
  if (!title) throw new CaseError("Give the case a short title.");
  const members = Array.from(new Set((Array.isArray(input.members) ? input.members : []).map(String).filter(isId))).slice(0, 20);
  const counter = await (await db()).collection<{ _id: string; n: number }>("counters").findOneAndUpdate({ _id: "cases" }, { $inc: { n: 1 } }, { upsert: true, returnDocument: "after" });
  const now = new Date();
  const ref = cleanRef(input.ref);
  const note = String(input.note ?? "").trim();
  const entries = [entry(panel, "status", "Opened the case"), ...(note ? [entry(panel, "note", note)] : []), ...(ref ? [entry(panel, "link", "", ref)] : [])];
  const doc = { number: counter?.n ?? 1, title, status: "open", members, owner: panel.discordId, ownerName: panel.name, createdBy: panel.discordId, createdByName: panel.name, createdAt: now, updatedAt: now, entries };
  const r = await (await col()).insertOne(doc);
  return toCase({ ...doc, _id: r.insertedId });
}

/** One change to a case: note, link, status, owner or members. */
export async function updateCase(panel: PanelUser, id: string, input: { op?: string; text?: unknown; ref?: unknown; status?: unknown; owner?: unknown; member?: unknown; remove?: unknown; title?: unknown }) {
  const c = await getCase(id);
  const set: Document = { updatedAt: new Date() };
  const push: Document[] = [];
  switch (input.op) {
    case "note": {
      const text = String(input.text ?? "").trim();
      if (!text) throw new CaseError("Write something first.");
      push.push(entry(panel, "note", text));
      break;
    }
    case "link": {
      const ref = cleanRef(input.ref);
      if (!ref) throw new CaseError("Nothing to link.");
      push.push(entry(panel, "link", String(input.text ?? "").trim(), ref));
      break;
    }
    case "status": {
      const status = input.status === "closed" ? "closed" : "open";
      if (status === c.status) return c;
      set.status = status;
      if (status === "closed") set.closedAt = new Date();
      push.push(entry(panel, "status", status === "closed" ? `Closed the case${String(input.text ?? "").trim() ? `: ${String(input.text).trim()}` : ""}` : "Reopened the case"));
      break;
    }
    case "owner": {
      const mine = input.owner === "me";
      set.owner = mine ? panel.discordId : null;
      set.ownerName = mine ? panel.name : null;
      push.push(entry(panel, "owner", mine ? "Took over the case" : "Let go of the case"));
      break;
    }
    case "member": {
      const m = String(input.member ?? "");
      if (!isId(m)) throw new CaseError("That's not a Discord ID.");
      const members = input.remove ? c.members.filter((x) => x !== m) : Array.from(new Set([...c.members, m])).slice(0, 20);
      set.members = members;
      push.push({ ...entry(panel, "member", input.remove ? "Removed a member" : "Added a member"), member: m });
      break;
    }
    case "title": {
      const title = String(input.title ?? "").trim().slice(0, 120);
      if (!title) throw new CaseError("Give the case a short title.");
      set.title = title;
      break;
    }
    default:
      throw new CaseError("Nothing to change.");
  }
  await (await col()).updateOne({ _id: new ObjectId(id) }, { $set: set, ...(push.length ? { $push: { entries: { $each: push } } } : {}) } as never);
  return getCase(id);
}

/** Cases a member is part of (for their profile and timeline). */
export async function casesFor(member: string) {
  if (!isId(member)) return [];
  const rows = await (await col()).find({ members: member }, { projection: { entries: 0 } }).sort({ createdAt: -1 }).limit(20).toArray();
  return rows.map(toCase);
}

export async function myOpenCaseCount(me: string) {
  return (await col()).countDocuments({ status: "open", owner: me });
}
