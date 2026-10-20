// Admin → Graphics: every stat graphic, worked out from the bot's and the website's data. Each entry says what
// it needs (a date range, a time zone, a role…) and returns a Spec the page draws. Results are cached for five
// minutes per set of options, so flicking between graphics is quick.
//
// Sources: bot.message_index (every message: author, channel, time), bot.member_activity (per-member chat
// details: topics, emojis, reactions, replies, voice), bot.users (levels, leaves, streaks, voice), casino,
// store, moderation, tickets, QOTD, Wordle, events, giveaways, Social, and the website's own records.

import { Long, type Document } from "mongodb";
import { people } from "../admin-people";
import { getGuildChannelsRaw } from "../discord-member";
import { membersSnapshot, type MMMember, type MMSnapshot } from "../members-manager";
import { getBotCollection, getMongoClient } from "../mongodb";
import { RANGES, ZONES, type Block, type Fmt, type Params, type Row, type Spec, type StatMeta, type Tile } from "./spec";

const DAY = 86_400_000;
const n = (v: unknown) => (typeof v === "number" ? v : v instanceof Long ? v.toNumber() : typeof v === "bigint" ? Number(v) : Number(v) || 0);
const fmt = (v: number) => Math.round(v).toLocaleString("en-US");
const pct = (a: number, b: number) => (b ? `${((a / b) * 100).toFixed(a / b < 0.1 && a ? 1 : 0)}%` : "0%");
const bot = (name: string) => getBotCollection(name);
const web = async (name: string) => (await getMongoClient()).db(process.env.MONGODB_DB ?? "website").collection(name);
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const HOUR = (h: number) => (h === 0 ? "12am" : h < 12 ? `${h}am` : h === 12 ? "12pm" : `${h - 12}pm`);

type Ctx = { p: Params; since: Date | null; tz: string; top: number; rangeText: string; snap: MMSnapshot };
type Stat = StatMeta & { run: (c: Ctx) => Promise<Spec> };

// ---------- helpers ----------

function amongIds(c: Ctx): string[] | null {
  if (!c.p.among) return null;
  const i = c.snap.roles.findIndex((r) => r.id === c.p.among);
  return c.snap.members.filter((m) => !m.bot && m.r.includes(i)).map((m) => m.id);
}
const roleName = (c: Ctx, id?: string) => c.snap.roles.find((r) => r.id === id)?.name ?? "that role";
const amongText = (c: Ctx) => (c.p.among ? ` · members with ${roleName(c, c.p.among)}` : "");
const botIds = (c: Ctx) => new Set(c.snap.members.filter((m) => m.bot).map((m) => m.id));

/** Filter for the message index: date range, optional role, no bots. */
function msgMatch(c: Ctx): Document {
  const m: Document = {};
  if (c.since) m.t = { $gte: c.since };
  const ids = amongIds(c);
  if (ids) m.a = { $in: ids.map((id) => Long.fromString(id)) };
  else {
    const bots = Array.from(botIds(c));
    if (bots.length) m.a = { $nin: bots.map((id) => Long.fromString(id)) };
  }
  return m;
}

async function names(ids: string[]) {
  const map = await people(ids).catch(() => ({}) as Record<string, { name: string }>);
  return (id: string) => map[id]?.name ?? "Unknown member";
}

let channelCache: { at: number; map: Map<string, string> } | null = null;
async function channelNames() {
  if (channelCache && Date.now() - channelCache.at < 10 * 60_000) return channelCache.map;
  const list = await getGuildChannelsRaw().catch(() => []);
  const map = new Map(list.map((ch) => [ch.id, `${ch.type === 2 ? "🔊 " : "#"}${ch.name}`]));
  if (map.size) channelCache = { at: Date.now(), map };
  return map;
}

/** Every day / week / month between `start` and now, so quiet periods show as zero instead of disappearing. */
function buckets(unit: "day" | "week" | "month", start: Date, tz: string) {
  const out: { key: string; label: string }[] = [];
  const d = new Date(start);
  const end = Date.now();
  const key = (x: Date) => {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(x);
    return unit === "month" ? parts.slice(0, 7) : parts;
  };
  const seen = new Set<string>();
  while (d.getTime() <= end) {
    const k = unit === "week" ? weekKey(d, tz) : key(d);
    if (!seen.has(k)) {
      seen.add(k);
      const label =
        unit === "month"
          ? new Date(`${k}-15T12:00:00Z`).toLocaleDateString("en-US", { month: "short", year: "2-digit" })
          : unit === "week"
            ? `wk of ${d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: tz })}`
            : d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: tz });
      out.push({ key: k, label });
    }
    d.setTime(d.getTime() + (unit === "month" ? 25 * DAY : unit === "week" ? 7 * DAY : DAY));
    // The last step can jump past now: make sure the current day / week / month is always there
    if (d.getTime() > end && d.getTime() - end < (unit === "month" ? 25 * DAY : unit === "week" ? 7 * DAY : DAY)) d.setTime(end);
  }
  return out;
}
function weekKey(d: Date, tz: string) {
  const local = new Date(new Date(d).toLocaleString("en-US", { timeZone: tz }));
  const day = (local.getDay() + 6) % 7;
  local.setDate(local.getDate() - day);
  return local.toLocaleDateString("en-CA");
}
const dateFormat = (unit: "day" | "week" | "month") => (unit === "month" ? "%Y-%m" : "%Y-%m-%d");

/** Counts per time bucket for any collection with a date field. */
async function series(col: Awaited<ReturnType<typeof bot>>, field: string, match: Document, unit: "day" | "week" | "month", c: Ctx, start: Date, sumField?: string) {
  const rows = await col
    .aggregate([
      { $match: { ...match, [field]: { ...(match[field] as Document | undefined), $gte: start } } },
      {
        $group: {
          _id: unit === "week" ? { $dateToString: { format: "%Y-%m-%d", date: { $dateTrunc: { date: `$${field}`, unit: "week", startOfWeek: "monday", timezone: c.tz } }, timezone: c.tz } } : { $dateToString: { format: dateFormat(unit), date: `$${field}`, timezone: c.tz } },
          v: sumField ? { $sum: `$${sumField}` } : { $sum: 1 },
        },
      },
    ])
    .toArray();
  const map = new Map(rows.map((r) => [String(r._id), n(r.v)]));
  const b = buckets(unit, start, c.tz);
  return { labels: b.map((x) => x.label), values: b.map((x) => map.get(x.key) ?? 0) };
}
/**
 * Where a trend starts: the chosen range, or for "All time" the oldest record there is (so all-time totals
 * really are all-time). Graphics without a range use `fallbackDays`.
 */
async function startAt(c: Ctx, col: { find: (f: Document, o?: Document) => { sort: (s: Document) => { limit: (n: number) => { toArray: () => Promise<Document[]> } } } }, field: string, fallbackDays: number, match: Document = {}) {
  if (c.since) return c.since;
  if (c.p.range === "all") {
    const [first] = await col.find({ ...match, [field]: { $type: "date" } }, { projection: { [field]: 1 } }).sort({ [field]: 1 }).limit(1).toArray();
    if (first?.[field] instanceof Date) return first[field] as Date;
  }
  return new Date(Date.now() - fallbackDays * DAY);
}
const unitFor = (c: Ctx): "day" | "week" | "month" => (c.p.range === "7" || c.p.range === "30" ? "day" : c.p.range === "90" ? "week" : "month");
const unitWord = (u: "day" | "week" | "month") => u;

/** A line of counts over time, with headline tiles. */
function trend(title: string, subtitle: string, s: { labels: string[]; values: number[] }, unit: string, what: string, footnote = ""): Spec {
  const total = s.values.reduce((a, b) => a + b, 0);
  const best = s.values.indexOf(Math.max(...s.values));
  const avg = s.values.length ? total / s.values.length : 0;
  const half = Math.floor(s.values.length / 2);
  const first = s.values.slice(0, half).reduce((a, b) => a + b, 0);
  const second = s.values.slice(half).reduce((a, b) => a + b, 0);
  const change = first ? ((second - first) / first) * 100 : 0;
  return {
    title,
    subtitle,
    footnote: `${footnote ? `${footnote} ` : ""}The current ${unit} is still in progress.`,
    tiles: [
      { label: `Total ${what}`, value: fmt(total) },
      { label: `Average per ${unit}`, value: avg >= 10 ? fmt(avg) : avg.toFixed(1) },
      { label: `Busiest ${unit}`, value: best >= 0 ? s.labels[best] : "—", note: best >= 0 ? `${fmt(s.values[best])} ${what}` : undefined },
      { label: "Second half vs first", value: first ? (Math.round(change) === 0 ? "0%" : `${change > 0 ? "+" : ""}${change.toFixed(0)}%`) : "—", note: "of the period shown" },
    ],
    main: { kind: s.labels.length > 40 ? "line" : "columns", title: `${what[0].toUpperCase()}${what.slice(1)} per ${unit}`, labels: s.labels, series: [{ name: what, values: s.values }], rows: s.labels.map((l, i) => ({ label: l, value: s.values[i] })) } as Block,
  };
}

/** Members' map fields added up (topics, emojis, channels…). */
async function sumMap(field: string, c: Ctx, keyName?: (k: string) => string, limit = 15) {
  const match: Document = { [field]: { $type: "object" } };
  const ids = amongIds(c);
  if (ids) match._id = { $in: ids };
  const rows = await (await bot("member_activity"))
    .aggregate([{ $match: match }, { $project: { kv: { $objectToArray: `$${field}` } } }, { $unwind: "$kv" }, { $group: { _id: "$kv.k", v: { $sum: "$kv.v" }, people: { $sum: 1 } } }, { $sort: { v: -1 } }, { $limit: limit }])
    .toArray();
  return rows.map((r) => ({ label: keyName ? keyName(String(r._id)) : String(r._id), value: n(r.v), note: `${fmt(n(r.people))} members` }));
}

/** Totals of number fields across members. */
async function sumFields(fields: string[], c: Ctx, col = "member_activity", idField = "_id") {
  const match: Document = {};
  const ids = amongIds(c);
  if (ids) match[idField] = { $in: idField === "_id" ? ids : ids.map((id) => Long.fromString(id)) };
  const [r] = await (await bot(col)).aggregate([{ $match: match }, { $group: { _id: null, people: { $sum: 1 }, ...Object.fromEntries(fields.map((f) => [f.replace(/\./g, "_"), { $sum: `$${f}` }])) } }]).toArray();
  return Object.fromEntries([["people", n(r?.people)], ...fields.map((f) => [f, n(r?.[f.replace(/\./g, "_")])])]) as Record<string, number>;
}

