// Community insights for admins:
//   • Join funnel: each week's new members → sent a join app → accepted → said something → still chatting a week
//     later → still here after 30 days.
//   • Why people leave: how long leavers stayed, where they were in joining, and what happened just before.
//   • Economy health: how many Leaves exist, who holds them, and what flows in and out.
//   • Event and giveaway results: who said they'd come vs who showed up; entries and what giveaways cost.

import { Long, type Document } from "mongodb";
import { getBotCollection, getMongoClient } from "./mongodb";

const DAY = 86_400_000;
const site = async () => (await getMongoClient()).db(process.env.MONGODB_DB ?? "website");
const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : null);
const idsBoth = (ids: string[]) => ids.flatMap((id) => [id, Long.fromString(id)]);
const APPROVED = new Set(["approved", "accepted"]);
const DENIED = new Set(["denied", "banned", "auto_denied", "underage_kick"]);

type Dir = { _id: string; joinedAt?: Date | null; leftAt?: Date | null; inServer?: boolean };

async function joinApps(ids: string[]) {
  if (!ids.length) return new Map<string, Document>();
  const rows = await (await getBotCollection("join_applications")).find({ discordId: { $in: idsBoth(ids) } } as never, { projection: { discordId: 1, status: 1, submittedAt: 1, reviewedAt: 1 } }).sort({ submittedAt: 1 }).toArray();
  return new Map(rows.map((r) => [String(r.discordId), r]));
}

/** First message time and total messages per member (message index). */
async function messageStats(ids: string[]) {
  if (!ids.length) return new Map<string, { first: Date | null; n: number }>();
  const idx = await getBotCollection("message_index");
  const rows = await idx.aggregate([{ $match: { a: { $in: idsBoth(ids) } } }, { $group: { _id: { $toString: "$a" }, first: { $min: "$t" }, n: { $sum: 1 } } }]).toArray();
  return new Map(rows.map((r) => [String(r._id), { first: r.first instanceof Date ? r.first : null, n: Number(r.n) }]));
}

/** Messages per member per day between two dates (for each member's own "weeks 2–4" window). */
async function dailyMessages(ids: string[], from: Date, to: Date) {
  const out = new Map<string, Map<number, number>>();
  if (!ids.length) return out;
  const rows = await (await getBotCollection("message_index"))
    .aggregate([
      { $match: { a: { $in: idsBoth(ids) }, t: { $gte: from, $lt: to } } },
      { $group: { _id: { a: { $toString: "$a" }, d: { $dateTrunc: { date: "$t", unit: "day" } } }, n: { $sum: 1 } } },
    ])
    .toArray();
  for (const r of rows) {
    const m = out.get(String(r._id.a)) ?? new Map<number, number>();
    m.set((r._id.d as Date).getTime(), Number(r.n));
    out.set(String(r._id.a), m);
  }
  return out;
}

export type Cohort = { week: string; joined: number; applied: number; accepted: number; spoke: number; active: number | null; stayed: number | null };

/** The last `weeks` weeks of joiners, one row per week (Monday start, UTC). */
export async function joinFunnel(weeks = 8): Promise<Cohort[]> {
  const now = new Date();
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - ((now.getUTCDay() + 6) % 7)));
  const start = new Date(monday.getTime() - (weeks - 1) * 7 * DAY);
  const dir = (await (await site()).collection<Dir>("member_directory").find({ joinedAt: { $gte: start } }, { projection: { joinedAt: 1, leftAt: 1, inServer: 1 } }).toArray()) as Dir[];
  const out: Cohort[] = [];
  for (let w = 0; w < weeks; w += 1) {
    const from = new Date(start.getTime() + w * 7 * DAY);
    const to = new Date(from.getTime() + 7 * DAY);
    const people = dir.filter((d) => d.joinedAt && d.joinedAt >= from && d.joinedAt < to);
    const ids = people.map((p) => p._id);
    // A week's numbers are only final once its newest member is old enough
    const done28 = Date.now() - to.getTime() >= 28 * DAY;
    const done30 = Date.now() - to.getTime() >= 30 * DAY;
    const [apps, msgs, daily] = await Promise.all([joinApps(ids), messageStats(ids), done28 ? dailyMessages(ids, new Date(from.getTime() + 7 * DAY), new Date(to.getTime() + 28 * DAY)) : Promise.resolve(new Map<string, Map<number, number>>())]);
    // "Still chatting": 5+ messages in that member's own days 7–28
    const activeIn = (p: Dir) => {
      const j = p.joinedAt!.getTime();
      let n = 0;
      daily.get(p._id)?.forEach((count, dayStart) => {
        if (dayStart >= j + 7 * DAY - DAY && dayStart < j + 28 * DAY) n += count;
      });
      return n >= 5;
    };
    out.push({
      week: from.toISOString().slice(0, 10),
      joined: people.length,
      applied: ids.filter((id) => apps.has(id)).length,
      accepted: ids.filter((id) => APPROVED.has(String(apps.get(id)?.status))).length,
      spoke: ids.filter((id) => (msgs.get(id)?.n ?? 0) > 0).length,
      active: done28 ? people.filter(activeIn).length : null,
      stayed: done30 ? people.filter((p) => p.inServer !== false || (p.leftAt && p.joinedAt && p.leftAt.getTime() - p.joinedAt.getTime() > 30 * DAY)).length : null,
    });
  }
  return out;
}

