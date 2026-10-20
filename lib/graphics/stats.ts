// Admin → Graphics: every stat graphic, worked out from the bot's and the website's data. Each entry says what
// it needs (a date range, a time zone, a role…) and returns a Spec the page draws. Results are cached for five
// minutes per set of options, so flicking between graphics is quick.
//
// Sources: bot.message_index (every message: author, channel, time), bot.member_activity (per-member chat
// details: topics, emojis, reactions, replies, voice), bot.users (levels, leaves, streaks, voice), casino,
// store, moderation, tickets, QOTD, Wordle, events, giveaways, Social, and the website's own records.

import { AsyncLocalStorage } from "node:async_hooks";
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

type Ctx = { p: Params; since: Date | null; until: Date; tz: string; top: number; rangeText: string; snap: MMSnapshot };

/** A date filter for the chosen range (nothing for graphics without one). */
function inRange(c: Ctx, field: string): Document {
  if (!c.since && c.until.getTime() >= Date.now() - 60_000) return {};
  return { [field]: { ...(c.since ? { $gte: c.since } : {}), $lt: c.until } };
}
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
  Object.assign(m, inRange(c, "t"));
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
  const map = new Map(list.map((ch) => [ch.id, ch.type === 2 ? `${ch.name} (voice)` : `#${ch.name}`]));
  if (map.size) channelCache = { at: Date.now(), map };
  return map;
}

/** Every day / week / month between `start` and now, so quiet periods show as zero instead of disappearing. */
function buckets(unit: "day" | "week" | "month", start: Date, tz: string, until?: Date) {
  const out: { key: string; label: string }[] = [];
  const d = new Date(start);
  const end = Math.min(Date.now(), (until ?? new Date()).getTime() - 1);
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
      { $match: { ...match, [field]: { ...(match[field] as Document | undefined), $gte: start, $lt: c.until } } },
      {
        $group: {
          _id: unit === "week" ? { $dateToString: { format: "%Y-%m-%d", date: { $dateTrunc: { date: `$${field}`, unit: "week", startOfWeek: "monday", timezone: c.tz } }, timezone: c.tz } } : { $dateToString: { format: dateFormat(unit), date: `$${field}`, timezone: c.tz } },
          v: sumField ? { $sum: `$${sumField}` } : { $sum: 1 },
        },
      },
    ])
    .toArray();
  const map = new Map(rows.map((r) => [String(r._id), n(r.v)]));
  const b = buckets(unit, start, c.tz, c.until);
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
/** Days for short ranges, weeks for a few months, months for longer. */
const unitFor = (c: Ctx): "day" | "week" | "month" => {
  if (!c.since) return "month";
  const days = (c.until.getTime() - c.since.getTime()) / DAY;
  return days <= 45 ? "day" : days <= 200 ? "week" : "month";
};
const unitWord = (u: "day" | "week" | "month") => u;