/** Top members by a number field (members still in the server only). */
async function leaders(c: Ctx, col: string, field: string, idField: string, opts: { title: string; format?: Fmt; min?: Document; asLong?: boolean; divide?: number } = { title: "" }) {
  const inServer = c.snap.members.filter((m) => !m.bot).map((m) => m.id);
  const ids = amongIds(c) ?? inServer;
  const idVals = opts.asLong === false ? ids : ids.flatMap((id) => [Long.fromString(id), id]);
  const docs = await (await bot(col))
    .find({ [idField]: { $in: idVals }, [field]: { $gt: 0 }, ...(opts.min ?? {}) } as Document, { projection: { [idField]: 1, [field]: 1 } })
    .sort({ [field]: -1 })
    .limit(c.top)
    .toArray();
  const nameOf = await names(docs.map((d) => String(d[idField])));
  const get = (d: Document) => field.split(".").reduce<unknown>((o, k) => (o as Document | undefined)?.[k], d);
  return docs.map((d) => ({ label: nameOf(String(d[idField])), value: n(get(d)) / (opts.divide ?? 1) }));
}

function board(title: string, subtitle: string, rows: Row[], what: string, format?: Fmt, footnote = ""): Spec {
  return {
    title,
    subtitle,
    footnote: footnote || "Members still in the server. Bots are not counted.",
    hero: rows[0] ? { label: "Number one", big: rows[0].label.length > 14 ? rows[0].label.slice(0, 13) + "…" : rows[0].label, caption: `${rows[0].label} leads with ${fmtV(rows[0].value, format)} ${what}.` } : undefined,
    main: { kind: "leaderboard", title, rows, format },
  };
}
const fmtV = (v: number, f?: Fmt) => (f === "hours" ? `${v.toFixed(v >= 100 ? 0 : 1)} hours` : fmt(v));

function bands(values: number[], edges: [number, number, string][]) {
  return edges.map(([a, b, label]) => ({ label, value: values.filter((v) => v >= a && v <= b).length }));
}

/** Converts the activity tracker's weekly hour keys (weekday × 24 + hour, UTC, Monday = 0) to the chosen zone. */
function shiftWeekHours(map: Map<number, number>, tz: string) {
  const offset = tzOffsetHours(tz);
  const out = new Map<number, number>();
  Array.from(map).forEach(([k, v]) => {
    const at = (((k + offset) % 168) + 168) % 168;
    out.set(at, (out.get(at) ?? 0) + v);
  });
  return out;
}
function tzOffsetHours(tz: string) {
  const d = new Date();
  const local = new Date(d.toLocaleString("en-US", { timeZone: tz }));
  const utc = new Date(d.toLocaleString("en-US", { timeZone: "UTC" }));
  return Math.round((local.getTime() - utc.getTime()) / 3_600_000);
}
async function weekHourTotals(field: "hours" | "voiceHours", c: Ctx) {
  const rows = await sumMap(field, c, undefined, 200);
  return shiftWeekHours(new Map(rows.map((r) => [Number(r.label), r.value])), c.tz);
}

function heatFromWeekHours(map: Map<number, number>) {
  const cells = WEEKDAYS.map((_, d) => Array.from({ length: 24 }, (_, h) => map.get(d * 24 + h) ?? 0));
  return { rows: WEEKDAYS, cols: Array.from({ length: 24 }, (_, h) => (h % 3 === 0 ? HOUR(h) : "")), cells, totals: cells.map((r) => r.reduce((a, b) => a + b, 0)) };
}

const zoneName = (tz: string) => ZONES.find((z) => z[0] === tz)?.[1] ?? tz;

// ---------- the graphics ----------

const STATS: Stat[] = [];
const add = (s: Stat) => STATS.push(s);

// ===== Chat =====
for (const unit of ["day", "week", "month"] as const) {
  add({
    id: `chat-per-${unit}`,
    category: "chat",
    title: `Messages per ${unit}`,
    blurb: `How busy the chat is, ${unit} by ${unit}.`,
    params: ["range", "among", "tz"],
    tags: ["messages", "activity", "trend"],
    run: async (c) => {
      const start = await startAt(c, await bot("message_index"), "t", unit === "day" ? 30 : unit === "week" ? 180 : 540, msgMatch(c));
      const s = await series(await bot("message_index"), "t", msgMatch(c), unit, c, start);
      return trend(`Messages per ${unit}`, `${c.rangeText}${amongText(c)}. Times in ${zoneName(c.tz)}.`, s, unit, "messages", "From the bot's message index. Deleted messages and bots are not counted.");
    },
  });
}

add({
  id: "chat-active-chatters",
  category: "chat",
  title: "Daily active chatters",
  blurb: "How many different members talk each day (or week / month).",
  params: ["range", "among", "tz"],
  tags: ["active", "unique", "members"],
  run: async (c) => {
    const unit = unitFor(c);
    const start = await startAt(c, await bot("message_index"), "t", 30, msgMatch(c));
    const rows = await (await bot("message_index"))
      .aggregate([
        { $match: { ...msgMatch(c), t: { $gte: start } } },
        { $group: { _id: { k: { $dateToString: { format: dateFormat(unit === "week" ? "day" : unit), date: unit === "week" ? { $dateTrunc: { date: "$t", unit: "week", startOfWeek: "monday", timezone: c.tz } } : "$t", timezone: c.tz } }, a: "$a" } } },
        { $group: { _id: "$_id.k", v: { $sum: 1 } } },
      ])
      .toArray();
    const map = new Map(rows.map((r) => [String(r._id), n(r.v)]));
    const b = buckets(unit, start, c.tz);
    return trend(`Active chatters per ${unit}`, `Different members who sent at least one message · ${c.rangeText}${amongText(c)}.`, { labels: b.map((x) => x.label), values: b.map((x) => map.get(x.key) ?? 0) }, unit, "chatters");
  },
});

add({
  id: "chat-hours",
  category: "chat",
  title: "Busiest hours of the day",
  blurb: "When people chat, hour by hour, in your time zone.",
  params: ["range", "among", "tz"],
  tags: ["time", "hour", "when"],
  run: async (c) => {
    const rows = await (await bot("message_index")).aggregate([{ $match: msgMatch(c) }, { $group: { _id: { $hour: { date: "$t", timezone: c.tz } }, v: { $sum: 1 } } }]).toArray();
    const map = new Map(rows.map((r) => [n(r._id), n(r.v)]));
    const vals = Array.from({ length: 24 }, (_, h) => map.get(h) ?? 0);
    const total = vals.reduce((a, b) => a + b, 0);
    const best = vals.indexOf(Math.max(...vals));
    const quiet = vals.indexOf(Math.min(...vals));
    const parts = [
      { label: "Night (12am–6am)", value: vals.slice(0, 6).reduce((a, b) => a + b, 0) },
      { label: "Morning (6am–12pm)", value: vals.slice(6, 12).reduce((a, b) => a + b, 0) },
      { label: "Afternoon (12pm–6pm)", value: vals.slice(12, 18).reduce((a, b) => a + b, 0) },
      { label: "Evening (6pm–12am)", value: vals.slice(18).reduce((a, b) => a + b, 0) },
    ];
    return {
      title: "When the chat is busiest",
      subtitle: `Messages by hour · ${c.rangeText}${amongText(c)} · ${zoneName(c.tz)} time.`,
      footnote: "From the bot's message index. Bots are not counted.",
      hero: { label: "Peak hour", big: HOUR(best), caption: `${pct(vals[best], total)} of messages are sent between ${HOUR(best)} and ${HOUR((best + 1) % 24)}. The quietest hour is ${HOUR(quiet)}.` },
      main: { kind: "columns", title: "Messages per hour", rows: vals.map((v, h) => ({ label: HOUR(h), value: v })) },
      bottom: { kind: "strip", title: "Time of day", rows: parts },
    };
  },
});

add({
  id: "chat-weekdays",
  category: "chat",
  title: "Busiest days of the week",
  blurb: "Which days people chat the most.",
  params: ["range", "among", "tz"],
  tags: ["weekday", "weekend", "when"],
  run: async (c) => {
    const rows = await (await bot("message_index")).aggregate([{ $match: msgMatch(c) }, { $group: { _id: { $isoDayOfWeek: { date: "$t", timezone: c.tz } }, v: { $sum: 1 } } }]).toArray();
    const map = new Map(rows.map((r) => [n(r._id), n(r.v)]));
    const vals = WEEKDAYS.map((_, i) => map.get(i + 1) ?? 0);
    const total = vals.reduce((a, b) => a + b, 0);
    const best = vals.indexOf(Math.max(...vals));
    const weekend = vals[5] + vals[6];
    return {
      title: "Busiest days of the week",
      subtitle: `Messages by weekday · ${c.rangeText}${amongText(c)} · ${zoneName(c.tz)} time.`,
      footnote: "From the bot's message index. Bots are not counted.",
      hero: { label: "Busiest day", big: WEEKDAYS[best], caption: `${pct(vals[best], total)} of all messages. Weekends (Sat + Sun) have ${pct(weekend, total)} of messages.` },
      main: { kind: "columns", title: "Messages per weekday", rows: vals.map((v, i) => ({ label: WEEKDAYS[i], value: v })) },
      bottom: { kind: "strip", title: "Weekdays vs weekend", rows: [{ label: "Mon–Fri", value: total - weekend }, { label: "Sat–Sun", value: weekend }] },
    };
  },
});

add({
  id: "chat-heatmap",
  category: "chat",
  title: "Activity heatmap (day × hour)",
  blurb: "Every hour of the week at a glance.",
  params: ["range", "among", "tz"],
  tags: ["heatmap", "when", "hour", "weekday"],
  run: async (c) => {
    const rows = await (await bot("message_index")).aggregate([{ $match: msgMatch(c) }, { $group: { _id: { d: { $isoDayOfWeek: { date: "$t", timezone: c.tz } }, h: { $hour: { date: "$t", timezone: c.tz } } }, v: { $sum: 1 } } }]).toArray();
    const map = new Map(rows.map((r) => [(n(r._id.d) - 1) * 24 + n(r._id.h), n(r.v)]));
    const h = heatFromWeekHours(map);
    let best = 0;
    map.forEach((v, k) => v > (map.get(best) ?? 0) && (best = k));
    return {
      title: "When the server is most active",
      subtitle: `Messages for every hour of the week · ${c.rangeText}${amongText(c)} · ${zoneName(c.tz)} time.`,
      footnote: "Stronger colour means more messages. From the bot's message index; bots are not counted.",
      main: { kind: "heat", title: `Busiest: ${WEEKDAYS[Math.floor(best / 24)]} at ${HOUR(best % 24)}`, ...h },
    };
  },
});

