// First-party website analytics: one record per page view, kept for about a year.
// No raw IP addresses are stored. Visitors are the random id each browser already keeps for
// the "on the website" counter, hashed before saving. Browsers with Do Not Track / Global Privacy
// Control switched on aren't tracked (the client never sends anything).

import { createHash } from "crypto";
import { type Document } from "mongodb";
import { headers } from "next/headers";
import { getMongoClient, getPresenceCollection } from "./mongodb";
import { parseUserAgent } from "./sessions";
import { userTimeZone } from "./timezone";

const RETENTION_DAYS = 400;
const MAX_DURATION_MS = 30 * 60_000;
const BOT_UA = /bot|crawl|spider|slurp|preview|facebookexternalhit|embedly|discordbot|whatsapp|telegram|headless|lighthouse|pingdom|uptime|monitor|curl|wget|python|axios|node-fetch|go-http/i;

let indexesReady: Promise<unknown> | null = null;

async function viewsCollection() {
  const client = await getMongoClient();
  const col = client.db(process.env.MONGODB_DB ?? "website").collection("page_views");
  indexesReady ??= Promise.all([
    col.createIndex({ ts: 1 }, { expireAfterSeconds: RETENTION_DAYS * 86_400 }),
    col.createIndex({ vid: 1, ts: -1 }),
    col.createIndex({ sid: 1 }),
  ]).catch(() => null);
  await indexesReady;
  return col;
}

const hashId = (id: string) => createHash("sha256").update(`${process.env.AUTH_SECRET ?? ""}:${id}`).digest("hex").slice(0, 24);

