// Staff activity and promotions: what each staff member has done over a period (messages, tickets, first
// replies, punishments, join apps, reports), how long they've held their rank, and admins' review flags.
//
// website.staff_rank_history {discordId, role, rank, from, to}   kept up to date from the staff list (on the bot ping)
// website.staff_reviews      {_id: discordId, flag: "promote" | "support" | null, note, by, byName, at}

import { Long, type Document } from "mongodb";
import type { PanelUser } from "./admin";
import { getBotCollection, getMongoClient, getStaffCollection } from "./mongodb";

const site = async () => (await getMongoClient()).db(process.env.MONGODB_DB ?? "website");
const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : null);
const NOT_STAFF = new Set(["Content Creator"]);

type StaffDoc = { id: string; name: string; role: string; rank: number; lastOnline: string | null; status: string | null; joinedServer: string | null };

async function staffList(): Promise<StaffDoc[]> {
  const docs = await (await getStaffCollection()).find({}).toArray();
  return docs
    .map((d) => ({
      id: String(d.discord_id ?? d._id),
      name: String(d.display_name ?? d.username ?? "Staff member"),
      role: typeof d.role === "string" ? d.role : "Staff",
      rank: typeof d.rank === "number" ? d.rank : 99,
      lastOnline: iso(d.last_online_at),
      status: typeof d.status === "string" ? d.status : null,
      joinedServer: iso(d.joined_server_at),
    }))
    .filter((s) => !NOT_STAFF.has(s.role) && /^\d{15,21}$/.test(s.id));
}

/** Notes rank changes (called on the bot ping, at most every 10 minutes). */
export async function observeStaffRanks() {
  const db = await site();
  const meta = db.collection<{ _id: string; at?: Date }>("job_state");
  const last = await meta.findOne({ _id: "staff-ranks" });
  if (last?.at && Date.now() - last.at.getTime() < 10 * 60_000) return;
  await meta.updateOne({ _id: "staff-ranks" }, { $set: { at: new Date() } }, { upsert: true });
  const staff = await staffList();
  const hist = db.collection("staff_rank_history");
  const open = await hist.find({ to: null }).toArray();
  const byId = new Map(open.map((h) => [String(h.discordId), h]));
  const now = new Date();
  for (const s of staff) {
    const cur = byId.get(s.id);
    if (cur && cur.role === s.role) continue;
    if (cur) await hist.updateOne({ _id: cur._id }, { $set: { to: now } });
    // The very first time we see someone, we don't know when they got the rank; leave "from" unknown
    await hist.insertOne({ discordId: s.id, role: s.role, rank: s.rank, from: cur || open.length ? now : null, to: null });
  }
  // People who left staff
  const ids = new Set(staff.map((s) => s.id));
  for (const h of open) if (!ids.has(String(h.discordId))) await hist.updateOne({ _id: h._id }, { $set: { to: now } });
}

export type StaffRow = StaffDoc & {
  messages: number;
  ticketsClaimed: number;
  ticketsClosed: number;
  firstReplies: number;
  punishments: number;
  joinApps: number;
  reports: number;
  websiteLastSeen: string | null;
  score: number;
  rankSince: string | null;
  rankKnown: boolean;
  previousRole: string | null;
  review: { flag: string | null; note: string; byName: string; at: string } | null;
};