add({
  id: "chat-channels",
  category: "chat",
  title: "Top channels",
  blurb: "Where the messages go.",
  params: ["range", "among", "top"],
  tags: ["channels", "where"],
  run: async (c) => {
    const rows = await (await bot("message_index")).aggregate([{ $match: msgMatch(c) }, { $group: { _id: "$c", v: { $sum: 1 }, people: { $addToSet: "$a" } } }, { $project: { v: 1, p: { $size: "$people" } } }, { $sort: { v: -1 } }]).toArray();
    const ch = await channelNames();
    const total = rows.reduce((a, r) => a + n(r.v), 0);
    const list = rows.slice(0, c.top).map((r) => ({ label: ch.get(String(r._id)) ?? "#deleted-channel", value: n(r.v), note: `${fmt(n(r.p))} people` }));
    return {
      title: "Where people chat",
      subtitle: `Messages per channel · ${c.rangeText}${amongText(c)}.`,
      footnote: `${rows.length} channels had messages. From the bot's message index; bots are not counted.`,
      hero: list[0] ? { label: "Top channel", big: pct(list[0].value, total), caption: `of messages are in ${list[0].label}. The top 3 channels have ${pct(list.slice(0, 3).reduce((a, r) => a + r.value, 0), total)}.` } : undefined,
      main: { kind: "bars", title: "Messages per channel", rows: list, total, colorful: false },
    };
  },
});

add({
  id: "chat-channel-trend",
  category: "chat",
  title: "One channel over time",
  blurb: "Messages per day / week / month in a channel you pick.",
  params: ["channel", "range", "tz"],
  tags: ["channel", "trend"],
  run: async (c) => {
    const ch = await channelNames();
    const unit = unitFor(c);
    const match = { ...msgMatch(c), ...(c.p.channel ? { c: Long.fromString(c.p.channel) } : {}) };
    const start = await startAt(c, await bot("message_index"), "t", 30, match);
    const s = await series(await bot("message_index"), "t", match, unit, c, start);
    const name = c.p.channel ? ch.get(c.p.channel) ?? "the channel" : "all channels";
    return trend(`${name} over time`, `Messages per ${unit} in ${name} · ${c.rangeText}.`, s, unit, "messages");
  },
});

add({
  id: "chat-top-chatters",
  category: "chat",
  title: "Top chatters",
  blurb: "Who sent the most messages.",
  params: ["range", "among", "top"],
  tags: ["leaderboard", "messages"],
  run: async (c) => {
    const inServer = new Set(c.snap.members.filter((m) => !m.bot).map((m) => m.id));
    const rows = await (await bot("message_index")).aggregate([{ $match: msgMatch(c) }, { $group: { _id: "$a", v: { $sum: 1 } } }, { $sort: { v: -1 } }, { $limit: c.top * 3 }]).toArray();
    const list = rows.filter((r) => inServer.has(String(r._id))).slice(0, c.top);
    const nameOf = await names(list.map((r) => String(r._id)));
    return board("Top chatters", `Most messages · ${c.rangeText}${amongText(c)}.`, list.map((r) => ({ label: nameOf(String(r._id)), value: n(r.v) })), "messages");
  },
});

add({
  id: "chat-new-chatters",
  category: "chat",
  title: "First-time chatters per month",
  blurb: "Members sending their very first message, month by month.",
  params: ["among", "tz"],
  tags: ["new", "growth"],
  run: async (c) => {
    const rows = await (await bot("message_index"))
      .aggregate([{ $match: msgMatch({ ...c, since: null }) }, { $group: { _id: "$a", first: { $min: "$t" } } }, { $group: { _id: { $dateToString: { format: "%Y-%m", date: "$first", timezone: c.tz } }, v: { $sum: 1 } } }])
      .toArray();
    const map = new Map(rows.map((r) => [String(r._id), n(r.v)]));
    const b = buckets("month", new Date(Date.now() - 540 * DAY), c.tz);
    return trend("First-time chatters", `Members whose first message was that month${amongText(c)}.`, { labels: b.map((x) => x.label), values: b.map((x) => map.get(x.key) ?? 0) }, "month", "new chatters", "Based on the oldest message the bot has for each member.");
  },
});

add({
  id: "chat-distribution",
  category: "chat",
  title: "How much members chat",
  blurb: "Members grouped by how many messages they've sent, and how concentrated the chat is.",
  params: ["range", "among"],
  tags: ["distribution", "concentration"],
  run: async (c) => {
    const rows = await (await bot("message_index")).aggregate([{ $match: msgMatch(c) }, { $group: { _id: "$a", v: { $sum: 1 } } }, { $sort: { v: -1 } }]).toArray();
    const vals = rows.map((r) => n(r.v));
    const total = vals.reduce((a, b) => a + b, 0);
    const top10 = vals.slice(0, Math.max(1, Math.ceil(vals.length * 0.1))).reduce((a, b) => a + b, 0);
    return {
      title: "How much members chat",
      subtitle: `${fmt(vals.length)} members sent messages · ${c.rangeText}${amongText(c)}.`,
      footnote: "From the bot's message index. Bots are not counted.",
      hero: { label: "Top 10% of chatters", big: pct(top10, total), caption: `of all messages come from the busiest 10% of members (${fmt(Math.ceil(vals.length * 0.1))} people). The median member sent ${fmt(vals[Math.floor(vals.length / 2)] ?? 0)} messages.` },
      main: { kind: "columns", title: "Members by messages sent", rows: bands(vals, [[1, 9, "1–9"], [10, 49, "10–49"], [50, 199, "50–199"], [200, 999, "200–999"], [1000, 4999, "1K–5K"], [5000, 1e12, "5K+"]]) },
    };
  },
});

add({
  id: "chat-style",
  category: "chat",
  title: "How people write",
  blurb: "Words, characters, questions, replies, links, GIFs and media.",
  params: ["among"],
  tags: ["words", "media", "gifs", "questions"],
  run: async (c) => {
    const s = await sumFields(["messages", "words", "characters", "questions", "repliesSent", "conversationStarts", "links", "gifs", "attachments", "stickers", "edited", "emojiTotal"], c);
    return {
      title: "How the server writes",
      subtitle: `Across ${fmt(s.people)} members since the activity tracker started${amongText(c)}.`,
      footnote: "From the bot's activity tracker (member_activity).",
      tiles: [
        { label: "Messages", value: fmt(s.messages) },
        { label: "Words per message", value: s.messages ? (s.words / s.messages).toFixed(1) : "—" },
        { label: "Characters per message", value: s.messages ? (s.characters / s.messages).toFixed(0) : "—" },
        { label: "Questions asked", value: fmt(s.questions), note: `${pct(s.questions, s.messages)} of messages` },
      ],
      main: {
        kind: "bars",
        title: "What's in the messages",
        rows: [
          { label: "Replies", value: s.repliesSent },
          { label: "Emojis", value: s.emojiTotal },
          { label: "Conversations started", value: s.conversationStarts },
          { label: "Attachments", value: s.attachments },
          { label: "GIFs", value: s.gifs },
          { label: "Links", value: s.links },
          { label: "Edited messages", value: s.edited },
          { label: "Stickers", value: s.stickers },
        ].sort((a, b) => b.value - a.value),
        colorful: true,
      },
    };
  },
});

for (const [id, field, title, blurb, label] of [
  ["chat-topics", "topics", "What people talk about", "The most common conversation topics.", "Messages about it"],
  ["chat-emojis", "emojis", "Most used emojis", "Emojis members type the most.", "Times used"],
  ["chat-reactions", "reactionsReceivedEmojis", "Most used reactions", "The reactions people put on messages.", "Times used"],
  ["chat-commands", "commands", "Most used bot commands", "Slash commands members run the most.", "Times used"],
  ["chat-media", "media", "Media shared", "Images, videos and audio.", "Files"],
] as const) {
  add({
    id,
    category: "chat",
    title,
    blurb,
    params: ["among", "top"],
    tags: [field],
    run: async (c) => {
      const rows = await sumMap(field, c, (k) => (field.includes("moji") || field === "reactionsReceivedEmojis" ? (k.includes(":") ? `:${k.split(":")[0]}:` : k) : field === "commands" ? `/${k}` : k[0].toUpperCase() + k.slice(1)), c.top);
      const total = rows.reduce((a, r) => a + r.value, 0);
      return {
        title,
        subtitle: `Since the activity tracker started${amongText(c)}.`,
        footnote: "From the bot's activity tracker (member_activity).",
        hero: rows[0] ? { label: "Number one", big: rows[0].label.length > 12 ? rows[0].label.slice(0, 11) + "…" : rows[0].label, caption: `${fmt(rows[0].value)} times, by ${rows[0].note}.` } : undefined,
        main: { kind: "bars", title: label, rows, total, colorful: false },
      };
    },
  });
}

for (const [id, field, title, what, min] of [
  ["chat-most-replied", "repliesReceived", "Most replied to", "replies received", null],
  ["chat-conversation-starters", "conversationStarts", "Conversation starters", "conversations started", null],
  ["chat-reactions-received", "reactionsReceived", "Most reactions received", "reactions received", null],
  ["chat-question-askers", "questions", "Most curious members", "questions asked", null],
  ["chat-wordiest", "words", "Wordiest members", "words written", null],
] as const) {
  add({
    id,
    category: "chat",
    title,
    blurb: `Members with the most ${what}.`,
    params: ["among", "top"],
    tags: ["leaderboard", field],
    run: async (c) => board(title, `Since the activity tracker started${amongText(c)}.`, await leaders(c, "member_activity", field, "_id", { title, asLong: false, min: min ?? undefined }), what),
  });
}

add({
  id: "chat-fastest-repliers",
  category: "chat",
  title: "Fastest repliers",
  blurb: "Average time to reply (members with 25+ replies).",
  params: ["among", "top"],
  tags: ["leaderboard", "replies", "speed"],
  run: async (c) => {
    const ids = amongIds(c) ?? c.snap.members.filter((m) => !m.bot).map((m) => m.id);
    const docs = await (await bot("member_activity"))
      .aggregate([{ $match: { _id: { $in: ids }, replyDelayCount: { $gte: 25 } } }, { $project: { avg: { $divide: ["$replyDelaySum", "$replyDelayCount"] } } }, { $sort: { avg: 1 } }, { $limit: c.top }])
      .toArray();
    const nameOf = await names(docs.map((d) => String(d._id)));
    const rows = docs.map((d) => ({ label: nameOf(String(d._id)), value: n(d.avg) / 60 }));
    return {
      title: "Fastest repliers",
      subtitle: `Average minutes before replying · members with 25+ replies${amongText(c)}.`,
      footnote: "Shorter is faster. From the bot's activity tracker.",
      main: { kind: "leaderboard", title: "Average reply time", rows, format: "minutes" },
    };
  },
});

add({
  id: "chat-activity-week",
  category: "chat",
  title: "Weekly rhythm (tracker)",
  blurb: "Day × hour heatmap from the activity tracker (includes older history).",
  params: ["among", "tz"],
  tags: ["heatmap"],
  run: async (c) => {
    const map = await weekHourTotals("hours", c);
    return { title: "The server's weekly rhythm", subtitle: `Messages for every hour of the week${amongText(c)} · ${zoneName(c.tz)} time.`, footnote: "From the bot's activity tracker. Stronger colour means more messages.", main: { kind: "heat", title: "Messages by day and hour", ...heatFromWeekHours(map) } };
  },
});