/** A line of counts over time, with headline tiles. */
function trend(title: string, subtitle: string, s: { labels: string[]; values: number[] }, unit: string, what: string, footnote = ""): Spec {
  const end = rangeEnd.getStore();
  const toNow = !end || end.getTime() >= Date.now() - 60_000;
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
    footnote: `${footnote ? `${footnote} ` : ""}${toNow ? `The current ${unit} is still in progress.` : ""}`.trim(),
    tiles: [
      { label: `Total ${what}`, value: fmt(total) },
      { label: `Average per ${unit}`, value: avg >= 10 ? fmt(avg) : avg.toFixed(1) },
      { label: `Busiest ${unit}`, value: best >= 0 ? s.labels[best] : "—", note: best >= 0 ? `${fmt(s.values[best])} ${what}` : undefined },
      { label: "Second half vs first", value: first ? (Math.round(change) === 0 ? "0%" : `${change > 0 ? "+" : ""}${change.toFixed(0)}%`) : "—", note: "of the period shown" },
    ],
    main: { kind: s.labels.length > 40 ? "line" : "columns", title: `${what[0].toUpperCase()}${what.slice(1)} per ${unit}`, labels: s.labels, series: [{ name: what, values: s.values }], rows: s.labels.map((l, i) => ({ label: l, value: s.values[i] })), timeline: true, partial: { first: unit !== "day", last: toNow, step: unit as "day" | "week" | "month" } } as Block,
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
        { $match: { ...msgMatch(c), t: { $gte: start, $lt: c.until } } },
        { $group: { _id: { k: { $dateToString: { format: dateFormat(unit === "week" ? "day" : unit), date: unit === "week" ? { $dateTrunc: { date: "$t", unit: "week", startOfWeek: "monday", timezone: c.tz } } : "$t", timezone: c.tz } }, a: "$a" } } },
        { $group: { _id: "$_id.k", v: { $sum: 1 } } },
      ])
      .toArray();
    const map = new Map(rows.map((r) => [String(r._id), n(r.v)]));
    const b = buckets(unit, start, c.tz, c.until);
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
      hero: !total ? undefined : { label: "Peak hour", big: HOUR(best), caption: `${pct(vals[best], total)} of messages are sent between ${HOUR(best)} and ${HOUR((best + 1) % 24)}. The quietest hour is ${HOUR(quiet)}.` },
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
      hero: !total ? undefined : { label: "Busiest day", big: WEEKDAYS[best], caption: `${pct(vals[best], total)} of all messages. Weekends (Sat + Sun) have ${pct(weekend, total)} of messages.` },
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
  Object.assign(m, inRange(c, "timestamp"));
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
    const rows = await (await bot("store_sales")).aggregate([{ $match: inRange(c, "timestamp") }, { $group: { _id: "$item_id", q: { $sum: { $ifNull: ["$quantity", 1] } }, leaves: { $sum: "$price_paid" } } }, { $sort: { q: -1 } }]).toArray();
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
    const match = inRange(c, "timestamp");
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
      main: { kind: s.labels.length > 40 ? "line" : "columns", title: "Answers", labels: s.labels, series: [{ name: "Answers", values: s.values }], rows: s.labels.map((l, i) => ({ label: l, value: s.values[i] })), timeline: true, partial: { first: unit !== "day", last: true, step: unit } } as Block,
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
    return { title: "Events in the Nation", subtitle: "Events per month over the last year.", footnote: "From Admin → Events.", main: { kind: "columns", timeline: true, partial: { first: true, last: true, step: "month" }, title: "Events per month", rows: s.labels.map((l, i) => ({ label: l, value: s.values[i] })) }, side: { kind: "bars", title: "By kind", rows: kinds.map((k) => ({ label: String(k._id ?? "other").replace(/^\w/, (x) => x.toUpperCase()), value: n(k.v) })), colorful: true } };
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
    const rows = await (await bot("punishments")).aggregate([{ $match: inRange(c, "timestamp") }, { $group: { _id: "$action", v: { $sum: 1 } } }, { $sort: { v: -1 } }]).toArray();
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
    const rows = await (await bot("punishments")).aggregate([{ $match: inRange(c, "timestamp") }, { $group: { _id: { $toString: { $ifNull: ["$issuerId", { $ifNull: ["$issuer_discord_id", "$issuer_id"] }] } }, v: { $sum: 1 } } }, { $sort: { v: -1 } }, { $limit: c.top }]).toArray();
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
    const match = inRange(c, "at");
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
    return { title: "Join applications", subtitle: `${fmt(total)} applications in all.`, footnote: "From the join form.", main: { kind: "columns", timeline: true, partial: { first: true, last: true, step: "month" }, title: "Applications per month", rows: s.labels.map((l, i) => ({ label: l, value: s.values[i] })) }, bottom: { kind: "strip", title: "Decisions", rows: st.map((r) => ({ label: String(r._id ?? "unknown").replace(/^\w/, (x) => x.toUpperCase()), value: n(r.v) })) } };
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
    const match = inRange(c, "created");
    const types = await (await bot("resolvedTickets")).aggregate([{ $match: match }, { $group: { _id: "$ticket_type", v: { $sum: 1 }, close: { $avg: { $cond: [{ $and: [{ $eq: [{ $type: "$resolved_at" }, "date"] }, { $eq: [{ $type: "$created" }, "date"] }] }, { $subtract: ["$resolved_at", "$created"] }, null] } } } }, { $sort: { v: -1 } }]).toArray();
    const unit = unitFor(c) === "day" ? "week" : unitFor(c);
    const s = await series(await bot("resolvedTickets"), "created", {}, unit, c, await startAt(c, await bot("resolvedTickets"), "created", 365));
    const total = types.reduce((a, r) => a + n(r.v), 0);
    const nice = (s2: unknown) => String(s2 ?? "support").replace(/[_-]/g, " ").replace(/^\w/, (x) => x.toUpperCase());
    return {
      title: "Support tickets",
      subtitle: `${fmt(total)} closed tickets · ${c.rangeText}.`,
      footnote: "From closed tickets. Close time is from opening to closing.",
      main: { kind: s.labels.length > 40 ? "line" : "columns", title: `Tickets per ${unit}`, labels: s.labels, series: [{ name: "Tickets", values: s.values }], rows: s.labels.map((l, i) => ({ label: l, value: s.values[i] })), timeline: true, partial: { first: unit !== "day", last: true, step: unit } } as Block,
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
    const rows = await (await bot("resolvedTickets")).aggregate([{ $match: inRange(c, "created") }, { $group: { _id: { $ifNull: ["$claimed_by", "$resolved_by"] }, v: { $sum: 1 } } }, { $match: { _id: { $ne: null } } }, { $sort: { v: -1 } }, { $limit: c.top }]).toArray();
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
      .aggregate([{ $match: { ts: { $gte: start, $lt: c.until } } }, { $group: { _id: { k: { $dateToString: { format: dateFormat(unit === "week" ? "day" : unit), date: unit === "week" ? { $dateTrunc: { date: "$ts", unit: "week", startOfWeek: "monday", timezone: c.tz } } : "$ts", timezone: c.tz } }, v: "$vid" } } }, { $group: { _id: "$_id.k", v: { $sum: 1 } } }])
      .toArray();
    const vm = new Map(vis.map((r) => [String(r._id), n(r.v)]));
    const b = buckets(unit, start, c.tz, c.until);
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
      const rows = await (await web("page_views")).aggregate([{ $match: { ...(inRange(c, "ts")), [field]: { $nin: [null, ""] } } }, { $group: { _id: `$${field}`, v: { $sum: 1 }, vis: { $addToSet: "$vid" } } }, { $project: { v: 1, p: { $size: "$vis" } } }, { $sort: { v: -1 } }, { $limit: c.top }]).toArray();
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
      main: { kind: "columns", timeline: true, partial: { first: true, last: true, step: "month" }, title: "New accounts per month", rows: s.labels.map((l, i) => ({ label: l, value: s.values[i] })) },
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
    const src = await col.aggregate([{ $match: inRange(c, "at") }, { $group: { _id: "$src", v: { $sum: 1 } } }, { $sort: { v: -1 } }, { $limit: 8 }]).toArray();
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
      main: { kind: "columns", timeline: true, partial: { first: true, last: true, step: "month" }, title: "New members each month", rows: joins },
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


// ===== Staff activity =====
const STAFF_ROLES: [string, string][] = [
  ["1358473248534167663", "Owner"],
  ["1358472511133585564", "Admin"],
  ["1558568175191203931", "Community Manager"],
  ["1358470109965979859", "Staff"],
];
/** Everyone on the team (Owner, Admin, Community Manager, Staff Team), with their top staff role. */
function staffMembers(c: Ctx) {
  const idx = STAFF_ROLES.map(([id, label]) => ({ i: c.snap.roles.findIndex((r) => r.id === id), label })).filter((x) => x.i >= 0);
  return c.snap.members
    .filter((m) => !m.bot && idx.some((x) => m.r.includes(x.i)))
    .map((m) => ({ ...m, staffRole: idx.find((x) => m.r.includes(x.i))!.label }));
}
const staffLongs = (c: Ctx) => staffMembers(c).flatMap((m) => [Long.fromString(m.id), m.id]);
const shortName = (s: string) => (s.length > 18 ? `${s.slice(0, 17)}…` : s);

/** Counts per staff member for one source. */
async function perStaff(colP: Promise<{ aggregate: (p: Document[]) => { toArray: () => Promise<Document[]> } }>, match: Document, idExpr: unknown) {
  const rows = await (await colP).aggregate([{ $match: match }, { $group: { _id: { $toString: idExpr }, v: { $sum: 1 } } }]).toArray();
  return new Map(rows.map((r) => [String(r._id), n(r.v)]));
}

add({
  id: "staff-scorecard",
  category: "staff",
  title: "Staff scorecard",
  blurb: "Every staff member side by side: messages, punishments, tickets, applications and panel actions.",
  params: ["range"],
  tags: ["staff", "team", "activity", "overview"],
  run: async (c) => {
    const staff = staffMembers(c);
    const ids = staff.map((m) => m.id);
    const [msgs, puns, tix, apps, panel] = await Promise.all([
      perStaff(bot("message_index"), { a: { $in: ids.map((id) => Long.fromString(id)) }, ...inRange(c, "t") }, "$a"),
      perStaff(bot("punishments"), { ...inRange(c, "timestamp") }, { $ifNull: ["$issuerId", { $ifNull: ["$issuer_discord_id", "$issuer_id"] }] }),
      perStaff(bot("resolvedTickets"), { ...inRange(c, "created") }, { $ifNull: ["$claimed_by", "$resolved_by"] }),
      perStaff(bot("join_applications"), { ...inRange(c, "reviewedAt"), reviewedBy: { $ne: null } }, "$reviewedBy"),
      perStaff(web("admin_audit") as never, { ...inRange(c, "at") }, "$adminDiscordId"),
    ]);
    const cols = ["Messages", "Punishments", "Tickets", "Join apps", "Panel actions"];
    const rows = staff
      .map((m) => ({ m, vals: [msgs.get(m.id) ?? 0, puns.get(m.id) ?? 0, tix.get(m.id) ?? 0, apps.get(m.id) ?? 0, panel.get(m.id) ?? 0] }))
      .sort((a, b) => b.vals.slice(1).reduce((x, y) => x + y, 0) + b.vals[0] / 50 - (a.vals.slice(1).reduce((x, y) => x + y, 0) + a.vals[0] / 50))
      .slice(0, 16);
    const sum = (i: number) => rows.reduce((a, r) => a + r.vals[i], 0);
    return {
      title: "Staff scorecard",
      subtitle: `${fmt(staff.length)} people on the team · ${c.rangeText}.`,
      footnote: "Each column is shaded on its own scale. Tickets count claimed (or closed) tickets; join apps count reviews; panel actions come from the admin panel's log.",
      tiles: [
        { label: "Team members", value: fmt(staff.length) },
        { label: "Staff messages", value: fmt(sum(0)) },
        { label: "Punishments", value: fmt(sum(1)) },
        { label: "Tickets handled", value: fmt(sum(2)) },
        { label: "Applications reviewed", value: fmt(sum(3)) },
      ],
      main: { kind: "heat", title: "Who did what", rows: rows.map((r) => `${shortName(r.m.name)} · ${r.m.staffRole}`), cols, cells: rows.map((r) => r.vals), byColumn: true },
    };
  },
});

add({
  id: "staff-messages",
  category: "staff",
  title: "Staff chat activity",
  blurb: "Messages sent by each staff member, and the team's share of all chat.",
  params: ["range", "top"],
  tags: ["staff", "messages", "leaderboard"],
  run: async (c) => {
    const staff = staffMembers(c);
    const ids = staff.map((m) => Long.fromString(m.id));
    const [rows, all] = await Promise.all([
      (await bot("message_index")).aggregate([{ $match: { a: { $in: ids }, ...inRange(c, "t") } }, { $group: { _id: "$a", v: { $sum: 1 } } }, { $sort: { v: -1 } }]).toArray(),
      (await bot("message_index")).countDocuments(msgMatch(c)),
    ]);
    const total = rows.reduce((a, r) => a + n(r.v), 0);
    const byId = new Map(staff.map((m) => [m.id, m]));
    const quiet = staff.filter((m) => !rows.some((r) => String(r._id) === m.id));
    return {
      title: "Staff chat activity",
      subtitle: `Messages from the team · ${c.rangeText}.`,
      footnote: quiet.length ? `${quiet.length} staff sent no messages in this range: ${quiet.slice(0, 6).map((m) => m.name).join(", ")}${quiet.length > 6 ? "…" : ""}.` : "Every staff member chatted in this range.",
      hero: { label: "Team's share of chat", big: pct(total, all), caption: `${fmt(total)} of ${fmt(all)} messages came from ${fmt(staff.length)} staff members.` },
      main: { kind: "leaderboard", title: "Messages per staff member", rows: rows.slice(0, c.top).map((r) => ({ label: `${byId.get(String(r._id))?.name ?? "Staff"} (${byId.get(String(r._id))?.staffRole ?? ""})`, value: n(r.v) })) },
    };
  },
});

add({
  id: "staff-messages-trend",
  category: "staff",
  title: "Staff vs everyone over time",
  blurb: "Staff messages next to everyone else's, day by day.",
  params: ["range", "tz"],
  tags: ["staff", "messages", "trend"],
  run: async (c) => {
    const unit = unitFor(c);
    const ids = staffMembers(c).map((m) => Long.fromString(m.id));
    const col = await bot("message_index");
    const start = await startAt(c, col, "t", 30);
    const staffS = await series(col, "t", { a: { $in: ids } }, unit, c, start);
    const all = await series(col, "t", msgMatch(c), unit, c, start);
    const share = staffS.values.reduce((a, b) => a + b, 0) / Math.max(1, all.values.reduce((a, b) => a + b, 0));
    return {
      title: "Staff vs everyone",
      subtitle: `Messages per ${unit} · ${c.rangeText}.`,
      footnote: `Staff sent ${(share * 100).toFixed(1)}% of messages in this range.`,
      main: { kind: "line", title: `Messages per ${unit}`, labels: all.labels, series: [{ name: "Everyone else", values: all.values.map((v, i) => v - staffS.values[i]) }, { name: "Staff", values: staffS.values }] },
    };
  },
});

add({
  id: "staff-coverage",
  category: "staff",
  title: "Staff coverage (when staff are around)",
  blurb: "Day × hour heatmap of staff messages: spot the hours nobody's on.",
  params: ["range", "tz"],
  tags: ["staff", "coverage", "heatmap", "hours"],
  run: async (c) => {
    const ids = staffMembers(c).map((m) => Long.fromString(m.id));
    const rows = await (await bot("message_index"))
      .aggregate([{ $match: { a: { $in: ids }, ...inRange(c, "t") } }, { $group: { _id: { d: { $isoDayOfWeek: { date: "$t", timezone: c.tz } }, h: { $hour: { date: "$t", timezone: c.tz } } }, v: { $sum: 1 }, who: { $addToSet: "$a" } } }])
      .toArray();
    const map = new Map(rows.map((r) => [(n(r._id.d) - 1) * 24 + n(r._id.h), (r.who as unknown[]).length]));
    const empty = Array.from({ length: 168 }, (_, k) => k).filter((k) => !map.get(k)).length;
    const hourTotals = Array.from({ length: 24 }, (_, h) => WEEKDAYS.reduce((a, _, d) => a + (map.get(d * 24 + h) ?? 0), 0));
    const worst = hourTotals.indexOf(Math.min(...hourTotals));
    return {
      title: "When staff are around",
      subtitle: `Different staff members chatting in each hour of the week · ${c.rangeText} · ${zoneName(c.tz)} time.`,
      footnote: `${empty} of the week's 168 hours had no staff messages at all. The thinnest hour is ${HOUR(worst)}.`,
      main: { kind: "heat", title: "Staff members active", ...heatFromWeekHours(map) },
    };
  },
});

add({
  id: "staff-last-active",
  category: "staff",
  title: "Staff last active",
  blurb: "Days since each staff member's last message.",
  params: [],
  tags: ["staff", "inactive"],
  run: async (c) => {
    const staff = staffMembers(c);
    const rows = await (await bot("message_index")).aggregate([{ $match: { a: { $in: staff.map((m) => Long.fromString(m.id)) } } }, { $group: { _id: "$a", last: { $max: "$t" } } }]).toArray();
    const last = new Map(rows.map((r) => [String(r._id), (r.last as Date).getTime()]));
    const list = staff.map((m) => ({ label: `${m.name} (${m.staffRole})`, value: last.has(m.id) ? Math.floor((Date.now() - last.get(m.id)!) / DAY) : 999 })).sort((a, b) => b.value - a.value);
    return {
      title: "Staff last active",
      subtitle: "Days since each staff member's last message (longest first).",
      footnote: "999 means no messages found. From the bot's message index.",
      tiles: [
        { label: "Chatted today", value: fmt(list.filter((r) => r.value === 0).length) },
        { label: "This week", value: fmt(list.filter((r) => r.value < 7).length) },
        { label: "Quiet 30+ days", value: fmt(list.filter((r) => r.value >= 30).length) },
      ],
      main: { kind: "bars", title: "Days since last message", rows: list.slice(0, 20).map((r) => ({ ...r, note: r.value === 999 ? "never" : undefined })) },
    };
  },
});

add({
  id: "staff-punishment-types",
  category: "staff",
  title: "Punishments by staff and type",
  blurb: "Who gives warnings, mutes, kicks and bans.",
  params: ["range"],
  tags: ["staff", "moderation", "heatmap"],
  run: async (c) => {
    const rows = await (await bot("punishments"))
      .aggregate([{ $match: inRange(c, "timestamp") }, { $group: { _id: { who: { $toString: { $ifNull: ["$issuerId", { $ifNull: ["$issuer_discord_id", "$issuer_id"] }] } }, a: "$action" }, v: { $sum: 1 } } }])
      .toArray();
    const actions = Array.from(new Set(rows.map((r) => String(r._id.a ?? "other")))).slice(0, 8);
    const whoTotals = new Map<string, number>();
    rows.forEach((r) => whoTotals.set(String(r._id.who), (whoTotals.get(String(r._id.who)) ?? 0) + n(r.v)));
    const whos = Array.from(whoTotals).sort((a, b) => b[1] - a[1]).slice(0, 14).map(([w]) => w);
    const nameOf = await names(whos.filter((w) => /^\d{15,21}$/.test(w)));
    const label = (w: string) => (/^\d{15,21}$/.test(w) ? nameOf(w) : /auto/i.test(w) ? "AutoMod" : "Not recorded");
    return {
      title: "Punishments by staff and type",
      subtitle: c.rangeText,
      footnote: "From the punishment records.",
      main: { kind: "heat", title: "Punishments given", rows: whos.map(label), cols: actions.map((a) => a.replace(/_/g, " ")), cells: whos.map((w) => actions.map((a) => n(rows.find((r) => String(r._id.who) === w && String(r._id.a ?? "other") === a)?.v))), totals: whos.map((w) => whoTotals.get(w) ?? 0) },
    };
  },
});

add({
  id: "staff-punishments-trend",
  category: "staff",
  title: "Moderation over time by staff",
  blurb: "Punishments per week or month for the four busiest moderators.",
  params: ["range", "tz"],
  tags: ["staff", "moderation", "trend"],
  run: async (c) => {
    const unit = unitFor(c);
    const col = await bot("punishments");
    const idExpr = { $toString: { $ifNull: ["$issuerId", { $ifNull: ["$issuer_discord_id", "$issuer_id"] }] } };
    const top = await col.aggregate([{ $match: inRange(c, "timestamp") }, { $group: { _id: idExpr, v: { $sum: 1 } } }, { $sort: { v: -1 } }, { $limit: 4 }]).toArray();
    const start = await startAt(c, col, "timestamp", 180);
    const nameOf = await names(top.map((t) => String(t._id)).filter((x) => /^\d+$/.test(x)));
    const lines = [];
    let labels: string[] = [];
    for (const t of top) {
      const who = String(t._id);
      const filter = /^\d+$/.test(who) ? { $or: [{ issuerId: who }, { issuer_discord_id: who }, { issuer_discord_id: Long.fromString(who) }] } : { $or: [{ issuerId: who }, { issuer_discord_id: who }] };
      const s = await series(col, "timestamp", filter, unit, c, start);
      labels = s.labels;
      lines.push({ name: /^\d+$/.test(who) ? nameOf(who) : /auto/i.test(who) ? "AutoMod" : "Not recorded", values: s.values });
    }
    return { title: "Moderation over time", subtitle: `Punishments per ${unit} by the busiest moderators · ${c.rangeText}.`, footnote: "From the punishment records.", main: { kind: "line", title: `Punishments per ${unit}`, labels, series: lines } };
  },
});

add({
  id: "staff-tickets",
  category: "staff",
  title: "Tickets by staff member",
  blurb: "Tickets each staff member handled, and how fast they closed them.",
  params: ["range"],
  tags: ["staff", "tickets"],
  run: async (c) => {
    const rows = await (await bot("resolvedTickets"))
      .aggregate([
        { $match: inRange(c, "created") },
        { $group: { _id: { $ifNull: ["$claimed_by", "$resolved_by"] }, v: { $sum: 1 }, close: { $avg: { $cond: [{ $and: [{ $eq: [{ $type: "$resolved_at" }, "date"] }, { $eq: [{ $type: "$created" }, "date"] }] }, { $subtract: ["$resolved_at", "$created"] }, null] } } } },
        { $match: { _id: { $ne: null } } },
        { $sort: { v: -1 } },
        { $limit: 12 },
      ])
      .toArray();
    const nameOf = await names(rows.map((r) => String(r._id)));
    return {
      title: "Tickets by staff member",
      subtitle: c.rangeText,
      footnote: "A ticket counts for whoever claimed it (or closed it if nobody claimed it). Close time is from opening to closing.",
      main: { kind: "leaderboard", title: "Tickets handled", rows: rows.map((r) => ({ label: nameOf(String(r._id)), value: n(r.v) })) },
      side: { kind: "bars", title: "Average hours to close", rows: rows.filter((r) => r.close).map((r) => ({ label: nameOf(String(r._id)), value: n(r.close) / 3_600_000 })), format: "hours" },
    };
  },
});

add({
  id: "staff-join-reviews",
  category: "staff",
  title: "Join applications reviewed",
  blurb: "Reviews per staff member and how often they approve.",
  params: ["range"],
  tags: ["staff", "join", "applications"],
  run: async (c) => {
    const rows = await (await bot("join_applications"))
      .aggregate([{ $match: { ...inRange(c, "reviewedAt"), reviewedBy: { $ne: null } } }, { $group: { _id: { $toString: "$reviewedBy" }, v: { $sum: 1 }, ok: { $sum: { $cond: [{ $in: ["$status", ["approved", "accepted"]] }, 1, 0] } }, secs: { $avg: { $subtract: ["$reviewedAt", "$submittedAt"] } } } }, { $sort: { v: -1 } }, { $limit: 12 }])
      .toArray();
    const nameOf = await names(rows.map((r) => String(r._id)));
    return {
      title: "Join applications reviewed",
      subtitle: c.rangeText,
      footnote: "From the join form. Wait time is from submitting to the review.",
      main: { kind: "leaderboard", title: "Reviews", rows: rows.map((r) => ({ label: nameOf(String(r._id)), value: n(r.v), note: `${pct(n(r.ok), n(r.v))} approved` })) },
      side: { kind: "bars", title: "Average wait (hours)", rows: rows.filter((r) => r.secs).map((r) => ({ label: nameOf(String(r._id)), value: n(r.secs) / 3_600_000 })), format: "hours" },
    };
  },
});

add({
  id: "staff-panel-actions",
  category: "staff",
  title: "Admin panel actions",
  blurb: "What admins do in the website's admin panel, and who does it.",
  params: ["range"],
  tags: ["staff", "admin", "panel", "audit"],
  run: async (c) => {
    const col = await web("admin_audit");
    const [who, what] = await Promise.all([
      col.aggregate([{ $match: inRange(c, "at") }, { $group: { _id: { $ifNull: ["$adminName", "Unknown"] }, v: { $sum: 1 } } }, { $sort: { v: -1 } }, { $limit: 12 }]).toArray(),
      col.aggregate([{ $match: inRange(c, "at") }, { $group: { _id: "$action", v: { $sum: 1 } } }, { $sort: { v: -1 } }, { $limit: 12 }]).toArray(),
    ]);
    const nice = (a: unknown) => String(a ?? "other").replace(/-/g, " ").replace(/^\w/, (x) => x.toUpperCase());
    const total = what.reduce((a, r) => a + n(r.v), 0);
    return { title: "Admin panel actions", subtitle: `${fmt(total)} logged actions · ${c.rangeText}.`, footnote: "From the admin panel's own log.", main: { kind: "bars", title: "By action", rows: what.map((r) => ({ label: nice(r._id), value: n(r.v) })), total }, side: { kind: "leaderboard", title: "By admin", rows: who.map((r) => ({ label: String(r._id), value: n(r.v) })) } };
  },
});

add({
  id: "staff-panel-trend",
  category: "staff",
  title: "Admin panel activity over time",
  blurb: "Admin panel actions per day, week or month.",
  params: ["range", "tz"],
  tags: ["staff", "admin", "trend"],
  run: async (c) => {
    const col = (await web("admin_audit")) as never;
    const unit = unitFor(c);
    const s = await series(col, "at", {}, unit, c, await startAt(c, col, "at", 30));
    return trend("Admin panel activity", `Actions per ${unit} · ${c.rangeText}.`, s, unit, "actions", "From the admin panel's own log.");
  },
});

add({
  id: "staff-content",
  category: "staff",
  title: "News, events and giveaways by staff",
  blurb: "Who writes the news, hosts events and runs giveaways.",
  params: ["range"],
  tags: ["staff", "news", "events", "giveaways"],
  run: async (c) => {
    const [news, events, gws] = await Promise.all([
      (await web("news")).aggregate([{ $match: { ...inRange(c, "publishedAt"), status: { $nin: ["draft", "pending"] } } }, { $group: { _id: { $ifNull: ["$authorName", "Staff"] }, v: { $sum: 1 }, views: { $sum: "$views" } } }, { $sort: { v: -1 } }, { $limit: 10 }]).toArray(),
      (await bot("events")).aggregate([{ $match: inRange(c, "startAt") }, { $group: { _id: { $ifNull: ["$hostName", "Staff"] }, v: { $sum: 1 } } }, { $sort: { v: -1 } }, { $limit: 10 }]).toArray(),
      (await bot("giveaways")).aggregate([{ $match: inRange(c, "createdAt") }, { $group: { _id: "$createdBy", v: { $sum: 1 } } }, { $sort: { v: -1 } }, { $limit: 10 }]).toArray(),
    ]);
    const gwNames = await names(gws.map((g) => String(g._id)));
    return {
      title: "News, events and giveaways",
      subtitle: `Who made what · ${c.rangeText}.`,
      footnote: "News counts published posts (with their total views). Events count the host.",
      tiles: [
        { label: "News posts", value: fmt(news.reduce((a, r) => a + n(r.v), 0)) },
        { label: "Events", value: fmt(events.reduce((a, r) => a + n(r.v), 0)) },
        { label: "Giveaways", value: fmt(gws.reduce((a, r) => a + n(r.v), 0)) },
      ],
      main: { kind: "leaderboard", title: "News posts", rows: news.map((r) => ({ label: String(r._id), value: n(r.v), note: `${fmt(n(r.views))} views` })) },
      side: { kind: "leaderboard", title: "Events hosted & giveaways run", rows: [...events.map((r) => ({ label: String(r._id), value: n(r.v), note: "events" })), ...gws.map((r) => ({ label: /^\d+$/.test(String(r._id)) ? gwNames(String(r._id)) : "Staff", value: n(r.v), note: "giveaways" }))].sort((a, b) => b.value - a.value).slice(0, 10) },
    };
  },
});

add({
  id: "staff-settings",
  category: "staff",
  title: "Bot settings changes",
  blurb: "Changes to the bots' settings from the admin panel, by who and which bot.",
  params: ["range"],
  tags: ["staff", "settings", "bots"],
  run: async (c) => {
    const col = await bot("bot_settings_log");
    const [who, which] = await Promise.all([
      col.aggregate([{ $match: inRange(c, "at") }, { $group: { _id: { $ifNull: ["$byName", "Unknown"] }, v: { $sum: 1 } } }, { $sort: { v: -1 } }]).toArray(),
      col.aggregate([{ $match: inRange(c, "at") }, { $group: { _id: { $concat: [{ $ifNull: ["$bot", "bot"] }, " · ", { $ifNull: ["$section", "settings"] }] }, v: { $sum: 1 } } }, { $sort: { v: -1 } }, { $limit: 12 }]).toArray(),
    ]);
    return { title: "Bot settings changes", subtitle: c.rangeText, footnote: "From Admin → Bots history.", main: { kind: "bars", title: "Changes by bot and section", rows: which.map((r) => ({ label: String(r._id), value: n(r.v) })) }, side: { kind: "leaderboard", title: "Changed by", rows: who.map((r) => ({ label: String(r._id), value: n(r.v) })) } };
  },
});

add({
  id: "staff-appeals",
  category: "staff",
  title: "Appeals decided",
  blurb: "Punishment appeals: decisions per admin and how many were accepted.",
  params: ["range"],
  tags: ["staff", "appeals"],
  run: async (c) => {
    const col = await web("appeals");
    const [who, status] = await Promise.all([
      col.aggregate([{ $match: { ...inRange(c, "createdAt"), decidedBy: { $ne: null } } }, { $group: { _id: { $toString: "$decidedBy" }, v: { $sum: 1 } } }, { $sort: { v: -1 } }]).toArray(),
      col.aggregate([{ $match: inRange(c, "createdAt") }, { $group: { _id: "$status", v: { $sum: 1 } } }]).toArray(),
    ]);
    const nameOf = await names(who.map((r) => String(r._id)).filter((x) => /^\d+$/.test(x)));
    return { title: "Appeals", subtitle: c.rangeText, footnote: "From the website's appeal form.", main: { kind: "leaderboard", title: "Decisions per admin", rows: who.map((r) => ({ label: /^\d+$/.test(String(r._id)) ? nameOf(String(r._id)) : String(r._id), value: n(r.v) })) }, bottom: { kind: "strip", title: "Outcomes", rows: status.map((r) => ({ label: String(r._id ?? "pending").replace(/^\w/, (x) => x.toUpperCase()), value: n(r.v) })) } };
  },
});

add({
  id: "staff-roster",
  category: "staff",
  title: "The staff team",
  blurb: "Team size by role and how long each member has been in the server.",
  params: [],
  tags: ["staff", "team", "roster"],
  run: async (c) => {
    const staff = staffMembers(c);
    const byRole = STAFF_ROLES.map(([, label]) => ({ label, value: staff.filter((m) => m.staffRole === label).length })).filter((r) => r.value);
    const tenure = staff.filter((m) => m.joinedAt).sort((a, b) => (a.joinedAt as number) - (b.joinedAt as number));
    return {
      title: "The Bear Nation team",
      subtitle: `${fmt(staff.length)} people on the staff team.`,
      footnote: "Live Discord roles. Each person is counted under their highest staff role.",
      main: { kind: "leaderboard", title: "Days in the server", rows: tenure.slice(0, 16).map((m) => ({ label: `${m.name} (${m.staffRole})`, value: Math.floor((Date.now() - (m.joinedAt as number)) / DAY) })) },
      bottom: { kind: "strip", title: "By role", rows: byRole },
    };
  },
});

add({
  id: "staff-voice",
  category: "staff",
  title: "Staff in voice",
  blurb: "Hours each staff member has spent in voice.",
  params: ["top"],
  tags: ["staff", "voice"],
  run: async (c) => {
    const docs = await (await bot("users")).find({ discordId: { $in: staffLongs(c) }, vc_time_total: { $gt: 0 } } as Document, { projection: { discordId: 1, vc_time_total: 1 } }).sort({ vc_time_total: -1 }).limit(c.top).toArray();
    const nameOf = await names(docs.map((d) => String(d.discordId)));
    return board("Staff in voice", "Total hours in voice channels.", docs.map((d) => ({ label: nameOf(String(d.discordId)), value: n(d.vc_time_total) / 3600 })), "hours in voice", "hours");
  },
});

add({
  id: "staff-reply-speed",
  category: "staff",
  title: "Staff reply speed",
  blurb: "How fast each staff member replies in chat, on average.",
  params: [],
  tags: ["staff", "replies", "speed"],
  run: async (c) => {
    const docs = await (await bot("member_activity")).aggregate([{ $match: { _id: { $in: staffMembers(c).map((m) => m.id) }, replyDelayCount: { $gte: 10 } } }, { $project: { avg: { $divide: ["$replyDelaySum", "$replyDelayCount"] }, n: "$replyDelayCount" } }, { $sort: { avg: 1 } }]).toArray();
    const nameOf = await names(docs.map((d) => String(d._id)));
    return { title: "Staff reply speed", subtitle: "Average minutes before replying (10+ replies).", footnote: "Shorter is faster. From the bot's activity tracker.", main: { kind: "leaderboard", title: "Average reply time", rows: docs.map((d) => ({ label: nameOf(String(d._id)), value: n(d.avg) / 60, note: `${fmt(n(d.n))} replies` })), format: "minutes" } };
  },
});

// ===== Server logs =====
add({
  id: "logs-categories",
  category: "server",
  title: "Bot log activity",
  blurb: "Everything the bots logged: joins and leaves, messages, voice, moderation, tickets…",
  params: ["range"],
  tags: ["logs", "bot"],
  run: async (c) => {
    const col = await web("bot_logs");
    const [cats, types] = await Promise.all([
      col.aggregate([{ $match: inRange(c, "ts") }, { $group: { _id: { $ifNull: ["$category", "other"] }, v: { $sum: 1 } } }, { $sort: { v: -1 } }]).toArray(),
      col.aggregate([{ $match: inRange(c, "ts") }, { $group: { _id: { $ifNull: ["$title", "$type"] }, v: { $sum: 1 } } }, { $sort: { v: -1 } }, { $limit: 12 }]).toArray(),
    ]);
    const total = cats.reduce((a, r) => a + n(r.v), 0);
    const nice = (s2: unknown) => String(s2 ?? "other").replace(/^\w/, (x) => x.toUpperCase());
    return { title: "What the bots logged", subtitle: `${fmt(total)} log entries · ${c.rangeText}.`, footnote: "From the bot log mirror (kept a year).", main: { kind: "bars", title: "By category", rows: cats.map((r) => ({ label: nice(r._id), value: n(r.v) })), total, colorful: true }, side: { kind: "bars", title: "Most common entries", rows: types.map((r) => ({ label: String(r._id ?? "Entry").slice(0, 40), value: n(r.v) })) } };
  },
});
for (const [cat, label] of [
  ["members", "Member log entries (joins, leaves, roles)"],
  ["voice", "Voice log entries (joins, moves, leaves)"],
  ["moderation", "Moderation log entries"],
  ["messages", "Message log entries (edits, deletes)"],
  ["boosts", "Boost log entries"],
] as const) {
  add({
    id: `logs-${cat}-trend`,
    category: "server",
    title: label,
    blurb: `${label} per day, week or month.`,
    params: ["range", "tz"],
    tags: ["logs", cat, "trend"],
    run: async (c) => {
      const col = (await web("bot_logs")) as never;
      const unit = unitFor(c);
      const s = await series(col, "ts", { category: cat }, unit, c, await startAt(c, col, "ts", 30, { category: cat }));
      return trend(label, `Per ${unit} · ${c.rangeText}.`, s, unit, "entries", "From the bot log mirror (kept a year).");
    },
  });
}
add({
  id: "logs-cleanup",
  category: "server",
  title: "Message clean-up",
  blurb: "Messages removed by the leaver clean-up, per month.",
  params: ["range", "tz"],
  tags: ["cleanup", "logs"],
  run: async (c) => {
    const col = await bot("cleanup_jobs");
    const unit = unitFor(c) === "day" ? "week" : unitFor(c);
    const s = await series(col, "finishedAt", { status: "done" }, unit, c, await startAt(c, col, "finishedAt", 180), "deleted");
    return trend("Messages cleaned up", `Removed by the leaver clean-up per ${unit} · ${c.rangeText}.`, s, unit, "messages removed", "From the clean-up jobs (members who left, or were wiped).");
  },
});

// ===== More chat =====
add({
  id: "chat-record-days",
  category: "chat",
  title: "Busiest days ever",
  blurb: "The record days for messages.",
  params: ["range", "among", "tz", "top"],
  tags: ["records", "days"],
  run: async (c) => {
    const rows = await (await bot("message_index")).aggregate([{ $match: msgMatch(c) }, { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$t", timezone: c.tz } }, v: { $sum: 1 }, who: { $addToSet: "$a" } } }, { $project: { v: 1, p: { $size: "$who" } } }, { $sort: { v: -1 } }, { $limit: c.top }]).toArray();
    const label = (k: string) => new Date(`${k}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
    return board("Busiest days ever", `Most messages in a single day · ${c.rangeText}${amongText(c)}.`, rows.map((r) => ({ label: label(String(r._id)), value: n(r.v), note: `${fmt(n(r.p))} chatters` })), "messages", undefined, `Days in ${zoneName(c.tz)} time. From the bot's message index.`);
  },
});
add({
  id: "chat-year-over-year",
  category: "chat",
  title: "This year vs last year",
  blurb: "Messages per month, this year next to last year.",
  params: ["among", "tz"],
  tags: ["year", "compare", "trend"],
  run: async (c) => {
    const rows = await (await bot("message_index")).aggregate([{ $match: msgMatch(c) }, { $group: { _id: { $dateToString: { format: "%Y-%m", date: "$t", timezone: c.tz } }, v: { $sum: 1 } } }]).toArray();
    const map = new Map(rows.map((r) => [String(r._id), n(r.v)]));
    const y = new Date().getFullYear();
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const get = (yr: number) => months.map((_, i) => map.get(`${yr}-${String(i + 1).padStart(2, "0")}`) ?? 0);
    const a = get(y);
    const b = get(y - 1);
    const sumA = a.reduce((p, q) => p + q, 0);
    const sumB = b.slice(0, new Date().getMonth() + 1).reduce((p, q) => p + q, 0);
    return {
      title: `${y} vs ${y - 1}`,
      subtitle: `Messages per month${amongText(c)}.`,
      footnote: "From the bot's message index (which starts in April 2025).",
      tiles: [
        { label: `${y} so far`, value: fmt(sumA) },
        { label: `${y - 1} same months`, value: fmt(sumB) },
        { label: "Change", value: sumB ? `${sumA >= sumB ? "+" : ""}${(((sumA - sumB) / sumB) * 100).toFixed(0)}%` : "—" },
      ],
      main: { kind: "line", title: "Messages per month", labels: months, series: [{ name: String(y - 1), values: b }, { name: String(y), values: a.map((v, i) => (i > new Date().getMonth() ? 0 : v)) }] },
    };
  },
});
add({
  id: "chat-channel-hours",
  category: "chat",
  title: "Channels by hour",
  blurb: "Heatmap: when each of the busiest channels is active.",
  params: ["range", "tz"],
  tags: ["channels", "heatmap", "hours"],
  run: async (c) => {
    const col = await bot("message_index");
    const top = await col.aggregate([{ $match: msgMatch(c) }, { $group: { _id: "$c", v: { $sum: 1 } } }, { $sort: { v: -1 } }, { $limit: 10 }]).toArray();
    const rows = await col.aggregate([{ $match: { ...msgMatch(c), c: { $in: top.map((t) => t._id) } } }, { $group: { _id: { c: "$c", h: { $hour: { date: "$t", timezone: c.tz } } }, v: { $sum: 1 } } }]).toArray();
    const ch = await channelNames();
    return {
      title: "When each channel is busy",
      subtitle: `Messages by hour in the 10 busiest channels · ${c.rangeText} · ${zoneName(c.tz)} time.`,
      footnote: "Each row is shaded on the same scale.",
      main: { kind: "heat", title: "Messages per hour", rows: top.map((t) => ch.get(String(t._id)) ?? "#deleted"), cols: Array.from({ length: 24 }, (_, h) => (h % 3 === 0 ? HOUR(h) : "")), cells: top.map((t) => Array.from({ length: 24 }, (_, h) => n(rows.find((r) => String(r._id.c) === String(t._id) && n(r._id.h) === h)?.v))), totals: top.map((t) => n(t.v)) },
    };
  },
});
add({
  id: "chat-consistent",
  category: "chat",
  title: "Most consistent chatters",
  blurb: "Members who chatted on the most different days.",
  params: ["range", "among", "tz", "top"],
  tags: ["leaderboard", "streak", "days"],
  run: async (c) => {
    const inServer = new Set(c.snap.members.filter((m) => !m.bot).map((m) => m.id));
    const rows = await (await bot("message_index")).aggregate([{ $match: msgMatch(c) }, { $group: { _id: { a: "$a", d: { $dateToString: { format: "%Y-%m-%d", date: "$t", timezone: c.tz } } } } }, { $group: { _id: "$_id.a", v: { $sum: 1 } } }, { $sort: { v: -1 } }, { $limit: c.top * 3 }]).toArray();
    const list = rows.filter((r) => inServer.has(String(r._id))).slice(0, c.top);
    const nameOf = await names(list.map((r) => String(r._id)));
    return board("Most consistent chatters", `Different days with at least one message · ${c.rangeText}${amongText(c)}.`, list.map((r) => ({ label: nameOf(String(r._id)), value: n(r.v) })), "days");
  },
});
add({
  id: "chat-talkers-vs-quiet",
  category: "chat",
  title: "Chatters vs quiet members",
  blurb: "How many members chatted in the range, and how many stayed quiet.",
  params: ["range", "among"],
  tags: ["lurkers", "quiet", "active"],
  run: async (c) => {
    const ms = members(c);
    const authors = new Set((await (await bot("message_index")).distinct("a", msgMatch(c))).map((x) => String(x)));
    const talked = ms.filter((m) => authors.has(m.id));
    const quiet = ms.filter((m) => !authors.has(m.id));
    const recentQuiet = quiet.filter((m) => (m.joinedAt ?? 0) > Date.now() - 30 * DAY).length;
    return {
      title: "Chatters vs quiet members",
      subtitle: `${fmt(ms.length)} members${amongText(c)} · ${c.rangeText}.`,
      footnote: "Quiet means no messages in the range. From the bot's message index and the live member list.",
      hero: { label: "Chatted", big: pct(talked.length, ms.length), caption: `${fmt(talked.length)} members sent at least one message; ${fmt(quiet.length)} didn't (${fmt(recentQuiet)} of them joined in the last 30 days).` },
      main: { kind: "columns", title: "Quiet members by time in the server", rows: bands(quiet.map((m) => (Date.now() - (m.joinedAt ?? Date.now())) / DAY), [[0, 7, "< 1 week"], [7, 30, "1–4 weeks"], [30, 90, "1–3 months"], [90, 365, "3–12 months"], [365, 1e9, "1+ year"]]) },
      bottom: { kind: "strip", title: "Everyone", rows: [{ label: "Chatted", value: talked.length }, { label: "Quiet", value: quiet.length, muted: true }] },
    };
  },
});
add({
  id: "chat-first-week",
  category: "chat",
  title: "New members who say hello",
  blurb: "Of each month's new members, how many chatted within their first week.",
  params: ["tz"],
  tags: ["retention", "new", "onboarding"],
  run: async (c) => {
    const ms = c.snap.members.filter((m) => !m.bot && m.joinedAt && m.joinedAt > Date.now() - 365 * DAY);
    const firsts = await (await bot("message_index")).aggregate([{ $match: { a: { $in: ms.map((m) => Long.fromString(m.id)) } } }, { $group: { _id: "$a", first: { $min: "$t" } } }]).toArray();
    const first = new Map(firsts.map((f) => [String(f._id), (f.first as Date).getTime()]));
    const b = buckets("month", new Date(Date.now() - 335 * DAY), c.tz);
    const monthOf = (t: number) => new Date(t).toLocaleDateString("en-CA", { timeZone: c.tz }).slice(0, 7);
    const vals = b.map((x) => {
      const joined = ms.filter((m) => monthOf(m.joinedAt as number) === x.key);
      const hello = joined.filter((m) => first.has(m.id) && first.get(m.id)! - (m.joinedAt as number) < 7 * DAY && first.get(m.id)! >= (m.joinedAt as number) - DAY);
      return joined.length ? Math.round((hello.length / joined.length) * 100) : 0;
    });
    return { title: "New members who say hello", subtitle: "Share of each month's new members (still here) who chatted within 7 days of joining.", footnote: "Only counts members who are still in the server.", main: { kind: "columns", timeline: true, partial: { first: true, last: true, step: "month" }, title: "Chatted in their first week (%)", rows: b.map((x, i) => ({ label: x.label, value: vals[i] })), format: "percent" } };
  },
});
add({
  id: "chat-by-role-group",
  category: "chat",
  title: "Who talks most, by role group",
  blurb: "Messages per role in a group (like Gender), total and per member.",
  params: ["group", "range"],
  tags: ["roles", "gender", "messages"],
  run: async (c) => {
    const key = c.p.group || "Gender";
    const cat = c.snap.categories.find((x) => x.key === key);
    const counts = await (await bot("message_index")).aggregate([{ $match: msgMatch(c) }, { $group: { _id: "$a", v: { $sum: 1 } } }]).toArray();
    const per = new Map(counts.map((r) => [String(r._id), n(r.v)]));
    const rows = (cat?.roleIds ?? [])
      .map((id) => {
        const i = c.snap.roles.findIndex((r) => r.id === id);
        const ms = c.snap.members.filter((m) => !m.bot && m.r.includes(i));
        const total = ms.reduce((a, m) => a + (per.get(m.id) ?? 0), 0);
        return { label: c.snap.roles[i]?.name ?? id, value: total, perMember: ms.length ? total / ms.length : 0 };
      })
      .sort((a, b) => b.value - a.value);
    const all = rows.reduce((a, r) => a + r.value, 0);
    return {
      title: `Who talks most, by ${(cat?.title ?? key).toLowerCase()}`,
      subtitle: c.rangeText,
      footnote: "Members with more than one role in the group count for each. From the bot's message index and live roles.",
      main: { kind: "bars", title: "Messages", rows: rows.map((r) => ({ label: r.label, value: r.value })), total: all, colorful: rows.length <= 8 },
      side: { kind: "bars", title: "Messages per member", rows: rows.map((r) => ({ label: r.label, value: Math.round(r.perMember) })).sort((a, b) => b.value - a.value) },
    };
  },
});
add({
  id: "chat-by-level",
  category: "chat",
  title: "Messages by level",
  blurb: "How much of the chat comes from each level band.",
  params: ["range"],
  tags: ["levels", "messages"],
  run: async (c) => {
    const counts = await (await bot("message_index")).aggregate([{ $match: msgMatch(c) }, { $group: { _id: "$a", v: { $sum: 1 } } }]).toArray();
    const lvl = new Map(c.snap.members.map((m) => [m.id, m.level ?? 0]));
    const edges: [number, number, string][] = [[0, 4, "Level 0–4"], [5, 9, "5–9"], [10, 19, "10–19"], [20, 29, "20–29"], [30, 1e9, "30+"]];
    const rows = edges.map(([a, b, label]) => ({ label, value: counts.filter((r) => { const l = lvl.get(String(r._id)); return l !== undefined && l >= a && l <= b; }).reduce((x, r) => x + n(r.v), 0) }));
    const total = rows.reduce((a, r) => a + r.value, 0);
    return { title: "Messages by level", subtitle: c.rangeText, footnote: "Members still in the server, by their current level.", main: { kind: "bars", title: "Messages", rows, total, colorful: true } };
  },
});
add({
  id: "chat-newcomers-share",
  category: "chat",
  title: "Newcomers vs regulars",
  blurb: "How much of the chat comes from members who joined recently.",
  params: ["range"],
  tags: ["new", "regulars"],
  run: async (c) => {
    const counts = await (await bot("message_index")).aggregate([{ $match: msgMatch(c) }, { $group: { _id: "$a", v: { $sum: 1 } } }]).toArray();
    const joined = new Map(c.snap.members.map((m) => [m.id, m.joinedAt ?? 0]));
    const age = (id: string) => (Date.now() - (joined.get(id) ?? 0)) / DAY;
    const rows = [
      { label: "Joined < 30 days ago", value: 0 },
      { label: "1–6 months", value: 0 },
      { label: "6–12 months", value: 0 },
      { label: "1+ year", value: 0 },
    ];
    for (const r of counts) {
      if (!joined.has(String(r._id))) continue;
      const d = age(String(r._id));
      rows[d < 30 ? 0 : d < 182 ? 1 : d < 365 ? 2 : 3].value += n(r.v);
    }
    const total = rows.reduce((a, r) => a + r.value, 0);
    return { title: "Newcomers vs regulars", subtitle: `Messages by how long the sender has been in the server · ${c.rangeText}.`, footnote: "Members still in the server, by their current join date.", hero: { label: "From newcomers", big: pct(rows[0].value, total), caption: `of messages came from members who joined in the last 30 days.` }, main: { kind: "bars", title: "Messages", rows, total, colorful: true } };
  },
});

// ===== More members =====
add({
  id: "members-joins-trend",
  category: "members",
  title: "New members over time",
  blurb: "Members joining per day, week or month (still in the server).",
  params: ["range", "tz", "among"],
  tags: ["growth", "joins", "trend"],
  run: async (c) => {
    const ms = members(c).filter((m) => m.joinedAt && (!c.since || (m.joinedAt as number) >= c.since.getTime()) && (m.joinedAt as number) < c.until.getTime());
    const unit = unitFor(c);
    const start = c.since ?? new Date(Math.min(...ms.map((m) => m.joinedAt as number)));
    const b = buckets(unit, start, c.tz, c.until);
    const key = (t: number) => {
      const d = new Date(t);
      return unit === "week" ? weekKey(d, c.tz) : unit === "month" ? d.toLocaleDateString("en-CA", { timeZone: c.tz }).slice(0, 7) : d.toLocaleDateString("en-CA", { timeZone: c.tz });
    };
    const counts = new Map<string, number>();
    ms.forEach((m) => counts.set(key(m.joinedAt as number), (counts.get(key(m.joinedAt as number)) ?? 0) + 1));
    return trend("New members", `Joined per ${unit} and still here · ${c.rangeText}${amongText(c)}.`, { labels: b.map((x) => x.label), values: b.map((x) => counts.get(x.key) ?? 0) }, unit, "new members", "From the live member list: members who left again aren't counted.");
  },
});
add({
  id: "members-join-heatmap",
  category: "members",
  title: "When people join",
  blurb: "Day × hour heatmap of when members joined.",
  params: ["range", "tz"],
  tags: ["joins", "heatmap"],
  run: async (c) => {
    const ms = members(c).filter((m) => m.joinedAt && (!c.since || (m.joinedAt as number) >= c.since.getTime()) && (m.joinedAt as number) < c.until.getTime());
    // Each join's own local weekday and hour (correct across daylight-saving changes)
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: c.tz, weekday: "short", hour: "numeric", hourCycle: "h23" });
    const map = new Map<number, number>();
    ms.forEach((m) => {
      const p = parts.formatToParts(new Date(m.joinedAt as number));
      const day = WEEKDAYS.indexOf(p.find((x) => x.type === "weekday")?.value ?? "Mon");
      const hour = Number(p.find((x) => x.type === "hour")?.value ?? 0) % 24;
      const k = Math.max(0, day) * 24 + hour;
      map.set(k, (map.get(k) ?? 0) + 1);
    });
    return { title: "When people join", subtitle: `${fmt(ms.length)} members · ${c.rangeText} · ${zoneName(c.tz)} time.`, footnote: "Members still in the server, by when they joined.", main: { kind: "heat", title: "Joins by day and hour", ...heatFromWeekHours(map) } };
  },
});
add({
  id: "members-verification",
  category: "members",
  title: "Verification funnel",
  blurb: "Unverified → Member → 18+ Verified → website account → Social profile.",
  params: [],
  tags: ["verification", "funnel"],
  run: async (c) => {
    const ms = members(c);
    const has = (id: string) => {
      const i = c.snap.roles.findIndex((r) => r.id === id);
      return ms.filter((m) => m.r.includes(i)).length;
    };
    const rows = [
      { label: "In the server", value: ms.length },
      { label: "Verified (Member)", value: has("1358469854725931038") },
      { label: "18+ Verified", value: has("1358469974552870913") },
      { label: "Website account", value: ms.filter((m) => m.account).length },
      { label: "Social profile", value: ms.filter((m) => m.social).length },
    ];
    return { title: "The verification funnel", subtitle: "How far members get, from joining to a Social profile.", footnote: `${fmt(has("1358469817191104716"))} members still have the Unverified role. Live Discord roles.`, main: { kind: "bars", title: "Members at each step", rows: rows.map((r) => ({ ...r, note: pct(r.value, ms.length) })), colorful: true } };
  },
});
add({
  id: "members-role-counts",
  category: "members",
  title: "How many roles members have",
  blurb: "Members grouped by how many roles they've picked up.",
  params: ["among"],
  tags: ["roles"],
  run: async (c) => {
    const ms = members(c);
    const counts = ms.map((m) => m.r.length);
    return { title: "How many roles members have", subtitle: `${fmt(ms.length)} members${amongText(c)}.`, footnote: `Average: ${(counts.reduce((a, b) => a + b, 0) / Math.max(1, ms.length)).toFixed(1)} roles. Live Discord roles.`, main: { kind: "columns", title: "Members by number of roles", rows: bands(counts, [[0, 1, "0–1"], [2, 4, "2–4"], [5, 9, "5–9"], [10, 14, "10–14"], [15, 19, "15–19"], [20, 1e9, "20+"]]) } };
  },
});
add({
  id: "members-boosters",
  category: "members",
  title: "Server boosters",
  blurb: "Everyone boosting, and for how long.",
  params: [],
  tags: ["boosts", "boosters"],
  run: async (c) => {
    const bs = c.snap.members.filter((m) => m.boosting).sort((a, b) => (a.boosting as number) - (b.boosting as number));
    return { title: "Server boosters", subtitle: `${fmt(bs.length)} members boosting right now.`, footnote: "Live from Discord. Thank you, boosters!", main: { kind: "leaderboard", title: "Days boosting", rows: bs.slice(0, 20).map((m) => ({ label: m.name, value: Math.floor((Date.now() - (m.boosting as number)) / DAY) })) } };
  },
});

// ===== More economy, casino & store =====
add({
  id: "economy-voice-earnings",
  category: "levels",
  title: "Leaves and XP from voice",
  blurb: "What members earned for time in voice, per day, week or month.",
  params: ["range", "tz"],
  tags: ["voice", "leaves", "xp", "trend"],
  run: async (c) => {
    const col = (await web("vc_rewards")) as never;
    const unit = unitFor(c);
    const start = await startAt(c, col, "ts", 30);
    const leaves = await series(col, "ts", {}, unit, c, start, "leaves");
    const xp = await series(col, "ts", {}, unit, c, start, "xp");
    return { title: "Leaves and XP from voice", subtitle: `Per ${unit} · ${c.rangeText}.`, footnote: "From the voice reward history (kept a year).", tiles: [{ label: "Leaves earned", value: fmt(leaves.values.reduce((a, b) => a + b, 0)) }, { label: "XP earned", value: fmt(xp.values.reduce((a, b) => a + b, 0)) }], main: { kind: "line", title: `Per ${unit}`, labels: leaves.labels, series: [{ name: "Leaves", values: leaves.values }, { name: "XP", values: xp.values }] } };
  },
});
add({
  id: "economy-sinks",
  category: "levels",
  title: "Where leaves go",
  blurb: "Leaves spent in the store, lost in the casino and won back.",
  params: ["range"],
  tags: ["leaves", "economy", "store", "casino"],
  run: async (c) => {
    const [store, casino] = await Promise.all([
      (await bot("store_sales")).aggregate([{ $match: inRange(c, "timestamp") }, { $group: { _id: null, v: { $sum: "$price_paid" } } }]).toArray(),
      (await bot("gambling_logs")).aggregate([{ $match: inRange(c, "timestamp") }, { $group: { _id: null, spent: { $sum: "$spent" }, won: { $sum: "$won" } } }]).toArray(),
    ]);
    const s1 = n(store[0]?.v);
    const spent = n(casino[0]?.spent);
    const won = n(casino[0]?.won);
    return {
      title: "Where leaves go",
      subtitle: c.rangeText,
      footnote: "Casino take = leaves bet minus leaves paid out.",
      tiles: [
        { label: "Spent in the store", value: fmt(s1) },
        { label: "Bet in the casino", value: fmt(spent) },
        { label: "Paid back by the casino", value: fmt(won) },
        { label: "Casino take", value: fmt(spent - won) },
      ],
      main: { kind: "strip", title: "Leaves leaving the economy", rows: [{ label: "Store", value: s1 }, { label: "Casino take", value: Math.max(0, spent - won) }] },
    };
  },
});
add({
  id: "casino-house-trend",
  category: "casino",
  title: "Casino take over time",
  blurb: "Leaves bet vs paid out, per day, week or month.",
  params: ["range", "game", "tz"],
  tags: ["casino", "profit", "trend"],
  run: async (c) => {
    const col = await bot("gambling_logs");
    const unit = unitFor(c);
    const start = await startAt(c, col, "timestamp", 30);
    const spent = await series(col, "timestamp", casinoMatch(c), unit, c, start, "spent");
    const won = await series(col, "timestamp", casinoMatch(c), unit, c, start, "won");
    return { title: `${c.p.game ? gameName(c.p.game) : "Casino"}: bet vs paid out`, subtitle: `Per ${unit} · ${c.rangeText}.`, footnote: "From the gambling history (kept 180 days).", main: { kind: "line", title: `Leaves per ${unit}`, labels: spent.labels, series: [{ name: "Bet", values: spent.values }, { name: "Paid out", values: won.values }], format: "leaves" } };
  },
});
add({
  id: "casino-bet-sizes",
  category: "casino",
  title: "Bet sizes",
  blurb: "How big people bet.",
  params: ["range", "game"],
  tags: ["casino", "bets"],
  run: async (c) => {
    const rows = await (await bot("gambling_logs")).find(casinoMatch(c), { projection: { spent: 1 } }).limit(50000).toArray();
    const vals = rows.map((r) => n(r.spent));
    const sorted = vals.slice().sort((a, b) => a - b);
    return { title: `${c.p.game ? gameName(c.p.game) : "Casino"} bet sizes`, subtitle: `${fmt(vals.length)} games · ${c.rangeText}.`, footnote: `Median bet: ${fmt(sorted[Math.floor(sorted.length / 2)] ?? 0)} leaves.`, main: { kind: "columns", title: "Games by bet size", rows: bands(vals, [[0, 49, "< 50"], [50, 99, "50–99"], [100, 499, "100–499"], [500, 999, "500–999"], [1000, 4999, "1K–5K"], [5000, 24999, "5K–25K"], [25000, 1e12, "25K+"]]) } };
  },
});
add({
  id: "casino-heatmap",
  category: "casino",
  title: "When people gamble",
  blurb: "Day × hour heatmap of casino games.",
  params: ["range", "game", "tz"],
  tags: ["casino", "heatmap"],
  run: async (c) => {
    const rows = await (await bot("gambling_logs")).aggregate([{ $match: casinoMatch(c) }, { $group: { _id: { d: { $isoDayOfWeek: { date: "$timestamp", timezone: c.tz } }, h: { $hour: { date: "$timestamp", timezone: c.tz } } }, v: { $sum: 1 } } }]).toArray();
    const map = new Map(rows.map((r) => [(n(r._id.d) - 1) * 24 + n(r._id.h), n(r.v)]));
    return { title: "When people gamble", subtitle: `${c.rangeText} · ${zoneName(c.tz)} time.`, footnote: "From the gambling history (kept 180 days).", main: { kind: "heat", title: "Games by day and hour", ...heatFromWeekHours(map) } };
  },
});
add({
  id: "casino-biggest-losses",
  category: "casino",
  title: "Biggest single losses",
  blurb: "The most leaves lost in one game.",
  params: ["among", "top"],
  tags: ["casino", "leaderboard"],
  run: async (c) => {
    const ids = amongIds(c) ?? c.snap.members.filter((m) => !m.bot).map((m) => m.id);
    const docs = await (await bot("gambling")).find({ discordId: { $in: ids.flatMap((id) => [Long.fromString(id), id]) }, biggest_loss: { $lt: 0 } } as Document, { projection: { discordId: 1, biggest_loss: 1 } }).sort({ biggest_loss: 1 }).limit(c.top).toArray();
    const nameOf = await names(docs.map((d) => String(d.discordId)));
    return board("Biggest single losses", `All-time casino stats${amongText(c)}.`, docs.map((d) => ({ label: nameOf(String(d.discordId)), value: -n(d.biggest_loss) })), "leaves lost in one game", "leaves");
  },
});
add({
  id: "store-weekdays",
  category: "store",
  title: "When people shop",
  blurb: "Store purchases by weekday, and Discord vs website.",
  params: ["range", "tz"],
  tags: ["store", "weekday"],
  run: async (c) => {
    const col = await bot("store_sales");
    const [days, src] = await Promise.all([
      col.aggregate([{ $match: inRange(c, "timestamp") }, { $group: { _id: { $isoDayOfWeek: { date: "$timestamp", timezone: c.tz } }, v: { $sum: 1 } } }]).toArray(),
      col.aggregate([{ $match: inRange(c, "timestamp") }, { $group: { _id: { $ifNull: ["$source", "discord"] }, v: { $sum: 1 } } }]).toArray(),
    ]);
    const map = new Map(days.map((r) => [n(r._id), n(r.v)]));
    return { title: "When people shop", subtitle: `${c.rangeText} · ${zoneName(c.tz)} time.`, footnote: "From store purchases.", main: { kind: "columns", title: "Purchases per weekday", rows: WEEKDAYS.map((d, i) => ({ label: d, value: map.get(i + 1) ?? 0 })) }, bottom: { kind: "strip", title: "Where they bought", rows: src.map((r) => ({ label: String(r._id) === "website" ? "Website" : "Discord", value: n(r.v) })) } };
  },
});

// ===== More moderation =====
add({
  id: "mod-heatmap",
  category: "moderation",
  title: "When punishments happen",
  blurb: "Day × hour heatmap of punishments.",
  params: ["range", "tz"],
  tags: ["moderation", "heatmap"],
  run: async (c) => {
    const rows = await (await bot("punishments")).aggregate([{ $match: inRange(c, "timestamp") }, { $group: { _id: { d: { $isoDayOfWeek: { date: "$timestamp", timezone: c.tz } }, h: { $hour: { date: "$timestamp", timezone: c.tz } } }, v: { $sum: 1 } } }]).toArray();
    const map = new Map(rows.map((r) => [(n(r._id.d) - 1) * 24 + n(r._id.h), n(r.v)]));
    return { title: "When punishments happen", subtitle: `${c.rangeText} · ${zoneName(c.tz)} time.`, footnote: "From the punishment records.", main: { kind: "heat", title: "Punishments by day and hour", ...heatFromWeekHours(map) } };
  },
});
add({
  id: "mod-repeat",
  category: "moderation",
  title: "Repeat offenders",
  blurb: "Members (still here) with the most punishments.",
  params: ["range", "top"],
  tags: ["moderation", "leaderboard"],
  run: async (c) => {
    const inServer = new Set(c.snap.members.filter((m) => !m.bot).map((m) => m.id));
    const rows = await (await bot("punishments")).aggregate([{ $match: inRange(c, "timestamp") }, { $group: { _id: { $toString: { $ifNull: ["$discordId", "$user_discord_id"] } }, v: { $sum: 1 }, types: { $addToSet: "$action" } } }, { $sort: { v: -1 } }, { $limit: c.top * 3 }]).toArray();
    const list = rows.filter((r) => inServer.has(String(r._id))).slice(0, c.top);
    const nameOf = await names(list.map((r) => String(r._id)));
    return board("Repeat offenders", `Punishments per member · ${c.rangeText}.`, list.map((r) => ({ label: nameOf(String(r._id)), value: n(r.v), note: (r.types as string[]).slice(0, 3).join(", ") })), "punishments", undefined, "Staff only. Members still in the server.");
  },
});
add({
  id: "mod-automod-trend",
  category: "moderation",
  title: "AutoMod over time",
  blurb: "AutoMod catches per day or week.",
  params: ["range", "tz"],
  tags: ["automod", "trend"],
  run: async (c) => {
    const col = await bot("automod_events");
    const unit = unitFor(c);
    const s = await series(col, "at", {}, unit, c, await startAt(c, col, "at", 30));
    return trend("AutoMod catches", `Per ${unit} · ${c.rangeText}.`, s, unit, "catches", "AutoMod catches are kept for 90 days.");
  },
});
add({
  id: "tickets-heatmap",
  category: "moderation",
  title: "When tickets are opened",
  blurb: "Day × hour heatmap of new tickets.",
  params: ["range", "tz"],
  tags: ["tickets", "heatmap"],
  run: async (c) => {
    const rows = await (await bot("resolvedTickets")).aggregate([{ $match: { ...inRange(c, "created"), created: { ...(inRange(c, "created").created as Document | undefined), $type: "date" } } }, { $group: { _id: { d: { $isoDayOfWeek: { date: "$created", timezone: c.tz } }, h: { $hour: { date: "$created", timezone: c.tz } } }, v: { $sum: 1 } } }]).toArray();
    const map = new Map(rows.map((r) => [(n(r._id.d) - 1) * 24 + n(r._id.h), n(r.v)]));
    return { title: "When tickets are opened", subtitle: `${c.rangeText} · ${zoneName(c.tz)} time.`, footnote: "From closed tickets.", main: { kind: "heat", title: "Tickets by day and hour", ...heatFromWeekHours(map) } };
  },
});
add({
  id: "tickets-types-trend",
  category: "moderation",
  title: "Ticket types over time",
  blurb: "The four most common ticket types, per week or month.",
  params: ["range", "tz"],
  tags: ["tickets", "trend"],
  run: async (c) => {
    const col = await bot("resolvedTickets");
    const unit = unitFor(c) === "day" ? "week" : unitFor(c);
    const top = await col.aggregate([{ $match: inRange(c, "created") }, { $group: { _id: "$ticket_type", v: { $sum: 1 } } }, { $sort: { v: -1 } }, { $limit: 4 }]).toArray();
    const start = await startAt(c, col, "created", 180);
    const lines = [];
    let labels: string[] = [];
    for (const t of top) {
      const s = await series(col, "created", { ticket_type: t._id }, unit, c, start);
      labels = s.labels;
      lines.push({ name: String(t._id ?? "support").replace(/[_-]/g, " ").replace(/^\w/, (x) => x.toUpperCase()), values: s.values });
    }
    return { title: "Ticket types over time", subtitle: `Per ${unit} · ${c.rangeText}.`, footnote: "From closed tickets.", main: { kind: "line", title: `Tickets per ${unit}`, labels, series: lines } };
  },
});
add({
  id: "join-review-speed",
  category: "moderation",
  title: "How fast join forms are reviewed",
  blurb: "Average hours from submitting to a decision, per month.",
  params: ["tz"],
  tags: ["join", "speed"],
  run: async (c) => {
    const rows = await (await bot("join_applications")).aggregate([{ $match: { reviewedAt: { $type: "date" }, submittedAt: { $type: "date", $gte: new Date(Date.now() - 365 * DAY) } } }, { $group: { _id: { $dateToString: { format: "%Y-%m", date: "$submittedAt", timezone: c.tz } }, h: { $avg: { $subtract: ["$reviewedAt", "$submittedAt"] } }, v: { $sum: 1 } } }]).toArray();
    const map = new Map(rows.map((r) => [String(r._id), n(r.h) / 3_600_000]));
    const b = buckets("month", new Date(Date.now() - 335 * DAY), c.tz);
    return { title: "How fast join forms are reviewed", subtitle: "Average hours from submitting to the decision.", footnote: "From the join form.", main: { kind: "columns", timeline: true, partial: { first: true, last: true, step: "month" }, title: "Average wait (hours)", rows: b.map((x) => ({ label: x.label, value: Math.round((map.get(x.key) ?? 0) * 10) / 10 })), format: "hours" } };
  },
});

// ===== More website & community =====
add({
  id: "web-heatmap",
  category: "website",
  title: "When the website is busy",
  blurb: "Day × hour heatmap of page views.",
  params: ["range", "tz"],
  tags: ["website", "heatmap"],
  run: async (c) => {
    const rows = await (await web("page_views")).aggregate([{ $match: inRange(c, "ts") }, { $group: { _id: { d: { $isoDayOfWeek: { date: "$ts", timezone: c.tz } }, h: { $hour: { date: "$ts", timezone: c.tz } } }, v: { $sum: 1 } } }]).toArray();
    const map = new Map(rows.map((r) => [(n(r._id.d) - 1) * 24 + n(r._id.h), n(r.v)]));
    return { title: "When the website is busy", subtitle: `${c.rangeText} · ${zoneName(c.tz)} time.`, footnote: "From the website's own traffic stats.", main: { kind: "heat", title: "Page views by day and hour", ...heatFromWeekHours(map) } };
  },
});
add({
  id: "web-visitors",
  category: "website",
  title: "Who visits the website",
  blurb: "New vs returning visitors, signed in vs guests, Discord linked.",
  params: ["range"],
  tags: ["website", "visitors"],
  run: async (c) => {
    const [r] = await (await web("page_views")).aggregate([{ $match: inRange(c, "ts") }, { $group: { _id: null, views: { $sum: 1 }, fresh: { $sum: { $cond: ["$newVisitor", 1, 0] } }, signed: { $sum: { $cond: ["$signedIn", 1, 0] } }, linked: { $sum: { $cond: ["$linked", 1, 0] } }, vis: { $addToSet: "$vid" } } }, { $project: { views: 1, fresh: 1, signed: 1, linked: 1, vis: { $size: "$vis" } } }]).toArray();
    const v = n(r?.views);
    return {
      title: "Who visits the website",
      subtitle: `${fmt(v)} page views from ${fmt(n(r?.vis))} visitors · ${c.rangeText}.`,
      footnote: "From the website's own traffic stats (no outside trackers).",
      tiles: [
        { label: "Page views", value: fmt(v) },
        { label: "Visitors", value: fmt(n(r?.vis)) },
        { label: "Pages per visitor", value: n(r?.vis) ? (v / n(r?.vis)).toFixed(1) : "—" },
      ],
      main: { kind: "bars", title: "Share of page views", rows: [{ label: "Signed in", value: n(r?.signed) }, { label: "Discord linked", value: n(r?.linked) }, { label: "First visit", value: n(r?.fresh) }], total: v, colorful: true },
    };
  },
});
add({
  id: "social-profile-views",
  category: "social",
  title: "Social profile views over time",
  blurb: "Profile views per day, week or month (counts only).",
  params: ["range", "tz"],
  tags: ["social", "views", "trend"],
  run: async (c) => {
    const col = (await web("dating_profile_views")) as never;
    const unit = unitFor(c);
    const s = await series(col, "at", {}, unit, c, await startAt(c, col, "at", 30));
    return trend("Social profile views", `Per ${unit} · ${c.rangeText}.`, s, unit, "views", "Counts only, kept 180 days.");
  },
});
add({
  id: "giveaway-entries-trend",
  category: "community",
  title: "Giveaway entries over time",
  blurb: "Entries per day, week or month.",
  params: ["range", "tz"],
  tags: ["giveaways", "trend"],
  run: async (c) => {
    const col = await bot("giveaway_entries");
    const unit = unitFor(c);
    const s = await series(col, "at", {}, unit, c, await startAt(c, col, "at", 30));
    return trend("Giveaway entries", `Per ${unit} · ${c.rangeText}.`, s, unit, "entries");
  },
});
add({
  id: "qotd-top",
  category: "community",
  title: "Top QOTD players",
  blurb: "Most correct Question of the Day answers.",
  params: ["top"],
  tags: ["qotd", "leaderboard"],
  run: async (c) => board("Top QOTD players", "All-time correct answers.", await leaders(c, "qotd", "total_correct", "user_id", { title: "" }), "correct answers"),
});

export const STAT_LIST: StatMeta[] = STATS.map(({ run: _r, ...meta }) => meta);

// ---------- running ----------

const cache = new Map<string, { at: number; spec: Spec }>();
// The end of the range this request is working out (for "still in progress" notes), per request
const rangeEnd = new AsyncLocalStorage<Date>();

/** Midnight on a calendar date in a time zone. */
function zonedMidnight(y: number, m: number, d: number, tz: string) {
  const guess = new Date(Date.UTC(y, m - 1, d));
  const local = new Date(guess.toLocaleString("en-US", { timeZone: tz }));
  const utc = new Date(guess.toLocaleString("en-US", { timeZone: "UTC" }));
  return new Date(guess.getTime() - (local.getTime() - utc.getTime()));
}

/**
 * The range options: "7" / "30" / "90" / "180" / "365" days, "ytd" (this year), "all", "y2025" (a year),
 * "m2026-10" (a month) or "c:2026-01-01:2026-03-31" (custom dates, both included).
 */
export function parseRange(v: string, tz: string): { since: Date | null; until: Date; text: string } {
  const now = new Date();
  const fmtD = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: tz });
  if (/^\d{1,4}$/.test(v)) return { since: new Date(now.getTime() - Number(v) * DAY), until: now, text: RANGES.find((x) => x[0] === v)?.[1] ?? `Last ${v} days` };
  if (v === "all") return { since: null, until: now, text: "All time" };
  const year = Number(new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric" }).format(now));
  if (v === "ytd") return { since: zonedMidnight(year, 1, 1, tz), until: now, text: `${year} so far` };
  let m = /^y(\d{4})$/.exec(v);
  if (m) {
    const y = Number(m[1]);
    const until = zonedMidnight(y + 1, 1, 1, tz);
    return { since: zonedMidnight(y, 1, 1, tz), until: until > now ? now : until, text: String(y) };
  }
  m = /^m(\d{4})-(\d{2})$/.exec(v);
  if (m) {
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const until = zonedMidnight(mo === 12 ? y + 1 : y, mo === 12 ? 1 : mo + 1, 1, tz);
    return { since: zonedMidnight(y, mo, 1, tz), until: until > now ? now : until, text: new Date(Date.UTC(y, mo - 1, 15)).toLocaleDateString("en-US", { month: "long", year: "numeric" }) };
  }
  m = /^c:(\d{4})-(\d{2})-(\d{2}):(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (m) {
    const since = zonedMidnight(+m[1], +m[2], +m[3], tz);
    // The day after the end date, as a calendar day (so daylight-saving days are 23 or 25 hours, as they should be)
    const next = new Date(Date.UTC(+m[4], +m[5] - 1, +m[6] + 1));
    let until = zonedMidnight(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate(), tz);
    const label = `${fmtD(since)} – ${fmtD(new Date(until.getTime() - 1))}`;
    // Entirely in the future: an empty range (not some other period's numbers)
    if (since >= now) return { since, until: since, text: `${label} (no data yet)` };
    if (until > now) until = now;
    if (until > since) return { since, until, text: label };
  }
  return { since: new Date(now.getTime() - 30 * DAY), until: now, text: "Last 30 days" };
}
const CACHE_MS = 5 * 60_000;

export async function runStat(id: string, p: Params): Promise<Spec> {
  const stat = STATS.find((s) => s.id === id);
  if (!stat) throw new Error("Unknown graphic.");
  const clean: Params = {};
  for (const k of stat.params) if (p[k]) clean[k] = String(p[k]).slice(0, 400);
  const key = `${id}|${JSON.stringify(clean)}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.spec;
  const tz = ZONES.some((z) => z[0] === clean.tz) ? clean.tz! : "America/New_York";
  const r = stat.params.includes("range") ? parseRange(clean.range ?? "30", tz) : { since: null, until: new Date(), text: "" };
  const ctx: Ctx = { p: clean, since: r.since, until: r.until, tz, top: Math.min(25, Math.max(5, Number(clean.top) || 10)), rangeText: r.text, snap: await membersSnapshot() };
  const spec = await rangeEnd.run(r.until, () => stat.run(ctx));
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
  const tz = "America/New_York";
  const yearNow = Number(new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric" }).format(new Date()));
  const firstMsg = await (await bot("message_index")).find({}, { projection: { t: 1 } }).sort({ t: 1 }).limit(1).toArray();
  const firstYear = firstMsg[0]?.t instanceof Date ? (firstMsg[0].t as Date).getUTCFullYear() : yearNow;
  const months: [string, string][] = [];
  for (let i = 0; i < 24; i++) {
    const d = new Date(Date.UTC(yearNow, new Date().getUTCMonth() - i, 15));
    if (d.getUTCFullYear() < firstYear) break;
    months.push([`m${d.toISOString().slice(0, 7)}`, d.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" })]);
  }
  const years: [string, string][] = [];
  for (let y = yearNow; y >= Math.min(firstYear, yearNow); y--) years.push([`y${y}`, y === yearNow ? `${y} (so far)` : String(y)]);
  return {
    ranges: [
      { group: "Recent", items: [...RANGES.filter((x) => x[0] !== "all"), ["180", "Last 6 months"], ["ytd", `${yearNow} so far`], ["all", "All time"]] as [string, string][] },
      { group: "Years", items: years },
      { group: "Months", items: months },
    ],
    channels: busy.map((b) => ({ id: String(b._id), name: ch.get(String(b._id)) ?? "#deleted-channel", messages: n(b.v) })),
    groups: snap.categories.map((g) => ({ key: g.key, title: g.title, adult: g.adult })),
    roles: snap.roles.filter((r) => !r.managed).map((r) => ({ id: r.id, name: r.name })),
    games: Array.from(new Set(["slots", ...(games as string[]).filter(Boolean)])).map((g) => ({ key: g, name: gameName(g) })),
  };
}

export type { Tile };