/** "/news?tag=Event#abc" -> "/news"; ids in paths become ":id" so pages group together */
function cleanPath(raw: string) {
  let path = raw.split(/[?#]/)[0] || "/";
  if (!path.startsWith("/")) path = `/${path}`;
  path = path.replace(/\/[0-9a-f]{24}(?=\/|$)/gi, "/:id").replace(/\/\d{5,}(?=\/|$)/g, "/:id");
  return path.slice(0, 120).replace(/\/+$/, "") || "/";
}

function referrerHost(ref: unknown, ownHost: string | null) {
  if (typeof ref !== "string" || !ref) return null;
  try {
    const host = new URL(ref).hostname.replace(/^www\./, "").toLowerCase();
    if (!host || (ownHost && host === ownHost.replace(/^www\./, ""))) return null;
    return host.slice(0, 80);
  } catch {
    return null;
  }
}

function widthBucket(w: unknown) {
  const n = typeof w === "number" ? w : Number(w);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n < 480 ? "Phone" : n < 900 ? "Tablet" : n < 1440 ? "Laptop" : "Large screen";
}

export type ViewInput = { path?: unknown; ref?: unknown; vid?: unknown; sid?: unknown; w?: unknown; newVisitor?: unknown; utm?: unknown };

/** Saves a page view. Returns its id (used to add the time spent when the visitor leaves). */
export async function recordView(input: ViewInput, who: { signedIn: boolean; linked: boolean }) {
  const h = await headers();
  const ua = h.get("user-agent") ?? "";
  if (!ua || BOT_UA.test(ua)) return null;
  const vid = typeof input.vid === "string" && /^[A-Za-z0-9-]{16,64}$/.test(input.vid) ? input.vid : null;
  const sid = typeof input.sid === "string" && /^[A-Za-z0-9-]{8,64}$/.test(input.sid) ? input.sid : null;
  if (!vid || !sid || typeof input.path !== "string") return null;
  const path = cleanPath(input.path);
  if (path.startsWith("/api") || path.startsWith("/admin")) return null;

  const decode = (v: string | null) => {
    if (!v) return null;
    try {
      return decodeURIComponent(v);
    } catch {
      return v;
    }
  };
  const col = await viewsCollection();
  const res = await col.insertOne({
    ts: new Date(),
    path,
    vid: hashId(vid),
    sid: hashId(sid),
    ref: referrerHost(input.ref, h.get("host")),
    utm: typeof input.utm === "string" && input.utm ? input.utm.slice(0, 40).toLowerCase() : null,
    country: decode(h.get("x-vercel-ip-country")),
    region: decode(h.get("x-vercel-ip-country-region")),
    device: parseUserAgent(ua),
    screen: widthBucket(input.w),
    newVisitor: input.newVisitor === true,
    signedIn: who.signedIn,
    linked: who.linked,
    durMs: 0,
  });
  return String(res.insertedId);
}

/** Adds the time spent on a page (sent when the tab is hidden or closed). */
export async function recordDuration(id: unknown, vid: unknown, ms: unknown) {
  if (typeof id !== "string" || !/^[0-9a-f]{24}$/.test(id) || typeof vid !== "string" || typeof ms !== "number" || !Number.isFinite(ms)) return;
  const { ObjectId } = await import("mongodb");
  const col = await viewsCollection();
  const dur = Math.max(0, Math.min(MAX_DURATION_MS, Math.round(ms)));
  // Only the visitor who made the view can add to it, and only within the hour
  await col.updateOne({ _id: new ObjectId(id), vid: hashId(vid), ts: { $gte: new Date(Date.now() - 3_600_000) } }, { $max: { durMs: dur } });
}

// ==========================================
// Reports
// ==========================================
export type TrafficRange = "24h" | "7d" | "30d" | "90d" | "365d";
const RANGE_MS: Record<TrafficRange, number> = { "24h": 86_400_000, "7d": 7 * 86_400_000, "30d": 30 * 86_400_000, "90d": 90 * 86_400_000, "365d": 365 * 86_400_000 };

type Totals = { views: number; visitors: number; sessions: number; bounces: number; durationMs: number; newVisitors: number; signedInViews: number };

async function totals(col: Awaited<ReturnType<typeof viewsCollection>>, from: Date, to: Date): Promise<Totals> {
  const [r] = await col
    .aggregate([
      { $match: { ts: { $gte: from, $lt: to } } },
      {
        $facet: {
          views: [{ $count: "n" }],
          visitors: [{ $group: { _id: "$vid" } }, { $count: "n" }],
          newVisitors: [{ $match: { newVisitor: true } }, { $group: { _id: "$vid" } }, { $count: "n" }],
          signedIn: [{ $match: { signedIn: true } }, { $count: "n" }],
          sessions: [
            { $group: { _id: "$sid", views: { $sum: 1 }, dur: { $sum: "$durMs" } } },
            { $group: { _id: null, n: { $sum: 1 }, bounces: { $sum: { $cond: [{ $eq: ["$views", 1] }, 1, 0] } }, dur: { $sum: "$dur" } } },
          ],
        },
      },
    ])
    .toArray();
  const s = r?.sessions?.[0];
  return {
    views: r?.views?.[0]?.n ?? 0,
    visitors: r?.visitors?.[0]?.n ?? 0,
    sessions: s?.n ?? 0,
    bounces: s?.bounces ?? 0,
    durationMs: s?.dur ?? 0,
    newVisitors: r?.newVisitors?.[0]?.n ?? 0,
    signedInViews: r?.signedIn?.[0]?.n ?? 0,
  };
}

const top = (field: string, limit = 10, extra: Document[] = []) => [
  ...extra,
  { $group: { _id: `$${field}`, views: { $sum: 1 }, visitors: { $addToSet: "$vid" } } },
  { $project: { views: 1, visitors: { $size: "$visitors" } } },
  { $sort: { views: -1 } },
  { $limit: limit },
];

const rows = (docs: Document[] | undefined, fallback = "Unknown") =>
  (docs ?? []).map((d) => ({ key: d._id === null || d._id === undefined || d._id === "" ? fallback : String(d._id), views: d.views as number, visitors: d.visitors as number }));

export async function trafficReport(range: TrafficRange) {
  const tz = await userTimeZone();
  const span = RANGE_MS[range] ?? RANGE_MS["7d"];
  const to = new Date();
  const from = new Date(to.getTime() - span);
  const prevFrom = new Date(from.getTime() - span);
  const unit = range === "24h" ? "hour" : range === "365d" ? "week" : "day";
  const col = await viewsCollection();

  const [now, before, [r], presence, liveViews] = await Promise.all([
    totals(col, from, to),
    totals(col, prevFrom, from),
    col
      .aggregate([
        { $match: { ts: { $gte: from, $lt: to } } },
        {
          $facet: {
            timeline: [
              { $group: { _id: { $dateTrunc: { date: "$ts", unit, timezone: tz } }, views: { $sum: 1 }, visitors: { $addToSet: "$vid" } } },
              { $project: { views: 1, visitors: { $size: "$visitors" } } },
              { $sort: { _id: 1 } },
            ],
            pages: [
              { $group: { _id: "$path", views: { $sum: 1 }, visitors: { $addToSet: "$vid" }, dur: { $avg: { $cond: [{ $gt: ["$durMs", 0] }, "$durMs", null] } } } },
              { $project: { views: 1, visitors: { $size: "$visitors" }, dur: 1 } },
              { $sort: { views: -1 } },
              { $limit: 15 },
            ],
            entries: [{ $sort: { ts: 1 } }, { $group: { _id: "$sid", path: { $first: "$path" } } }, { $group: { _id: "$path", n: { $sum: 1 } } }, { $sort: { n: -1 } }, { $limit: 8 }],
            referrers: top("ref", 12),
            utm: top("utm", 8, [{ $match: { utm: { $ne: null } } }]),
            countries: top("country", 12),
            devices: top("device.type", 5),
            browsers: top("device.browser", 8),
            os: top("device.os", 8),
            screens: top("screen", 5, [{ $match: { screen: { $ne: null } } }]),
            hours: [{ $group: { _id: { $hour: { date: "$ts", timezone: tz } }, n: { $sum: 1 }, v: { $addToSet: "$vid" } } }, { $project: { n: 1, v: { $size: "$v" } } }],
            weekdays: [{ $group: { _id: { $dayOfWeek: { date: "$ts", timezone: tz } }, n: { $sum: 1 }, v: { $addToSet: "$vid" } } }, { $project: { n: 1, v: { $size: "$v" } } }],
            heat: [
              { $group: { _id: { d: { $dayOfWeek: { date: "$ts", timezone: tz } }, h: { $hour: { date: "$ts", timezone: tz } } }, n: { $sum: 1 }, v: { $addToSet: "$vid" } } },
              { $project: { n: 1, v: { $size: "$v" } } },
            ],
            audience: [{ $group: { _id: { $cond: ["$linked", "Discord linked", { $cond: ["$signedIn", "Signed in", "Guest"] }] }, views: { $sum: 1 }, visitors: { $addToSet: "$vid" } } }, { $project: { views: 1, visitors: { $size: "$visitors" } } }],
          },
        },
      ])
      .toArray(),
    getPresenceCollection().then((p) => p.countDocuments({ lastSeen: { $gte: new Date(Date.now() - 75_000) } })).catch(() => null),
    col
      .aggregate([{ $match: { ts: { $gte: new Date(Date.now() - 5 * 60_000) } } }, { $group: { _id: "$path", n: { $sum: 1 } } }, { $sort: { n: -1 } }, { $limit: 6 }])
      .toArray(),
  ]);

  return {
    range,
    unit,
    from: from.toISOString(),
    to: to.toISOString(),
    totals: now,
    previous: before,
    live: { onSite: presence, pages: liveViews.map((d) => ({ path: String(d._id), views: d.n as number })) },
    timeline: ((r?.timeline ?? []) as Document[]).map((d) => ({ bucket: (d._id as Date).toISOString(), views: d.views as number, visitors: d.visitors as number })),
    pages: ((r?.pages ?? []) as Document[]).map((d) => ({ key: String(d._id), views: d.views as number, visitors: d.visitors as number, avgMs: d.dur ? Math.round(d.dur as number) : null })),
    entries: ((r?.entries ?? []) as Document[]).map((d) => ({ key: String(d._id), views: d.n as number, visitors: 0 })),
    referrers: rows(r?.referrers, "Direct / none"),
    utm: rows(r?.utm),
    countries: rows(r?.countries),
    devices: rows(r?.devices),
    browsers: rows(r?.browsers),
    os: rows(r?.os),
    screens: rows(r?.screens),
    audience: rows(r?.audience),
    hours: Array.from({ length: 24 }, (_, h) => ((r?.hours ?? []) as Document[]).find((d) => d._id === h)?.n ?? 0) as number[],
    hourVisitors: Array.from({ length: 24 }, (_, h) => ((r?.hours ?? []) as Document[]).find((d) => d._id === h)?.v ?? 0) as number[],
    // Mongo's $dayOfWeek: 1 = Sunday
    weekdays: Array.from({ length: 7 }, (_, i) => ((r?.weekdays ?? []) as Document[]).find((d) => d._id === i + 1)?.n ?? 0) as number[],
    weekdayVisitors: Array.from({ length: 7 }, (_, i) => ((r?.weekdays ?? []) as Document[]).find((d) => d._id === i + 1)?.v ?? 0) as number[],
    // [day (0 = Sunday)][hour]: views and visitors
    heat: (() => {
      const views = Array.from({ length: 7 }, () => Array(24).fill(0) as number[]);
      const visitors = Array.from({ length: 7 }, () => Array(24).fill(0) as number[]);
      for (const d of (r?.heat ?? []) as Document[]) {
        const day = (d._id as { d: number; h: number }).d - 1;
        const hour = (d._id as { d: number; h: number }).h;
        if (day >= 0 && day < 7 && hour >= 0 && hour < 24) {
          views[day][hour] = d.n as number;
          visitors[day][hour] = d.v as number;
        }
      }
      return { views, visitors };
    })(),
    site: await siteStats(from, to, prevFrom, unit),
  };
}

/** Account and engagement numbers from the rest of the site, for the same range. */
async function siteStats(from: Date, to: Date, prevFrom: Date, unit: "hour" | "day" | "week") {
  const tz = await userTimeZone();
  const client = await getMongoClient();
  const db = client.db(process.env.MONGODB_DB ?? "website");
  const users = db.collection("users");
  const sessions = db.collection("sessions");
  const inRange = { $gte: from, $lt: to };
  const [total, verified, linked, signups, prevSignups, links, logins, prevLogins, activeAccounts, signupTimeline, news] = await Promise.all([
    users.countDocuments({}),
    users.countDocuments({ emailVerified: true }),
    users.countDocuments({ discordId: { $nin: [null, ""] } }),
    users.countDocuments({ createdAt: inRange }),
    users.countDocuments({ createdAt: { $gte: prevFrom, $lt: from } }),
    users.countDocuments({ "discord.linkedAt": inRange }),
    sessions.countDocuments({ createdAt: inRange }),
    sessions.countDocuments({ createdAt: { $gte: prevFrom, $lt: from } }),
    sessions.distinct("userId", { lastSeenAt: inRange }).then((ids) => ids.length),
    users
      .aggregate([{ $match: { createdAt: inRange } }, { $group: { _id: { $dateTrunc: { date: "$createdAt", unit, timezone: tz } }, n: { $sum: 1 } } }, { $sort: { _id: 1 } }])
      .toArray(),
    db.collection("news").countDocuments({ published: { $ne: false } }),
  ]);
  return {
    accounts: total,
    verified,
    linked,
    signups,
    prevSignups,
    discordLinks: links,
    logins,
    prevLogins,
    activeAccounts,
    publishedNews: news,
    signupTimeline: signupTimeline.map((d) => ({ bucket: (d._id as Date).toISOString(), count: d.n as number })),
  };
}

/**
 * Details for one slot of the "When people visit" chart: an hour of the day, a day of the week
 * (0 = Sunday), or both, within the report range. Times are in the viewer's time zone.
 */
export async function trafficSlot(range: TrafficRange, slot: { hour?: number; weekday?: number }) {
  const tz = await userTimeZone();
  const span = RANGE_MS[range] ?? RANGE_MS["7d"];
  const to = new Date();
  const from = new Date(to.getTime() - span);
  const conds: Document[] = [];
  if (slot.hour !== undefined) conds.push({ $eq: [{ $hour: { date: "$ts", timezone: tz } }, slot.hour] });
  if (slot.weekday !== undefined) conds.push({ $eq: [{ $dayOfWeek: { date: "$ts", timezone: tz } }, slot.weekday + 1] });
  const col = await viewsCollection();
  const [r] = await col
    .aggregate([
      { $match: { ts: { $gte: from, $lt: to }, ...(conds.length ? { $expr: { $and: conds } } : {}) } },
      {
        $facet: {
          totals: [
            {
              $group: {
                _id: null,
                views: { $sum: 1 },
                visitors: { $addToSet: "$vid" },
                sessions: { $addToSet: "$sid" },
                dur: { $avg: { $cond: [{ $gt: ["$durMs", 0] }, "$durMs", null] } },
                newViews: { $sum: { $cond: ["$newVisitor", 1, 0] } },
              },
            },
            { $project: { views: 1, visitors: { $size: "$visitors" }, sessions: { $size: "$sessions" }, dur: 1, newViews: 1 } },
          ],
          pages: top("path", 6),
          referrers: top("ref", 5),
          countries: top("country", 5),
          devices: top("device.type", 4),
          audience: [{ $group: { _id: { $cond: ["$linked", "Discord linked", { $cond: ["$signedIn", "Signed in", "Guest"] }] }, views: { $sum: 1 }, visitors: { $addToSet: "$vid" } } }, { $project: { views: 1, visitors: { $size: "$visitors" } } }],
          // How this slot did on each calendar day of the range
          byDate: [
            { $group: { _id: { $dateToString: { date: "$ts", format: "%Y-%m-%d", timezone: tz } }, views: { $sum: 1 } } },
            { $sort: { _id: 1 } },
          ],
        },
      },
    ])
    .toArray();
  const t = ((r?.totals ?? []) as Document[])[0];
  return {
    range,
    slot,
    views: (t?.views as number) ?? 0,
    visitors: (t?.visitors as number) ?? 0,
    visits: (t?.sessions as number) ?? 0,
    avgMs: t?.dur ? Math.round(t.dur as number) : null,
    newViews: (t?.newViews as number) ?? 0,
    pages: rows(r?.pages),
    referrers: rows(r?.referrers, "Direct / none"),
    countries: rows(r?.countries),
    devices: rows(r?.devices),
    audience: rows(r?.audience),
    byDate: ((r?.byDate ?? []) as Document[]).map((d) => ({ date: String(d._id), views: d.views as number })),
  };
}