// ===== Voice =====
add({
  id: "voice-overview",
  category: "voice",
  title: "Voice chat overview",
  blurb: "Total voice hours, sessions, streaming and the longest session.",
  params: ["among"],
  tags: ["voice", "vc"],
  run: async (c) => {
    const s = await sumFields(["voiceSeconds", "voiceSessions", "voiceJoins", "voiceWithOthersSeconds", "streamSeconds"], c);
    const longest = await leaders(c, "member_activity", "voiceLongestSession", "_id", { title: "", asLong: false, divide: 3600 });
    const channels = await sumMap("voiceChannels", c, undefined, 8);
    const ch = await channelNames();
    return {
      title: "Voice chat at a glance",
      subtitle: `Since voice tracking started${amongText(c)}.`,
      footnote: "From the bot's activity tracker.",
      tiles: [
        { label: "Hours in voice", value: fmt(s.voiceSeconds / 3600) },
        { label: "Sessions", value: fmt(s.voiceSessions) },
        { label: "With others", value: pct(s.voiceWithOthersSeconds, s.voiceSeconds), note: "of voice time" },
        { label: "Hours streaming", value: fmt(s.streamSeconds / 3600) },
      ],
      main: { kind: "bars", title: "Hours per voice channel", rows: channels.map((r) => ({ label: ch.get(r.label) ?? "Deleted channel", value: r.value / 3600, note: r.note })), format: "hours" },
      side: { kind: "leaderboard", title: "Longest single sessions", rows: longest.slice(0, 8), format: "hours" },
    };
  },
});
add({
  id: "voice-top",
  category: "voice",
  title: "Top voice chatters",
  blurb: "Most hours in voice.",
  params: ["among", "top"],
  tags: ["leaderboard", "voice"],
  run: async (c) => board("Top voice chatters", `Total hours in voice channels${amongText(c)}.`, await leaders(c, "users", "vc_time_total", "discordId", { title: "", divide: 3600, format: "hours" }), "hours in voice", "hours"),
});
add({
  id: "voice-heatmap",
  category: "voice",
  title: "When people are in voice",
  blurb: "Day × hour heatmap of voice time.",
  params: ["among", "tz"],
  tags: ["heatmap", "voice"],
  run: async (c) => {
    const map = await weekHourTotals("voiceHours", c);
    return { title: "When voice chat is busiest", subtitle: `Voice time for every hour of the week${amongText(c)} · ${zoneName(c.tz)} time.`, footnote: "From the bot's activity tracker.", main: { kind: "heat", title: "Voice minutes by day and hour", ...heatFromWeekHours(new Map(Array.from(map).map(([k, v]) => [k, Math.round(v / 60)]))) } };
  },
});
add({
  id: "voice-rewards",
  category: "voice",
  title: "Voice rewards over time",
  blurb: "Hours of rewarded voice time per day / week / month.",
  params: ["range", "tz"],
  tags: ["voice", "trend"],
  run: async (c) => {
    const unit = unitFor(c);
    const s = await series((await web("vc_rewards")) as never, "ts", {}, unit, c, await startAt(c, (await web("vc_rewards")) as never, "ts", 30), "seconds");
    return trend("Voice time over time", `Rewarded voice hours per ${unit} · ${c.rangeText}.`, { labels: s.labels, values: s.values.map((v) => Math.round(v / 3600)) }, unit, "hours", "From the voice reward history (kept for a year).");
  },
});

// ===== Levels & economy =====
add({
  id: "levels-spread",
  category: "levels",
  title: "Level spread",
  blurb: "Members per level band, average and highest level.",
  params: ["among"],
  tags: ["levels", "xp"],
  run: async (c) => {
    const ms = members(c);
    const lv = ms.map((m) => m.level ?? 0);
    const withLv = lv.filter((x) => x > 0);
    return {
      title: "Level spread",
      subtitle: `${fmt(ms.length)} members${amongText(c)}.`,
      footnote: "Levels come from chat and voice XP. Bots are not counted.",
      tiles: [
        { label: "Average level", value: withLv.length ? (withLv.reduce((a, b) => a + b, 0) / withLv.length).toFixed(1) : "—" },
        { label: "Highest level", value: String(Math.max(0, ...lv)) },
        { label: "Level 10+", value: fmt(lv.filter((x) => x >= 10).length), note: pct(lv.filter((x) => x >= 10).length, ms.length) },
        { label: "Level 25+", value: fmt(lv.filter((x) => x >= 25).length), note: pct(lv.filter((x) => x >= 25).length, ms.length) },
      ],
      main: { kind: "columns", title: "Members per level band", rows: bands(lv, [[0, 0, "No level"], [1, 4, "1–4"], [5, 9, "5–9"], [10, 14, "10–14"], [15, 19, "15–19"], [20, 29, "20–29"], [30, 49, "30–49"], [50, 1e9, "50+"]]) },
    };
  },
});
add({ id: "levels-top", category: "levels", title: "Highest levels", blurb: "The top members by level.", params: ["among", "top"], tags: ["leaderboard", "levels"], run: async (c) => board("Highest levels", `Members by level${amongText(c)}.`, await leadersBy(c, (m) => m.level ?? 0), "levels") });
add({
  id: "economy-wealth",
  category: "levels",
  title: "Wealth spread",
  blurb: "How leaves are spread across members, and how much the richest hold.",
  params: ["among"],
  tags: ["leaves", "balance", "economy"],
  run: async (c) => {
    const vals = members(c)
      .map((m) => m.balance ?? 0)
      .sort((a, b) => b - a);
    const total = vals.reduce((a, b) => a + b, 0);
    const top1 = vals.slice(0, Math.max(1, Math.ceil(vals.length * 0.01))).reduce((a, b) => a + b, 0);
    const top10 = vals.slice(0, Math.max(1, Math.ceil(vals.length * 0.1))).reduce((a, b) => a + b, 0);
    return {
      title: "How leaves are spread",
      subtitle: `${fmt(total)} leaves held by ${fmt(vals.length)} members${amongText(c)}.`,
      footnote: "Current balances. Bots are not counted.",
      hero: { label: "Richest 10%", big: pct(top10, total), caption: `of all leaves belong to the richest 10% of members. The top 1% hold ${pct(top1, total)}. The median balance is ${fmt(vals[Math.floor(vals.length / 2)] ?? 0)}.` },
      main: { kind: "columns", title: "Members by balance", rows: bands(vals, [[0, 99, "<100"], [100, 999, "100–999"], [1000, 4999, "1K–5K"], [5000, 19999, "5K–20K"], [20000, 99999, "20K–100K"], [100000, 999999, "100K–1M"], [1e6, 1e15, "1M+"]]) },
    };
  },
});
add({ id: "economy-richest", category: "levels", title: "Richest members", blurb: "Biggest leaf balances.", params: ["among", "top"], tags: ["leaderboard", "leaves"], run: async (c) => board("Richest members", `Current leaf balances${amongText(c)}.`, await leadersBy(c, (m) => m.balance ?? 0), "leaves", "leaves") });
add({
  id: "economy-streaks",
  category: "levels",
  title: "Daily reward streaks",
  blurb: "How long members keep their daily streak going.",
  params: ["among", "top"],
  tags: ["daily", "streak"],
  run: async (c) => {
    const ids = amongIds(c) ?? c.snap.members.filter((m) => !m.bot).map((m) => m.id);
    const docs = await (await bot("users")).find({ discordId: { $in: ids.flatMap((id) => [Long.fromString(id), id]) }, streak: { $gt: 0 } } as Document, { projection: { discordId: 1, streak: 1 } }).toArray();
    const vals = docs.map((d) => n(d.streak)).sort((a, b) => b - a);
    const top = docs.sort((a, b) => n(b.streak) - n(a.streak)).slice(0, 8);
    const nameOf = await names(top.map((d) => String(d.discordId)));
    return {
      title: "Daily reward streaks",
      subtitle: `${fmt(vals.length)} members have a streak going${amongText(c)}.`,
      footnote: "Current streaks from /daily and the website's Daily Reward.",
      main: { kind: "columns", title: "Members by streak length", rows: bands(vals, [[1, 2, "1–2 days"], [3, 6, "3–6"], [7, 13, "1–2 weeks"], [14, 29, "2–4 weeks"], [30, 89, "1–3 months"], [90, 1e9, "3+ months"]]) },
      side: { kind: "leaderboard", title: "Longest streaks", rows: top.map((d) => ({ label: nameOf(String(d.discordId)), value: n(d.streak) })) },
    };
  },
});
add({ id: "economy-bumps", category: "levels", title: "Top bumpers", blurb: "Who bumps the server the most.", params: ["top"], tags: ["leaderboard", "bumps"], run: async (c) => board("Top bumpers", "All-time server bumps.", await leaders(c, "users", "bumpCount", "discordId", { title: "" }), "bumps") });