/** Everything staff did over the last `days` days. */
export async function staffActivity(panel: PanelUser, days: number): Promise<StaffRow[]> {
  const from = new Date(Date.now() - days * 86_400_000);
  const staff = await staffList();
  const ids = staff.map((s) => s.id);
  const both = ids.flatMap((id) => [id, Long.fromString(id)]);
  const db = await site();
  const count = (rows: Document[]) => new Map(rows.map((r) => [String(r._id), Number(r.n)]));
  const safe = <T>(p: Promise<T>, fallback: T) => p.catch(() => fallback);

  const [msgs, claimedA, claimedR, closed, firsts, puns, apps, reps, seen, hist, reviews] = await Promise.all([
    safe(getBotCollection("message_index").then((c) => c.aggregate([{ $match: { a: { $in: both }, t: { $gte: from } } }, { $group: { _id: { $toString: "$a" }, n: { $sum: 1 } } }]).toArray()), []),
    safe(getBotCollection("activeTickets").then((c) => c.aggregate([{ $match: { claimed_by: { $in: ids }, $or: [{ claimed_at: { $gte: from } }, { created: { $gte: from } }] } }, { $group: { _id: "$claimed_by", n: { $sum: 1 } } }]).toArray()), []),
    safe(getBotCollection("resolvedTickets").then((c) => c.aggregate([{ $match: { claimed_by: { $in: ids }, $or: [{ claimed_at: { $gte: from } }, { created: { $gte: from } }] } }, { $group: { _id: "$claimed_by", n: { $sum: 1 } } }]).toArray()), []),
    safe(getBotCollection("resolvedTickets").then((c) => c.aggregate([{ $match: { resolved_by: { $in: ids }, resolved_at: { $gte: from } } }, { $group: { _id: "$resolved_by", n: { $sum: 1 } } }]).toArray()), []),
    safe(
      Promise.all(["activeTickets", "resolvedTickets"].map((n) => getBotCollection(n).then((c) => c.aggregate([{ $match: { first_staff_reply_by: { $in: ids }, first_staff_reply_at: { $gte: from } } }, { $group: { _id: "$first_staff_reply_by", n: { $sum: 1 } } }]).toArray()))).then((a) => a.flat()),
      [],
    ),
    safe(
      getBotCollection("punishments").then((c) =>
        c.aggregate([{ $match: { timestamp: { $gte: from }, $or: [{ issuerId: { $in: both } }, { issuer_discord_id: { $in: both } }] } }, { $group: { _id: { $toString: { $ifNull: ["$issuer_discord_id", "$issuerId"] } }, n: { $sum: 1 } } }]).toArray(),
      ),
      [],
    ),
    safe(getBotCollection("join_applications").then((c) => c.aggregate([{ $match: { reviewedAt: { $gte: from }, reviewedBy: { $in: both } } }, { $group: { _id: { $toString: "$reviewedBy" }, n: { $sum: 1 } } }]).toArray()), []),
    safe(getBotCollection("reports").then((c) => c.aggregate([{ $match: { "outcome.by": { $in: ids }, "outcome.at": { $gte: from } } }, { $group: { _id: "$outcome.by", n: { $sum: 1 } } }]).toArray()), []),
    safe(
      db
        .collection("users")
        .aggregate([
          { $match: { discordId: { $in: ids } } },
          { $lookup: { from: "sessions", localField: "_id", foreignField: "userId", as: "s" } },
          { $project: { discordId: 1, last: { $max: "$s.lastSeenAt" } } },
        ])
        .toArray(),
      [],
    ),
    safe(db.collection("staff_rank_history").find({ discordId: { $in: ids } }).sort({ from: -1 }).toArray(), []),
    panel.level === "admin" ? safe(db.collection("staff_reviews").find({ _id: { $in: ids } as never }).toArray(), []) : Promise.resolve([] as Document[]),
  ]);

  const m = count(msgs);
  const ca = count(claimedA);
  const cr = count(claimedR);
  const cl = count(closed);
  const fr = new Map<string, number>();
  for (const r of firsts) fr.set(String(r._id), (fr.get(String(r._id)) ?? 0) + Number(r.n));
  const pu = count(puns);
  const ap = count(apps);
  const rp = count(reps);
  const web = new Map(seen.map((u) => [String(u.discordId), iso(u.last)]));
  const rv = new Map(reviews.map((r) => [String(r._id), r]));

  return staff
    .map((s) => {
      const mine = hist.filter((h) => String(h.discordId) === s.id);
      const current = mine.find((h) => h.to === null && h.role === s.role);
      const previous = mine.find((h) => h.to !== null);
      const row = {
        ...s,
        messages: m.get(s.id) ?? 0,
        ticketsClaimed: (ca.get(s.id) ?? 0) + (cr.get(s.id) ?? 0),
        ticketsClosed: cl.get(s.id) ?? 0,
        firstReplies: fr.get(s.id) ?? 0,
        punishments: pu.get(s.id) ?? 0,
        joinApps: ap.get(s.id) ?? 0,
        reports: rp.get(s.id) ?? 0,
        websiteLastSeen: web.get(s.id) ?? null,
        rankSince: iso(current?.from),
        rankKnown: Boolean(current?.from),
        previousRole: previous ? String(previous.role) : null,
        review: rv.get(s.id) ? { flag: (rv.get(s.id)!.flag as string) ?? null, note: String(rv.get(s.id)!.note ?? ""), byName: String(rv.get(s.id)!.byName ?? ""), at: iso(rv.get(s.id)!.at) ?? "" } : null,
        score: 0,
      };
      // A rough "how much staff work" number: chat counts a little, handling things counts a lot
      row.score = Math.round(Math.min(row.messages, 2000) / 20 + row.ticketsClaimed * 4 + row.ticketsClosed * 3 + row.firstReplies * 3 + row.punishments * 2 + row.joinApps * 2 + row.reports * 3);
      return row;
    })
    .sort((a, b) => a.rank - b.rank || b.score - a.score);
}

/** Admins: flag someone for a promotion conversation, or as needing support (or clear it). */
export async function setReview(panel: PanelUser, discordId: string, flag: string | null, note: string) {
  if (!/^\d{15,21}$/.test(discordId)) throw new Error("Bad id");
  const c = (await site()).collection("staff_reviews");
  if (!flag) {
    await c.deleteOne({ _id: discordId as never });
    return;
  }
  if (!["promote", "support"].includes(flag)) throw new Error("Bad flag");
  await c.updateOne({ _id: discordId as never }, { $set: { flag, note: note.trim().slice(0, 500), by: panel.discordId, byName: panel.name, at: new Date() } }, { upsert: true });
}