export type LeaverStats = {
  days: number;
  total: number;
  stayed: { label: string; n: number }[];
  stage: { label: string; n: number }[];
  quietLeavers: number;
  punishedBefore: number;
  recent: { id: string; joinedAt: string | null; leftAt: string | null; stayedMs: number | null; stage: string; messages: number; punished: boolean }[];
};

/** Members who left in the last `days` days. */
export async function leavers(days = 30): Promise<LeaverStats> {
  const from = new Date(Date.now() - days * DAY);
  const dir = (await (await site()).collection<Dir>("member_directory").find({ inServer: false, leftAt: { $gte: from } }, { projection: { joinedAt: 1, leftAt: 1 } }).sort({ leftAt: -1 }).limit(2000).toArray()) as Dir[];
  const ids = dir.map((d) => d._id);
  const [apps, msgs, puns] = await Promise.all([
    joinApps(ids),
    messageStats(ids),
    ids.length
      ? getBotCollection("punishments").then((c) => c.aggregate([{ $match: { $or: [{ discordId: { $in: idsBoth(ids) } }, { user_discord_id: { $in: idsBoth(ids) } }], timestamp: { $gte: new Date(from.getTime() - 7 * DAY) } } }, { $group: { _id: { $toString: { $ifNull: ["$discordId", "$user_discord_id"] } }, last: { $max: "$timestamp" } } }]).toArray())
      : Promise.resolve([] as Document[]),
  ]);
  const punishedAt = new Map(puns.map((p) => [String(p._id), p.last as Date]));
  const buckets = [
    { label: "Under an hour", max: 3_600_000 },
    { label: "Under a day", max: DAY },
    { label: "Under a week", max: 7 * DAY },
    { label: "Under a month", max: 30 * DAY },
    { label: "A month or more", max: Infinity },
    { label: "Unknown", max: NaN },
  ];
  const stayedCount = new Map(buckets.map((b) => [b.label, 0]));
  const stageCount = new Map<string, number>();
  let quiet = 0;
  let punishedBefore = 0;
  const recent: LeaverStats["recent"] = [];
  for (const d of dir) {
    const stayedMs = d.joinedAt && d.leftAt ? d.leftAt.getTime() - d.joinedAt.getTime() : null;
    const b = stayedMs === null ? "Unknown" : buckets.find((x) => stayedMs < x.max)?.label ?? "A month or more";
    stayedCount.set(b, (stayedCount.get(b) ?? 0) + 1);
    const app = apps.get(d._id);
    const st = String(app?.status ?? "");
    const stage = !app ? "Never sent a join app" : APPROVED.has(st) ? "Accepted" : DENIED.has(st) ? "Denied" : st === "pending" ? "Join app still waiting" : "Join app closed";
    stageCount.set(stage, (stageCount.get(stage) ?? 0) + 1);
    const m = msgs.get(d._id)?.n ?? 0;
    if (m === 0) quiet += 1;
    const p = punishedAt.get(d._id);
    const punished = Boolean(p && d.leftAt && d.leftAt.getTime() - p.getTime() < 3 * DAY && d.leftAt >= p);
    if (punished) punishedBefore += 1;
    if (recent.length < 40) recent.push({ id: d._id, joinedAt: iso(d.joinedAt), leftAt: iso(d.leftAt), stayedMs, stage, messages: m, punished });
  }
  return {
    days,
    total: dir.length,
    stayed: buckets.map((b) => ({ label: b.label, n: stayedCount.get(b.label) ?? 0 })).filter((x) => x.label !== "Unknown" || x.n),
    stage: Array.from(stageCount, ([label, n]) => ({ label, n })).sort((a, b) => b.n - a.n),
    quietLeavers: quiet,
    punishedBefore,
    recent,
  };
}

export type EconomyHealth = {
  supply: number;
  holders: number;
  median: number;
  top1Share: number;
  top10Share: number;
  days: { day: string; store: number; gambled: number; houseNet: number; gifts: number }[];
  totals: { store: number; houseNet: number; gifts: number };
};