// ===== Casino =====
const GAME_NAMES: Record<string, string> = { slots: "Slots", blackjack: "Blackjack", scratchoff: "Scratch-offs", roulette: "Roulette", mines: "Mines", crash: "Crash", coinflip: "Coinflip" };
const gameName = (g: string) => GAME_NAMES[g] ?? (g ? g[0].toUpperCase() + g.slice(1) : "Other");
function casinoMatch(c: Ctx): Document {
  const m: Document = {};
  if (c.since) m.timestamp = { $gte: c.since };
  const ids = amongIds(c);
  if (ids) m.discordId = { $in: ids.map((id) => Long.fromString(id)) };
  // Older slots logs were saved without a game name
  if (c.p.game) Object.assign(m, c.p.game === "slots" ? { $or: [{ game: "slots" }, { game: { $exists: false } }, { game: null }] } : { game: c.p.game });
  return m;
}
add({
  id: "casino-games",
  category: "casino",
  title: "Casino games compared",
  blurb: "Plays, leaves bet and the house's take for every game.",
  params: ["range", "among"],
  tags: ["gambling", "games"],
  run: async (c) => {
    const rows = await (await bot("gambling_logs")).aggregate([{ $match: casinoMatch({ ...c, p: { ...c.p, game: undefined } }) }, { $group: { _id: { $ifNull: ["$game", "slots"] }, plays: { $sum: 1 }, spent: { $sum: "$spent" }, won: { $sum: "$won" }, wins: { $sum: { $cond: [{ $gt: ["$net", 0] }, 1, 0] } } } }, { $sort: { plays: -1 } }]).toArray();
    const plays = rows.reduce((a, r) => a + n(r.plays), 0);
    const spent = rows.reduce((a, r) => a + n(r.spent), 0);
    const won = rows.reduce((a, r) => a + n(r.won), 0);
    return {
      title: "Casino games compared",
      subtitle: `${c.rangeText}${amongText(c)}.`,
      footnote: "House take = leaves bet minus leaves paid out. From the gambling history (kept 180 days).",
      tiles: [
        { label: "Games played", value: fmt(plays) },
        { label: "Leaves bet", value: fmt(spent) },
        { label: "Paid back", value: pct(won, spent), note: "of every leaf bet" },
        { label: "House take", value: fmt(spent - won) },
      ],
      main: { kind: "bars", title: "Plays per game", rows: rows.map((r) => ({ label: gameName(String(r._id)), value: n(r.plays), note: `${pct(n(r.wins), n(r.plays))} won` })), total: plays, colorful: true },
      side: { kind: "bars", title: "Paid back per 100 leaves bet", rows: rows.map((r) => ({ label: gameName(String(r._id)), value: n(r.spent) ? (n(r.won) / n(r.spent)) * 100 : 0 })), format: "number" },
    };
  },
});
add({
  id: "casino-per-day",
  category: "casino",
  title: "Casino plays over time",
  blurb: "Games played per day / week / month (optionally one game).",
  params: ["range", "game", "tz"],
  tags: ["gambling", "trend"],
  run: async (c) => {
    const unit = unitFor(c);
    const s = await series(await bot("gambling_logs"), "timestamp", casinoMatch(c), unit, c, await startAt(c, await bot("gambling_logs"), "timestamp", 30));
    return trend(`${c.p.game ? gameName(c.p.game) : "Casino"} plays over time`, `Games per ${unit} · ${c.rangeText}.`, s, unit, "games", "From the gambling history (kept 180 days).");
  },
});
add({
  id: "casino-sources",
  category: "casino",
  title: "Discord vs website gambling",
  blurb: "Where people play.",
  params: ["range"],
  tags: ["gambling", "website"],
  run: async (c) => {
    const rows = await (await bot("gambling_logs")).aggregate([{ $match: casinoMatch(c) }, { $group: { _id: { $ifNull: ["$source", "discord"] }, v: { $sum: 1 } } }]).toArray();
    const r = rows.map((x) => ({ label: String(x._id) === "website" ? "Website" : "Discord", value: n(x.v) }));
    const total = r.reduce((a, b) => a + b.value, 0);
    const site = r.find((x) => x.label === "Website")?.value ?? 0;
    return { title: "Where people gamble", subtitle: c.rangeText, footnote: "From the gambling history (kept 180 days).", hero: { label: "On the website", big: pct(site, total), caption: `${fmt(site)} of ${fmt(total)} games were played on the website's Games tab.` }, main: { kind: "bars", title: "Games played", rows: r, total, colorful: true } };
  },
});
for (const [id, field, title, what] of [
  ["casino-biggest-wins", "biggest_win", "Biggest single wins", "leaves in one game"],
  ["casino-most-played", "total_spins", "Most games played", "games"],
  ["casino-top-winners", "net_profit", "Luckiest gamblers", "leaves of profit"],
] as const) {
  add({ id, category: "casino", title, blurb: `All-time: ${what}.`, params: ["among", "top"], tags: ["leaderboard", "gambling"], run: async (c) => board(title, `All-time casino stats${amongText(c)}.`, await leaders(c, "gambling", field, "discordId", { title }), what, "leaves") });
}

// ===== Store & gifts =====
async function itemNames() {
  const docs = await (await bot("store_inventory")).find({}, { projection: { item_id: 1, name: 1 } }).toArray();
  const m = new Map(docs.map((d) => [String(d.item_id), String(d.name ?? d.item_id)]));
  return (id: string) => m.get(id) ?? id.replace(/_/g, " ");
}
add({
  id: "store-top-items",
  category: "store",
  title: "Best-selling items",
  blurb: "What members buy the most.",
  params: ["range", "top"],
  tags: ["store", "sales"],
  run: async (c) => {
    const rows = await (await bot("store_sales")).aggregate([{ $match: c.since ? { timestamp: { $gte: c.since } } : {} }, { $group: { _id: "$item_id", q: { $sum: { $ifNull: ["$quantity", 1] } }, leaves: { $sum: "$price_paid" } } }, { $sort: { q: -1 } }]).toArray();
    const name = await itemNames();
    const total = rows.reduce((a, r) => a + n(r.q), 0);
    const spent = rows.reduce((a, r) => a + n(r.leaves), 0);
    return {
      title: "Best-selling store items",
      subtitle: c.rangeText,
      footnote: "From store purchases (Discord and website).",
      tiles: [
        { label: "Items sold", value: fmt(total) },
        { label: "Leaves spent", value: fmt(spent) },
        { label: "Different items", value: fmt(rows.length) },
      ],
      main: { kind: "bars", title: "Copies sold", rows: rows.slice(0, c.top).map((r) => ({ label: name(String(r._id)), value: n(r.q), note: `${fmt(n(r.leaves))} leaves` })), total },
    };
  },
});
add({
  id: "store-spending",
  category: "store",
  title: "Store spending over time",
  blurb: "Leaves spent in the store per day / week / month.",
  params: ["range", "tz"],
  tags: ["store", "trend"],
  run: async (c) => {
    const unit = unitFor(c);
    const s = await series(await bot("store_sales"), "timestamp", {}, unit, c, await startAt(c, await bot("store_sales"), "timestamp", 30), "price_paid");
    return trend("Store spending", `Leaves spent per ${unit} · ${c.rangeText}.`, s, unit, "leaves");
  },
});
add({
  id: "store-owned",
  category: "store",
  title: "Most owned items",
  blurb: "Items in the most inventories right now.",
  params: ["top"],
  tags: ["inventory"],
  run: async (c) => {
    const rows = await (await bot("user_inventory")).aggregate([{ $group: { _id: "$name", v: { $sum: 1 }, people: { $addToSet: "$discordId" } } }, { $project: { v: 1, p: { $size: "$people" } } }, { $sort: { p: -1 } }, { $limit: c.top }]).toArray();
    return { title: "Most owned items", subtitle: "Inventories right now.", footnote: "Counts each member once per item.", main: { kind: "bars", title: "Members who own it", rows: rows.map((r) => ({ label: String(r._id ?? "Item"), value: n(r.p), note: `${fmt(n(r.v))} copies` })) } };
  },
});
add({
  id: "store-gifts",
  category: "store",
  title: "Gifts",
  blurb: "Gifts sent over time and the most generous members.",
  params: ["range", "top"],
  tags: ["gifts"],
  run: async (c) => {
    const match = c.since ? { timestamp: { $gte: c.since } } : {};
    const top = await (await bot("gift_log")).aggregate([{ $match: match }, { $group: { _id: "$sender_id", v: { $sum: 1 } } }, { $sort: { v: -1 } }, { $limit: 8 }]).toArray();
    const items = await (await bot("gift_log")).aggregate([{ $match: match }, { $group: { _id: "$item_id", v: { $sum: 1 } } }, { $sort: { v: -1 } }, { $limit: c.top }]).toArray();
    const nameOf = await names(top.map((r) => String(r._id)));
    const item = await itemNames();
    const total = items.reduce((a, r) => a + n(r.v), 0);
    return {
      title: "Gifting in the Nation",
      subtitle: `${fmt(total)} gifts · ${c.rangeText}.`,
      footnote: "From the gift log (kept a year).",
      main: { kind: "bars", title: "Most gifted items", rows: items.map((r) => ({ label: item(String(r._id)), value: n(r.v) })), total },
      side: { kind: "leaderboard", title: "Most generous", rows: top.map((r) => ({ label: nameOf(String(r._id)), value: n(r.v) })) },
    };
  },
});

// ===== Community =====
add({
  id: "qotd-answers",
  category: "community",
  title: "Question of the Day",
  blurb: "Answers over time, correct rate and the best streaks.",
  params: ["range", "tz"],
  tags: ["qotd"],
  run: async (c) => {
    const unit = unitFor(c);
    const s = await series(await bot("qotdAnswers"), "answered_at", {}, unit, c, await startAt(c, await bot("qotdAnswers"), "answered_at", 30));
    const totals = await (await bot("qotd")).aggregate([{ $group: { _id: null, people: { $sum: 1 }, answered: { $sum: "$total_answered" }, correct: { $sum: "$total_correct" }, leaves: { $sum: "$leaves_earned" } } }]).toArray();
    const t = totals[0] ?? {};
    const best = await leaders(c, "qotd", "best", "user_id", { title: "" });
    return {
      title: "Question of the Day",
      subtitle: `Answers per ${unit} · ${c.rangeText}.`,
      footnote: "From the Question of the Day records.",
      tiles: [
        { label: "Players", value: fmt(n(t.people)) },
        { label: "Answers", value: fmt(n(t.answered)) },
        { label: "Correct", value: pct(n(t.correct), n(t.answered)) },
        { label: "Leaves earned", value: fmt(n(t.leaves)) },
      ],
      main: { kind: s.labels.length > 40 ? "line" : "columns", title: "Answers", labels: s.labels, series: [{ name: "Answers", values: s.values }], rows: s.labels.map((l, i) => ({ label: l, value: s.values[i] })) } as Block,
      side: { kind: "leaderboard", title: "Best streaks", rows: best.slice(0, 8) },
    };
  },
});
add({
  id: "wordle-overview",
  category: "community",
  title: "Wordle",
  blurb: "Players, wins and how many guesses it takes.",
  params: [],
  tags: ["wordle", "games"],
  run: async () => {
    const docs = await (await bot("wordle")).find({}, { projection: { wordle_target: 1, wordle_guesses: 1, wordle_active: 1 } }).toArray();
    const finished = docs.filter((d) => !d.wordle_active && Array.isArray(d.wordle_guesses) && d.wordle_guesses.length && String(d.wordle_target ?? "").length === 5);
    const won = finished.filter((d) => d.wordle_guesses[d.wordle_guesses.length - 1] === d.wordle_target);
    const dist = [1, 2, 3, 4, 5, 6].map((g) => ({ label: `${g} guess${g > 1 ? "es" : ""}`, value: won.filter((d) => d.wordle_guesses.length === g).length }));
    const avg = won.length ? won.reduce((a, d) => a + d.wordle_guesses.length, 0) / won.length : 0;
    return {
      title: "Wordle in the Nation",
      subtitle: `${fmt(docs.length)} members have played. Based on each player's latest game.`,
      footnote: "Discord and website games share one record per member, so this shows the most recent game for each.",
      tiles: [
        { label: "Players", value: fmt(docs.length) },
        { label: "Playing right now", value: fmt(docs.filter((d) => d.wordle_active).length) },
        { label: "Latest game won", value: pct(won.length, finished.length) },
        { label: "Average guesses", value: avg ? avg.toFixed(2) : "—", note: "when solved" },
      ],
      main: { kind: "columns", title: "Solved in…", rows: dist },
    };
  },
});
add({
  id: "giveaways-overview",
  category: "community",
  title: "Giveaways",
  blurb: "Entries per giveaway and how people enter.",
  params: ["top"],
  tags: ["giveaways"],
  run: async (c) => {
    const gws = await (await bot("giveaways")).find({}, { projection: { title: 1, status: 1, createdAt: 1 } }).sort({ createdAt: -1 }).limit(60).toArray();
    const counts = await (await bot("giveaway_entries")).aggregate([{ $group: { _id: "$giveawayId", v: { $sum: 1 } } }]).toArray();
    const via = await (await bot("giveaway_entries")).aggregate([{ $group: { _id: { $ifNull: ["$via", "discord"] }, v: { $sum: 1 } } }]).toArray();
    const map = new Map(counts.map((r) => [String(r._id), n(r.v)]));
    const rows = gws.map((g) => ({ label: String(g.title ?? "Giveaway"), value: map.get(String(g._id)) ?? 0 })).sort((a, b) => b.value - a.value).slice(0, c.top);
    const total = counts.reduce((a, r) => a + n(r.v), 0);
    return {
      title: "Giveaways",
      subtitle: `${fmt(gws.length)} giveaways, ${fmt(total)} entries.`,
      footnote: "From the giveaway records.",
      main: { kind: "bars", title: "Entries per giveaway", rows },
      bottom: { kind: "strip", title: "How people entered", rows: via.map((v) => ({ label: String(v._id) === "website" ? "Website" : String(v._id) === "discord" ? "Discord button" : String(v._id), value: n(v.v) })) },
    };
  },
});
add({
  id: "events-per-month",
  category: "community",
  title: "Events held",
  blurb: "Server events per month and by kind.",
  params: ["tz"],
  tags: ["events"],
  run: async (c) => {
    const s = await series(await bot("events"), "startAt", {}, "month", c, new Date(Date.now() - 365 * DAY));
    const kinds = await (await bot("events")).aggregate([{ $group: { _id: "$kind", v: { $sum: 1 } } }, { $sort: { v: -1 } }]).toArray();
    return { title: "Events in the Nation", subtitle: "Events per month over the last year.", footnote: "From Admin → Events.", main: { kind: "columns", title: "Events per month", rows: s.labels.map((l, i) => ({ label: l, value: s.values[i] })) }, side: { kind: "bars", title: "By kind", rows: kinds.map((k) => ({ label: String(k._id ?? "other").replace(/^\w/, (x) => x.toUpperCase()), value: n(k.v) })), colorful: true } };
  },
});

