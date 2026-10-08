// Admin → Emails: every email the website sent (lib/email.ts logs them, with one-time links hidden).

import { ObjectId } from "mongodb";
import { EMAIL_KINDS, type EmailRow } from "./email-kinds";
import { getMongoClient } from "./mongodb";

async function col() {
  const client = await getMongoClient();
  const c = client.db(process.env.MONGODB_DB ?? "website").collection("email_log");
  await c.createIndex({ at: -1 }).catch(() => undefined);
  return c;
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export async function listEmails(opts: { q?: string; kind?: string; status?: string; page?: number }) {
  const filter: Record<string, unknown> = {};
  if (opts.kind && opts.kind in EMAIL_KINDS) filter.kind = opts.kind;
  if (opts.status === "failed") filter.sent = false;
  if (opts.status === "sent") filter.sent = true;
  const q = (opts.q ?? "").trim().slice(0, 100);
  if (q) filter.$or = [{ to: { $regex: escape(q), $options: "i" } }, { subject: { $regex: escape(q), $options: "i" } }];
  const page = Math.max(1, Math.min(500, Number(opts.page) || 1));
  const pageSize = 30;
  const c = await col();
  const since = new Date(Date.now() - 24 * 3600 * 1000);
  const [rows, total, today, failedToday] = await Promise.all([
    c.find(filter, { projection: { html: 0, text: 0 } }).sort({ at: -1 }).skip((page - 1) * pageSize).limit(pageSize).toArray(),
    c.countDocuments(filter),
    c.countDocuments({ at: { $gte: since } }),
    c.countDocuments({ at: { $gte: since }, sent: false }),
  ]);
  return {
    rows: rows.map((r): EmailRow => ({
      id: String(r._id), to: String(r.to ?? ""), subject: String(r.subject ?? ""), kind: String(r.kind ?? "other"),
      sent: Boolean(r.sent), error: r.error ? String(r.error) : null, at: r.at instanceof Date ? r.at.toISOString() : String(r.at),
    })),
    total, page, pageSize, today, failedToday,
  };
}

export async function getEmail(id: string) {
  if (!ObjectId.isValid(id)) return null;
  const r = await (await col()).findOne({ _id: new ObjectId(id) });
  if (!r) return null;
  return { id: String(r._id), to: String(r.to ?? ""), subject: String(r.subject ?? ""), kind: String(r.kind ?? "other"), sent: Boolean(r.sent), error: r.error ? String(r.error) : null, at: r.at instanceof Date ? r.at.toISOString() : String(r.at), html: String(r.html ?? ""), text: String(r.text ?? "") };
}