/** Leaves in circulation and where they went over the last `days` days. */
export async function economyHealth(days = 30): Promise<EconomyHealth> {
  const users = await getBotCollection("users");
  const balances = (await users.find({ balance: { $gt: 0 } }, { projection: { balance: 1 } }).toArray()).map((u) => Number(u.balance) || 0).sort((a, b) => b - a);
  const supply = balances.reduce((a, b) => a + b, 0);
  const share = (n: number) => (supply ? balances.slice(0, Math.max(1, Math.ceil(balances.length * n))).reduce((a, b) => a + b, 0) / supply : 0);
  const from = new Date(Date.now() - days * DAY);
  const byDay = (field: string, sum: unknown) => [{ $match: { [field]: { $gte: from } } }, { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: `$${field}` } }, n: { $sum: sum } } }];
  const [store, gamble, house, gifts] = await Promise.all([
    getBotCollection("store_sales").then((c) => c.aggregate(byDay("timestamp", { $ifNull: ["$price_paid", 0] })).toArray()).catch(() => []),
    getBotCollection("gambling_logs").then((c) => c.aggregate(byDay("timestamp", { $ifNull: ["$spent", 0] })).toArray()).catch(() => []),
    getBotCollection("gambling_logs").then((c) => c.aggregate(byDay("timestamp", { $multiply: [{ $ifNull: ["$net", 0] }, -1] })).toArray()).catch(() => []),
    getBotCollection("gift_log").then((c) => c.aggregate(byDay("timestamp", 1)).toArray()).catch(() => []),
  ]);
  const map = (rows: Document[]) => new Map(rows.map((r) => [String(r._id), Number(r.n) || 0]));
  const [s, g, h, gi] = [map(store), map(gamble), map(house), map(gifts)];
  const list: EconomyHealth["days"] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const day = new Date(Date.now() - i * DAY).toISOString().slice(0, 10);
    list.push({ day, store: s.get(day) ?? 0, gambled: g.get(day) ?? 0, houseNet: h.get(day) ?? 0, gifts: gi.get(day) ?? 0 });
  }
  return {
    supply,
    holders: balances.length,
    median: balances.length ? balances[Math.floor(balances.length / 2)] : 0,
    top1Share: share(0.01),
    top10Share: share(0.1),
    days: list,
    totals: { store: list.reduce((a, d) => a + d.store, 0), houseNet: list.reduce((a, d) => a + d.houseNet, 0), gifts: list.reduce((a, d) => a + d.gifts, 0) },
  };
}

export type EventResult = { id: string; title: string; startAt: string; going: number; chatted: number | null; goingAndChatted: number | null; channelId: string | null };
export type GiveawayResult = { id: string; title: string; endAt: string; entries: number; winners: number; awarded: number; newMembers: number };

/** Events from the last `days` days and giveaways that ended in them. */
export async function eventResults(days = 60) {
  const from = new Date(Date.now() - days * DAY);
  const [events, giveaways] = await Promise.all([
    getBotCollection("events").then((c) => c.find({ startAt: { $gte: from, $lte: new Date() }, deleted: { $ne: true }, cancelled: { $ne: true } }).sort({ startAt: -1 }).limit(40).toArray()),
    // Only finished giveaways (ones waiting for an admin's review aren't results yet)
    getBotCollection("giveaways").then((c) => c.find({ status: "ended", endAt: { $gte: from, $lte: new Date() } }).sort({ endAt: -1 }).limit(40).toArray()),
  ]);
  const rsvps = await getBotCollection("event_rsvps");
  const idx = await getBotCollection("message_index");
  const eventRows: EventResult[] = [];
  for (const e of events) {
    const going = (await rsvps.find({ eventId: String(e._id) }, { projection: { discordId: 1 } }).toArray()).map((r) => String(r.discordId));
    let chatted: number | null = null;
    let both: number | null = null;
    if (e.channelId && e.startAt instanceof Date) {
      const end = e.endAt instanceof Date ? e.endAt : new Date(e.startAt.getTime() + 2 * 3_600_000);
      const authors = (await idx.distinct("a", { c: { $in: [Long.fromString(String(e.channelId)), String(e.channelId)] }, t: { $gte: new Date(e.startAt.getTime() - 15 * 60_000), $lte: end } })).map(String);
      chatted = authors.length;
      const set = new Set(authors);
      both = going.filter((g) => set.has(g)).length;
    }
    eventRows.push({ id: String(e._id), title: String(e.title ?? ""), startAt: iso(e.startAt) ?? "", going: going.length, chatted, goingAndChatted: both, channelId: e.channelId ? String(e.channelId) : null });
  }
  const entriesCol = await getBotCollection("giveaway_entries");
  const dir = (await site()).collection<Dir>("member_directory");
  const giveawayRows: GiveawayResult[] = [];
  for (const g of giveaways) {
    const entrants = (await entriesCol.find({ giveawayId: String(g._id) }, { projection: { userId: 1 } }).toArray()).map((r) => String(r.userId));
    const start = g.startAt instanceof Date ? g.startAt : g.createdAt instanceof Date ? g.createdAt : null;
    const end = g.endAt instanceof Date ? g.endAt : null;
    // Entrants who joined the server while the giveaway was running (a rough "did it bring people in")
    const newMembers = start && end && entrants.length ? await dir.countDocuments({ _id: { $in: entrants }, joinedAt: { $gte: start, $lte: end } }) : 0;
    const results = (g.results ?? []) as { awarded?: boolean }[];
    giveawayRows.push({ id: String(g._id), title: String(g.title ?? ""), endAt: iso(g.endAt) ?? "", entries: entrants.length, winners: Number(g.winners ?? 1), awarded: results.filter((r) => r.awarded).length, newMembers });
  }
  return { events: eventRows, giveaways: giveawayRows };
}