// ===== Social =====
add({
  id: "social-profiles",
  category: "social",
  title: "Social profiles",
  blurb: "Who's on Social: gender, looking for dating, ages and activity.",
  params: [],
  tags: ["social", "dating"],
  run: async () => {
    const docs = await (await bot("dating_profiles")).find({}, { projection: { gender: 1, is_looking: 1, age: 1, last_active: 1, updated_at: 1 } }).toArray();
    const g = new Map<string, number>();
    docs.forEach((d) => g.set(String(d.gender || "Not said"), (g.get(String(d.gender || "Not said")) ?? 0) + 1));
    const ages = docs.map((d) => n(d.age)).filter((a) => a >= 18);
    const looking = docs.filter((d) => /^yes/i.test(String(d.is_looking))).length;
    const active30 = docs.filter((d) => (d.last_active ?? d.updated_at) && Date.now() - new Date(d.last_active ?? d.updated_at).getTime() < 30 * DAY).length;
    return {
      title: "Social profiles",
      subtitle: `${fmt(docs.length)} profiles.`,
      footnote: "From Social profiles. Ages only for profiles that list one.",
      tiles: [
        { label: "Profiles", value: fmt(docs.length) },
        { label: "Open to dating", value: pct(looking, docs.length) },
        { label: "Active in 30 days", value: fmt(active30) },
        { label: "Median age", value: ages.length ? String(ages.sort((a, b) => a - b)[Math.floor(ages.length / 2)]) : "—" },
      ],
      main: { kind: "bars", title: "Profiles by gender", rows: Array.from(g).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, 10), total: docs.length, colorful: true },
      side: { kind: "columns", title: "Ages", rows: bands(ages, [[18, 20, "18–20"], [21, 24, "21–24"], [25, 29, "25–29"], [30, 34, "30–34"], [35, 44, "35–44"], [45, 200, "45+"]]) },
    };
  },
});
add({
  id: "social-matches",
  category: "social",
  title: "Social matches over time",
  blurb: "New matches per day / week / month.",
  params: ["range", "tz"],
  tags: ["social", "matches", "trend"],
  run: async (c) => {
    const unit = unitFor(c);
    const s = await series(await bot("dating_matches"), "matched_at", {}, unit, c, await startAt(c, await bot("dating_matches"), "matched_at", 90));
    return trend("Social matches", `New matches per ${unit} · ${c.rangeText}.`, s, unit, "matches");
  },
});
add({
  id: "social-messages",
  category: "social",
  title: "Social messages over time",
  blurb: "Private Social messages per day / week / month (counts only).",
  params: ["range", "tz"],
  tags: ["social", "messages", "trend"],
  run: async (c) => {
    const unit = unitFor(c);
    const s = await series((await web("dating_messages")) as never, "at", {}, unit, c, await startAt(c, (await web("dating_messages")) as never, "at", 30));
    return trend("Social messages", `Messages sent on Social per ${unit} · ${c.rangeText}.`, s, unit, "messages", "Counts only: message text is never read for this.");
  },
});

// ===== Moderation & tickets =====
add({
  id: "mod-punishments",
  category: "moderation",
  title: "Punishments by type",
  blurb: "Warnings, mutes, kicks and bans.",
  params: ["range"],
  tags: ["moderation", "bans"],
  run: async (c) => {
    const rows = await (await bot("punishments")).aggregate([{ $match: c.since ? { timestamp: { $gte: c.since } } : {} }, { $group: { _id: "$action", v: { $sum: 1 } } }, { $sort: { v: -1 } }]).toArray();
    const total = rows.reduce((a, r) => a + n(r.v), 0);
    const active = await (await bot("punishments")).countDocuments({ active: true });
    return { title: "Punishments by type", subtitle: `${fmt(total)} punishments · ${c.rangeText}.`, footnote: "From the punishment records.", tiles: [{ label: "Punishments", value: fmt(total) }, { label: "Active right now", value: fmt(active) }], main: { kind: "bars", title: "By type", rows: rows.map((r) => ({ label: String(r._id ?? "other").replace(/_/g, " ").replace(/^\w/, (x) => x.toUpperCase()), value: n(r.v) })), total, colorful: true } };
  },
});
add({
  id: "mod-punishments-trend",
  category: "moderation",
  title: "Punishments over time",
  blurb: "Punishments per week / month.",
  params: ["range", "tz"],
  tags: ["moderation", "trend"],
  run: async (c) => {
    const unit = unitFor(c);
    const s = await series(await bot("punishments"), "timestamp", {}, unit, c, await startAt(c, await bot("punishments"), "timestamp", 365));
    return trend("Punishments over time", `Per ${unit} · ${c.rangeText}.`, s, unit, "punishments");
  },
});
add({
  id: "mod-moderators",
  category: "moderation",
  title: "Moderator activity",
  blurb: "Punishments issued per staff member (AutoMod included).",
  params: ["range", "top"],
  tags: ["staff", "leaderboard"],
  run: async (c) => {
    const rows = await (await bot("punishments")).aggregate([{ $match: c.since ? { timestamp: { $gte: c.since } } : {} }, { $group: { _id: { $toString: { $ifNull: ["$issuerId", { $ifNull: ["$issuer_discord_id", "$issuer_id"] }] } }, v: { $sum: 1 } } }, { $sort: { v: -1 } }, { $limit: c.top }]).toArray();
    const nameOf = await names(rows.map((r) => String(r._id)));
    // A Discord id is a staff member; a word like "automod" is AutoMod; nothing recorded is unknown
    const who = (id: unknown) => (/^\d{15,21}$/.test(String(id)) ? nameOf(String(id)) : id && /auto/i.test(String(id)) ? "AutoMod" : "Not recorded");
    return board("Moderator activity", `Punishments issued · ${c.rangeText}.`, rows.map((r) => ({ label: who(r._id), value: n(r.v) })), "punishments", undefined, "Staff only. From the punishment records.");
  },
});
add({
  id: "mod-automod",
  category: "moderation",
  title: "AutoMod catches",
  blurb: "What AutoMod catches and what it does about it.",
  params: ["range"],
  tags: ["automod"],
  run: async (c) => {
    const match = c.since ? { at: { $gte: c.since } } : {};
    const rules = await (await bot("automod_events")).aggregate([{ $match: match }, { $group: { _id: "$rule", v: { $sum: 1 } } }, { $sort: { v: -1 } }]).toArray();
    const actions = await (await bot("automod_events")).aggregate([{ $match: match }, { $group: { _id: "$action", v: { $sum: 1 } } }, { $sort: { v: -1 } }]).toArray();
    const total = rules.reduce((a, r) => a + n(r.v), 0);
    const nice = (s: unknown) => String(s ?? "other").replace(/[_-]/g, " ").replace(/^\w/, (x) => x.toUpperCase());
    return { title: "AutoMod catches", subtitle: `${fmt(total)} catches · ${c.rangeText}.`, footnote: "AutoMod catches are kept for 90 days.", main: { kind: "bars", title: "By rule", rows: rules.map((r) => ({ label: nice(r._id), value: n(r.v) })), total }, bottom: { kind: "strip", title: "What AutoMod did", rows: actions.map((a) => ({ label: nice(a._id), value: n(a.v) })) } };
  },
});
add({
  id: "mod-join-apps",
  category: "moderation",
  title: "Join applications",
  blurb: "Applications per month and how they were decided.",
  params: ["tz"],
  tags: ["join", "applications"],
  run: async (c) => {
    const s = await series(await bot("join_applications"), "submittedAt", {}, "month", c, new Date(Date.now() - 365 * DAY));
    const st = await (await bot("join_applications")).aggregate([{ $group: { _id: "$status", v: { $sum: 1 } } }, { $sort: { v: -1 } }]).toArray();
    const total = st.reduce((a, r) => a + n(r.v), 0);
    return { title: "Join applications", subtitle: `${fmt(total)} applications in all.`, footnote: "From the join form.", main: { kind: "columns", title: "Applications per month", rows: s.labels.map((l, i) => ({ label: l, value: s.values[i] })) }, bottom: { kind: "strip", title: "Decisions", rows: st.map((r) => ({ label: String(r._id ?? "unknown").replace(/^\w/, (x) => x.toUpperCase()), value: n(r.v) })) } };
  },
});
add({
  id: "tickets-overview",
  category: "moderation",
  title: "Support tickets",
  blurb: "Tickets per month, by type and how fast they close.",
  params: ["range", "tz"],
  tags: ["tickets", "support"],
  run: async (c) => {
    const match = c.since ? { created: { $gte: c.since } } : {};
    const types = await (await bot("resolvedTickets")).aggregate([{ $match: match }, { $group: { _id: "$ticket_type", v: { $sum: 1 }, close: { $avg: { $cond: [{ $and: [{ $eq: [{ $type: "$resolved_at" }, "date"] }, { $eq: [{ $type: "$created" }, "date"] }] }, { $subtract: ["$resolved_at", "$created"] }, null] } } } }, { $sort: { v: -1 } }]).toArray();
    const unit = unitFor(c) === "day" ? "week" : unitFor(c);
    const s = await series(await bot("resolvedTickets"), "created", {}, unit, c, await startAt(c, await bot("resolvedTickets"), "created", 365));
    const total = types.reduce((a, r) => a + n(r.v), 0);
    const nice = (s2: unknown) => String(s2 ?? "support").replace(/[_-]/g, " ").replace(/^\w/, (x) => x.toUpperCase());
    return {
      title: "Support tickets",
      subtitle: `${fmt(total)} closed tickets · ${c.rangeText}.`,
      footnote: "From closed tickets. Close time is from opening to closing.",
      main: { kind: s.labels.length > 40 ? "line" : "columns", title: `Tickets per ${unit}`, labels: s.labels, series: [{ name: "Tickets", values: s.values }], rows: s.labels.map((l, i) => ({ label: l, value: s.values[i] })) } as Block,
      side: { kind: "bars", title: "Average hours to close", rows: types.filter((t) => t.close).map((t) => ({ label: nice(t._id), value: n(t.close) / 3_600_000, note: `${fmt(n(t.v))} tickets` })), format: "hours" },
    };
  },
});
add({
  id: "tickets-handlers",
  category: "moderation",
  title: "Top ticket handlers",
  blurb: "Staff who handled the most tickets.",
  params: ["range", "top"],
  tags: ["tickets", "staff", "leaderboard"],
  run: async (c) => {
    const rows = await (await bot("resolvedTickets")).aggregate([{ $match: c.since ? { created: { $gte: c.since } } : {} }, { $group: { _id: { $ifNull: ["$claimed_by", "$resolved_by"] }, v: { $sum: 1 } } }, { $match: { _id: { $ne: null } } }, { $sort: { v: -1 } }, { $limit: c.top }]).toArray();
    const nameOf = await names(rows.map((r) => String(r._id)));
    return board("Top ticket handlers", `Tickets claimed or closed · ${c.rangeText}.`, rows.map((r) => ({ label: nameOf(String(r._id)), value: n(r.v) })), "tickets", undefined, "From closed tickets.");
  },
});

// ===== Website =====
add({
  id: "web-traffic",
  category: "website",
  title: "Website visits over time",
  blurb: "Page views and different visitors per day / week / month.",
  params: ["range", "tz"],
  tags: ["website", "traffic", "trend"],
  run: async (c) => {
    const unit = unitFor(c);
    const col = await web("page_views");
    const start = await startAt(c, col as never, "ts", 30);
    const views = await series(col as never, "ts", {}, unit, c, start);
    const vis = await col
      .aggregate([{ $match: { ts: { $gte: start } } }, { $group: { _id: { k: { $dateToString: { format: dateFormat(unit === "week" ? "day" : unit), date: unit === "week" ? { $dateTrunc: { date: "$ts", unit: "week", startOfWeek: "monday", timezone: c.tz } } : "$ts", timezone: c.tz } }, v: "$vid" } } }, { $group: { _id: "$_id.k", v: { $sum: 1 } } }])
      .toArray();
    const vm = new Map(vis.map((r) => [String(r._id), n(r.v)]));
    const b = buckets(unit, start, c.tz);
    const visitors = b.map((x) => vm.get(x.key) ?? 0);
    const spec = trend("Website visits", `Per ${unit} · ${c.rangeText}.`, views, unit, "page views", "From the website's own traffic stats (no outside trackers).");
    spec.main = { kind: "line", title: "Page views and visitors", labels: views.labels, series: [{ name: "Page views", values: views.values }, { name: "Visitors", values: visitors }] };
    return spec;
  },
});
for (const [id, field, title] of [
  ["web-pages", "path", "Most visited pages"],
  ["web-countries", "country", "Visitors by country"],
  ["web-devices", "device.type", "Phones vs computers"],
  ["web-browsers", "device.browser", "Browsers"],
  ["web-referrers", "ref", "Where visitors come from"],
] as const) {
  add({
    id,
    category: "website",
    title,
    blurb: `${title} on bear-nation.net.`,
    params: ["range", "top"],
    tags: ["website", "traffic"],
    run: async (c) => {
      const rows = await (await web("page_views")).aggregate([{ $match: { ...(c.since ? { ts: { $gte: c.since } } : {}), [field]: { $nin: [null, ""] } } }, { $group: { _id: `$${field}`, v: { $sum: 1 }, vis: { $addToSet: "$vid" } } }, { $project: { v: 1, p: { $size: "$vis" } } }, { $sort: { v: -1 } }, { $limit: c.top }]).toArray();
      const total = rows.reduce((a, r) => a + n(r.v), 0);
      return { title, subtitle: c.rangeText, footnote: "From the website's own traffic stats (no outside trackers).", main: { kind: "bars", title: "Page views", rows: rows.map((r) => ({ label: String(r._id).replace(/^\w/, (x) => (field === "path" ? x : x.toUpperCase())), value: n(r.v), note: `${fmt(n(r.p))} visitors` })), total, colorful: field.startsWith("device") } };
    },
  });
}
add({
  id: "web-accounts",
  category: "website",
  title: "Website accounts",
  blurb: "Sign-ups per month, confirmed emails and Discord links.",
  params: ["tz"],
  tags: ["website", "accounts"],
  run: async (c) => {
    const col = await web("users");
    const s = await series(col as never, "createdAt", {}, "month", c, new Date(Date.now() - 365 * DAY));
    const total = await col.countDocuments();
    const verified = await col.countDocuments({ emailVerified: true });
    const linked = await col.countDocuments({ discordId: { $type: "string" } });
    const twofa = await col.countDocuments({ "twoFactor.enabled": true });
    return {
      title: "Website accounts",
      subtitle: `${fmt(total)} accounts on bear-nation.net.`,
      footnote: "From website accounts.",
      tiles: [
        { label: "Accounts", value: fmt(total) },
        { label: "Email confirmed", value: pct(verified, total) },
        { label: "Discord linked", value: pct(linked, total) },
        { label: "Two-factor on", value: pct(twofa, total) },
      ],
      main: { kind: "columns", title: "New accounts per month", rows: s.labels.map((l, i) => ({ label: l, value: s.values[i] })) },
    };
  },
});
add({
  id: "web-invites",
  category: "website",
  title: "Discord invite clicks",
  blurb: "Clicks on the website's Join Discord buttons, and where they came from.",
  params: ["range", "tz"],
  tags: ["growth", "invites"],
  run: async (c) => {
    const col = await web("invite_clicks");
    const unit = unitFor(c);
    const s = await series(col as never, "at", {}, unit, c, await startAt(c, col as never, "at", 30));
    const src = await col.aggregate([{ $match: c.since ? { at: { $gte: c.since } } : {} }, { $group: { _id: "$src", v: { $sum: 1 } } }, { $sort: { v: -1 } }, { $limit: 8 }]).toArray();
    const spec = trend("Discord invite clicks", `Per ${unit} · ${c.rangeText}.`, s, unit, "clicks", "From the website's invite buttons.");
    spec.side = { kind: "bars", title: "Where the click came from", rows: src.map((r) => ({ label: String(r._id ?? "site"), value: n(r.v) })), colorful: true };
    return spec;
  },
});

// ===== Members & roles (live from Discord) =====
function members(c: Ctx): MMMember[] {
  const ids = amongIds(c);
  if (ids) {
    const set = new Set(ids);
    return c.snap.members.filter((m) => set.has(m.id));
  }
  return c.snap.members.filter((m) => !m.bot);
}
async function leadersBy(c: Ctx, value: (m: MMMember) => number): Promise<Row[]> {
  return members(c)
    .map((m) => ({ label: m.name, value: value(m) }))
    .filter((r) => r.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, c.top);
}
function groupRows(c: Ctx, key: string, ms: MMMember[]) {
  const cat = c.snap.categories.find((x) => x.key === key);
  const idx = (cat?.roleIds ?? []).map((id) => c.snap.roles.findIndex((r) => r.id === id)).filter((i) => i >= 0);
  const rows = idx.map((i) => ({ label: c.snap.roles[i].name, value: ms.filter((m) => m.r.includes(i)).length })).sort((a, b) => b.value - a.value);
  const none = ms.filter((m) => !m.r.some((i) => idx.includes(i)));
  const v = c.snap.roles.findIndex((r) => r.id === "1358469974552870913" || (/18\+/.test(r.name) && /verif/i.test(r.name)));
  const noneRows: Row[] = cat?.adult && v >= 0 ? [{ label: "None picked (18+)", value: none.filter((m) => m.r.includes(v)).length, muted: true }, { label: "Not 18+ Verified", value: none.filter((m) => !m.r.includes(v)).length, muted: true }] : [{ label: "No role picked", value: none.length, muted: true }];
  return { rows, noneRows, title: cat?.title ?? key, multi: ms.filter((m) => m.r.filter((i) => idx.includes(i)).length > 1).length };
}
add({
  id: "members-group",
  category: "members",
  title: "Role group breakdown",
  blurb: "Every role in a group (Gender, Pronouns, Positions…), among everyone or one role.",
  params: ["group", "among"],
  tags: ["roles", "gender", "pronouns", "breakdown"],
  run: async (c) => {
    const ms = members(c);
    const g = groupRows(c, c.p.group || "Gender", ms);
    const [a, b] = g.rows;
    return {
      title: `${g.title} breakdown${c.p.among ? ` · ${roleName(c, c.p.among)}` : ""}`,
      subtitle: `${fmt(ms.length)} members, counted from the ${g.title.toLowerCase()} roles they picked.`,
      footnote: [g.multi ? `${g.multi} picked more than one, so a few are counted twice.` : "", "Live Discord roles. Bots are not counted."].join(" ").trim(),
      hero: a && b && b.value ? { label: `${a.label} : ${b.label}`, big: (a.value / b.value).toFixed(a.value / b.value >= 10 ? 1 : 2).replace(/\.?0+$/, ""), small: ": 1", caption: `${fmt(a.value)} ${a.label} to ${fmt(b.value)} ${b.label}. ${a.label} is ${pct(a.value, ms.length)} of these members.` } : undefined,
      main: { kind: "bars", title: `Members by ${g.title.toLowerCase()} role`, rows: [...g.rows, ...g.noneRows], total: ms.length, colorful: g.rows.length <= 8 },
      bottom: { kind: "strip", title: "Everyone, side by side", rows: [...g.rows.slice(0, 7), ...(g.rows.length > 7 ? [{ label: "Other roles", value: g.rows.slice(7).reduce((x, y) => x + y.value, 0) }] : []), ...g.noneRows] },
    };
  },
});
add({
  id: "members-ratio",
  category: "members",
  title: "Ratio of two role sets",
  blurb: "Any roles against any roles, like men to women.",
  params: ["rolesA", "rolesB", "among"],
  tags: ["ratio", "gender"],
  run: async (c) => {
    const ms = members(c);
    const idx = (list?: string) => (list ?? "").split(",").filter(Boolean).map((id) => c.snap.roles.findIndex((r) => r.id === id)).filter((i) => i >= 0);
    const A = idx(c.p.rolesA);
    const B = idx(c.p.rolesB);
    const ca = ms.filter((m) => m.r.some((i) => A.includes(i))).length;
    const cb = ms.filter((m) => m.r.some((i) => B.includes(i))).length;
    const la = A.map((i) => c.snap.roles[i].name).join(" + ") || "Pick roles";
    const lb = B.map((i) => c.snap.roles[i].name).join(" + ") || "Pick roles";
    return {
      title: `${la} to ${lb}`,
      subtitle: `Among ${fmt(ms.length)} members${amongText(c)}.`,
      footnote: "Members with roles on both sides count on both. Live Discord roles; bots are not counted.",
      hero: { label: "Ratio", big: cb ? (ca / cb).toFixed(ca / cb >= 10 ? 1 : 2).replace(/\.?0+$/, "") : "—", small: ": 1", caption: `${fmt(ca)} ${la} for every ${fmt(cb)} ${lb}.` },
      tiles: [
        { label: la, value: fmt(ca), note: pct(ca, ms.length) },
        { label: lb, value: fmt(cb), note: pct(cb, ms.length) },
        { label: "Everyone counted", value: fmt(ms.length) },
      ],
      main: { kind: "strip", title: "Side by side", rows: [{ label: la, value: ca }, { label: lb, value: cb }] },
    };
  },
});
add({
  id: "members-compare",
  category: "members",
  title: "Two role groups compared",
  blurb: "A heat table, like Gender × Relationship Status.",
  params: ["rowGroup", "colGroup", "among"],
  tags: ["crosstab", "compare"],
  run: async (c) => {
    const ms = members(c);
    const idxOf = (k: string) => (c.snap.categories.find((x) => x.key === k)?.roleIds ?? []).map((id) => c.snap.roles.findIndex((r) => r.id === id)).filter((i) => i >= 0);
    const R = idxOf(c.p.rowGroup || "Gender");
    const C = idxOf(c.p.colGroup || "Relationship_Status");
    const rowsL = [...R.map((i) => c.snap.roles[i].name), "No role"];
    const colsL = [...C.map((i) => c.snap.roles[i].name), "None"];
    const cells = rowsL.map(() => colsL.map(() => 0));
    const totals = rowsL.map(() => 0);
    for (const m of ms) {
      const rh = R.map((i) => m.r.includes(i));
      const chs = C.map((i) => m.r.includes(i));
      const rIdx = rh.some(Boolean) ? rh.map((x, i) => (x ? i : -1)).filter((i) => i >= 0) : [R.length];
      const cIdx = chs.some(Boolean) ? chs.map((x, i) => (x ? i : -1)).filter((i) => i >= 0) : [C.length];
      for (const ri of rIdx) {
        totals[ri]++;
        for (const ci of cIdx) cells[ri][ci]++;
      }
    }
    const title = (k: string) => c.snap.categories.find((x) => x.key === k)?.title ?? k;
    return { title: `${title(c.p.rowGroup || "Gender")} × ${title(c.p.colGroup || "Relationship_Status")}`, subtitle: `${fmt(ms.length)} members${amongText(c)}. Each cell counts members with both roles.`, footnote: "Members can pick more than one role in a group. 18+ groups can only be picked with 18+ Verified.", main: { kind: "heat", title: "Members in each pair", rows: rowsL, cols: colsL, cells, totals } };
  },
});
add({
  id: "members-overview",
  category: "members",
  title: "Server overview",
  blurb: "Members, joins, 18+ Verified, boosters, website accounts and the biggest roles.",
  params: [],
  tags: ["overview"],
  run: async (c) => {
    const ms = members(c);
    const v = c.snap.roles.findIndex((r) => r.id === "1358469974552870913");
    const counts = new Map<number, number>();
    ms.forEach((m) => m.r.forEach((i) => counts.set(i, (counts.get(i) ?? 0) + 1)));
    const top = Array.from(counts).filter(([i]) => !c.snap.roles[i].managed).sort((a, b) => b[1] - a[1]).slice(0, 8);
    const b = buckets("month", new Date(Date.now() - 335 * DAY), c.tz);
    const joins = b.map((x) => ({ label: x.label, value: ms.filter((m) => m.joinedAt && new Date(m.joinedAt).toLocaleDateString("en-CA", { timeZone: c.tz }).slice(0, 7) === x.key).length }));
    return {
      title: "Bear Nation at a glance",
      subtitle: `${fmt(ms.length)} members in the Discord server today.`,
      footnote: "Live from Discord. Bots are not counted. Joins only count members who are still here.",
      tiles: [
        { label: "Members", value: fmt(ms.length) },
        { label: "Joined in 30 days", value: fmt(ms.filter((m) => (m.joinedAt ?? 0) > Date.now() - 30 * DAY).length) },
        { label: "18+ Verified", value: fmt(v >= 0 ? ms.filter((m) => m.r.includes(v)).length : 0), note: pct(v >= 0 ? ms.filter((m) => m.r.includes(v)).length : 0, ms.length) },
        { label: "Boosting", value: fmt(ms.filter((m) => m.boosting).length) },
        { label: "Website accounts", value: fmt(ms.filter((m) => m.account).length) },
      ],
      main: { kind: "columns", title: "New members each month", rows: joins },
      side: { kind: "bars", title: "Biggest roles", rows: top.map(([i, k]) => ({ label: c.snap.roles[i].name, value: k })), total: ms.length },
    };
  },
});
add({
  id: "members-growth",
  category: "members",
  title: "Joins vs leaves",
  blurb: "Members joining and leaving each month, and net growth.",
  params: ["tz"],
  tags: ["growth", "retention"],
  run: async (c) => {
    const col = await web("member_directory");
    const start = new Date(Date.now() - 335 * DAY);
    const joined = await series(col as never, "joinedAt", {}, "month", c, start);
    const left = await series(col as never, "leftAt", {}, "month", c, start);
    const net = joined.values.map((v, i) => v - left.values[i]);
    return {
      title: "Joins vs leaves",
      subtitle: "Members joining and leaving each month over the last year.",
      footnote: "From the member list the website keeps. Leaves are only known since the website started recording them.",
      tiles: [
        { label: "Joined", value: fmt(joined.values.reduce((a, b) => a + b, 0)) },
        { label: "Left", value: fmt(left.values.reduce((a, b) => a + b, 0)) },
        { label: "Net growth", value: `${net.reduce((a, b) => a + b, 0) >= 0 ? "+" : ""}${fmt(net.reduce((a, b) => a + b, 0))}` },
      ],
      main: { kind: "line", title: "Per month", labels: joined.labels, series: [{ name: "Joined", values: joined.values }, { name: "Left", values: left.values }] },
    };
  },
});
add({
  id: "members-account-age",
  category: "members",
  title: "Discord account ages",
  blurb: "How old members' Discord accounts are.",
  params: ["among"],
  tags: ["accounts", "age"],
  run: async (c) => {
    const ms = members(c);
    const days = ms.map((m) => (Date.now() - m.createdAt) / DAY);
    return { title: "How old members' Discord accounts are", subtitle: `${fmt(ms.length)} members${amongText(c)}.`, footnote: "From each member's Discord account creation date.", main: { kind: "columns", title: "Members by account age", rows: bands(days, [[0, 30, "< 1 month"], [30, 182, "1–6 months"], [182, 365, "6–12 months"], [365, 730, "1–2 years"], [730, 1825, "2–5 years"], [1825, 1e9, "5+ years"]]) } };
  },
});
add({
  id: "members-tenure",
  category: "members",
  title: "Time in the server",
  blurb: "How long members have been here.",
  params: ["among"],
  tags: ["tenure", "loyalty"],
  run: async (c) => {
    const ms = members(c).filter((m) => m.joinedAt);
    const days = ms.map((m) => (Date.now() - (m.joinedAt as number)) / DAY);
    const oldest = ms.sort((a, b) => (a.joinedAt as number) - (b.joinedAt as number)).slice(0, 8);
    return {
      title: "How long members have been here",
      subtitle: `${fmt(ms.length)} members${amongText(c)}.`,
      footnote: "From each member's server join date (rejoining resets it).",
      main: { kind: "columns", title: "Members by time in the server", rows: bands(days, [[0, 7, "< 1 week"], [7, 30, "1–4 weeks"], [30, 90, "1–3 months"], [90, 182, "3–6 months"], [182, 365, "6–12 months"], [365, 1e9, "1+ year"]]) },
      side: { kind: "leaderboard", title: "Longest here", rows: oldest.map((m) => ({ label: m.name, value: Math.floor((Date.now() - (m.joinedAt as number)) / DAY), note: "days" })) },
    };
  },
});

export const STAT_LIST: StatMeta[] = STATS.map(({ run: _r, ...meta }) => meta);

// ---------- running ----------

const cache = new Map<string, { at: number; spec: Spec }>();
const CACHE_MS = 5 * 60_000;

export async function runStat(id: string, p: Params): Promise<Spec> {
  const stat = STATS.find((s) => s.id === id);
  if (!stat) throw new Error("Unknown graphic.");
  const clean: Params = {};
  for (const k of stat.params) if (p[k]) clean[k] = String(p[k]).slice(0, 400);
  const key = `${id}|${JSON.stringify(clean)}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.spec;
  const range = clean.range ?? "30";
  const ctx: Ctx = {
    p: clean,
    since: stat.params.includes("range") && range !== "all" ? new Date(Date.now() - Number(range) * DAY) : null,
    tz: ZONES.some((z) => z[0] === clean.tz) ? clean.tz! : "America/New_York",
    top: Math.min(25, Math.max(5, Number(clean.top) || 10)),
    rangeText: stat.params.includes("range") ? (RANGES.find((r) => r[0] === range)?.[1] ?? "Last 30 days") : "",
    snap: await membersSnapshot(),
  };
  const spec = await stat.run(ctx);
  cache.set(key, { at: Date.now(), spec });
  if (cache.size > 300) cache.delete(cache.keys().next().value as string);
  return spec;
}

/** Choices for the page's dropdowns: channels with messages, role groups, roles, games. */
export async function statOptions() {
  const snap = await membersSnapshot();
  const ch = await channelNames();
  const busy = await (await bot("message_index")).aggregate([{ $match: { t: { $gte: new Date(Date.now() - 365 * DAY) } } }, { $group: { _id: "$c", v: { $sum: 1 } } }, { $sort: { v: -1 } }, { $limit: 60 }]).toArray();
  const games = await (await bot("gambling_logs")).distinct("game");
  return {
    channels: busy.map((b) => ({ id: String(b._id), name: ch.get(String(b._id)) ?? "#deleted-channel", messages: n(b.v) })),
    groups: snap.categories.map((g) => ({ key: g.key, title: g.title, adult: g.adult })),
    roles: snap.roles.filter((r) => !r.managed).map((r) => ({ id: r.id, name: r.name })),
    games: Array.from(new Set(["slots", ...(games as string[]).filter(Boolean)])).map((g) => ({ key: g, name: gameName(g) })),
  };
}

export type { Tile };
