// status.kittykingdom.net: is everything working, 90 days of uptime, and incidents.
//   Live:     the bots' heartbeats (zeo_bot.bot_settings, about once a minute), a database ping, Discord's
//             own status page (discordstatus.com)
//   History:  zeo_bot.status_days, one doc per part per day with the minutes it was up/down, written by
//             each bot's events/status_ping.py (the Main Bot also checks the website and its database)
//   Incidents: website.status_incidents, posted by admins in Admin → Overview → Status

import { ObjectId, type Document } from "mongodb";
import { getBotCollection, getMongoClient } from "./mongodb";

export type PartKey = "website" | "database" | "main" | "economy" | "moderation" | "ticketing" | "discord";
export type Health = "up" | "degraded" | "down" | "unknown";

export const PARTS: { key: PartKey; name: string; about: string; group: string }[] = [
  { key: "website", name: "Website", about: "kittykingdom.net, accounts and logins", group: "Website" },
  { key: "database", name: "Database", about: "Accounts, store, levels and everything saved", group: "Website" },
  { key: "main", name: "Zeo (Main Bot)", about: "Store, giveaways, server logs, roles, Patreon", group: "Discord bots" },
  { key: "economy", name: "Economy Bot", about: "Leveling, daily rewards, games and events", group: "Discord bots" },
  { key: "moderation", name: "Moderation Bot", about: "AutoMod, join forms, punishments, cleanup", group: "Discord bots" },
  { key: "ticketing", name: "Ticket Bot", about: "Support tickets and transcripts", group: "Discord bots" },
  { key: "discord", name: "Discord", about: "Discord itself (from discordstatus.com)", group: "Discord" },
];
const BOTS: PartKey[] = ["main", "economy", "moderation", "ticketing"];
const HISTORY_DAYS = 90;

export type IncidentStatus = "investigating" | "identified" | "monitoring" | "resolved" | "scheduled";
export type Incident = {
  id: string;
  title: string;
  impact: "minor" | "major" | "maintenance";
  status: IncidentStatus;
  parts: PartKey[];
  updates: { at: string; status: IncidentStatus; text: string }[];
  startedAt: string;
  resolvedAt: string | null;
  scheduledFor: string | null;
  scheduledUntil: string | null;
};

export type DayBar = { day: string; uptime: number | null; downMinutes: number; incidents: string[] };
export type PartStatus = { key: PartKey; name: string; about: string; group: string; health: Health; detail: string; uptime90: number | null; days: DayBar[]; ms: number | null };
export type StatusView = { updatedAt: string; overall: Health; parts: PartStatus[]; active: Incident[]; scheduled: Incident[]; past: Incident[] };

export class StatusError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : typeof v === "string" ? v : null);

async function incidentsCol() {
  const client = await getMongoClient();
  return client.db(process.env.MONGODB_DB ?? "website").collection("status_incidents");
}

function toIncident(d: Document): Incident {
  return {
    id: String(d._id),
    title: String(d.title ?? ""),
    impact: d.impact === "major" || d.impact === "maintenance" ? d.impact : "minor",
    status: d.status ?? "investigating",
    parts: (d.parts ?? []) as PartKey[],
    updates: ((d.updates ?? []) as Document[]).map((u) => ({ at: iso(u.at) ?? "", status: u.status, text: String(u.text ?? "") })).reverse(),
    startedAt: iso(d.startedAt) ?? "",
    resolvedAt: iso(d.resolvedAt),
    scheduledFor: iso(d.scheduledFor),
    scheduledUntil: iso(d.scheduledUntil),
  };
}

// ---------------------------------------------------------------- live checks
/** Times a tiny database round trip. */
export async function pingDatabase(): Promise<{ ok: boolean; ms: number | null }> {
  const started = Date.now();
  try {
    const client = await getMongoClient();
    await Promise.race([client.db("admin").command({ ping: 1 }), new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 4000))]);
    return { ok: true, ms: Date.now() - started };
  } catch {
    return { ok: false, ms: null };
  }
}

let discordCache: { at: number; health: Health; detail: string } | null = null;
async function discordHealth(): Promise<{ health: Health; detail: string }> {
  if (discordCache && Date.now() - discordCache.at < 60_000) return discordCache;
  try {
    const r = await fetch("https://discordstatus.com/api/v2/status.json", { cache: "no-store", signal: AbortSignal.timeout(4000) });
    const body = (await r.json()) as { status?: { indicator?: string; description?: string } };
    const ind = body.status?.indicator ?? "unknown";
    const health: Health = ind === "none" ? "up" : ind === "minor" || ind === "maintenance" ? "degraded" : ind === "major" || ind === "critical" ? "down" : "unknown";
    discordCache = { at: Date.now(), health, detail: body.status?.description ?? "Unknown" };
  } catch {
    discordCache = { at: Date.now(), health: "unknown", detail: "Couldn't reach discordstatus.com" };
  }
  return discordCache;
}

function since(ms: number) {
  const m = Math.round(ms / 60_000);
  return m < 60 ? `${m} min` : m < 1440 ? `${Math.round(m / 60)} h` : `${Math.round(m / 1440)} d`;
}

// ---------------------------------------------------------------- the whole picture
let viewCache: { at: number; view: StatusView } | null = null;

export async function getStatus(): Promise<StatusView> {
  if (viewCache && Date.now() - viewCache.at < 20_000) return viewCache.view;
  const now = new Date();
  const days = Array.from({ length: HISTORY_DAYS }, (_, i) => new Date(now.getTime() - (HISTORY_DAYS - 1 - i) * 86_400_000).toISOString().slice(0, 10));
  const today = days[days.length - 1];
  const minuteNow = now.getUTCHours() * 60 + now.getUTCMinutes() + 1;

  const db = await pingDatabase();
  const [beats, history, incidents, discord] = await Promise.all([
    db.ok ? getBotCollection("bot_settings").then((c) => c.find({ _id: { $in: BOTS as never[] } }, { projection: { heartbeatAt: 1, latencyMs: 1 } }).toArray()).catch(() => []) : Promise.resolve([] as Document[]),
    db.ok ? getBotCollection("status_days").then((c) => c.find({ day: { $gte: days[0] } }, { projection: { ms: 0 } }).toArray()).catch(() => []) : Promise.resolve([] as Document[]),
    db.ok ? incidentsCol().then((c) => c.find({ $or: [{ resolvedAt: null }, { resolvedAt: { $gte: new Date(now.getTime() - HISTORY_DAYS * 86_400_000) } }] }).sort({ startedAt: -1 }).limit(200).toArray()).catch(() => []) : Promise.resolve([] as Document[]),
    discordHealth(),
  ]);
  const allIncidents = incidents.map(toIncident);
  const byPartDay = new Map<string, Document>(history.map((d) => [`${d.part}:${d.day}`, d]));
  const firstDay = new Map<string, string>();
  for (const d of history) if (!firstDay.has(d.part) || d.day < firstDay.get(d.part)!) firstDay.set(d.part, d.day);

  const parts: PartStatus[] = PARTS.map((p) => {
    let health: Health = "unknown";
    let detail = "No data yet";
    let ms: number | null = null;
    if (p.key === "website") {
      health = "up"; // this page loaded
      detail = "Operational";
    } else if (p.key === "database") {
      health = db.ok ? (db.ms! > 1500 ? "degraded" : "up") : "down";
      detail = db.ok ? (db.ms! > 1500 ? "Slow responses" : "Operational") : "Not reachable";
      ms = db.ms;
    } else if (p.key === "discord") {
      health = discord.health;
      detail = discord.detail;
    } else {
      const beat = beats.find((b) => b._id === p.key);
      const at = beat?.heartbeatAt instanceof Date ? beat.heartbeatAt.getTime() : null;
      ms = typeof beat?.latencyMs === "number" ? beat.latencyMs : null;
      if (!db.ok) {
        health = "unknown";
        detail = "Can't check while the database is down";
      } else if (at === null) {
        health = "unknown";
      } else {
        const age = Date.now() - at;
        health = age < 3 * 60_000 ? "up" : age < 10 * 60_000 ? "degraded" : "down";
        detail = health === "up" ? "Operational" : health === "degraded" ? `Last seen ${since(age)} ago` : `Offline for ${since(age)}`;
      }
    }
    // Admin-posted incidents override the automatic state for their parts
    const open = allIncidents.find((i) => !i.resolvedAt && i.status !== "scheduled" && i.parts.includes(p.key));
    if (open) {
      const sev: Health = open.impact === "major" ? "down" : "degraded";
      if (health === "up" || health === "unknown" || (sev === "down" && health === "degraded")) health = sev;
      detail = open.impact === "maintenance" ? "Under maintenance" : open.title;
    }

    const first = firstDay.get(p.key);
    const bars: DayBar[] = days.map((day) => {
      const doc = byPartDay.get(`${p.key}:${day}`);
      const dayIncidents = allIncidents.filter((i) => i.parts.includes(p.key) && i.status !== "scheduled" && i.startedAt.slice(0, 10) <= day && (i.resolvedAt ?? now.toISOString()).slice(0, 10) >= day).map((i) => i.title);
      if (p.key === "discord" || !first || day < first) return { day, uptime: null, downMinutes: 0, incidents: dayIncidents };
      const up = new Set<number>((doc?.up ?? []) as number[]);
      const down = new Set<number>((doc?.down ?? []) as number[]);
      if (p.key === "website" || p.key === "database") {
        // Checked by the Main Bot: only the minutes it checked count
        const checked = up.size + down.size;
        return { day, uptime: checked ? up.size / checked : null, downMinutes: down.size, incidents: dayIncidents };
      }
      // A bot is up for every minute it checked in; the first day counts from its first check-in
      const firstMinute = day === first && up.size ? Math.min(...Array.from(up)) : 0;
      const expected = (day === today ? minuteNow : 1440) - firstMinute;
      const uptime = expected > 0 ? Math.min(1, up.size / expected) : null;
      return { day, uptime, downMinutes: Math.max(0, expected - up.size), incidents: dayIncidents };
    });
    const counted = bars.filter((b) => b.uptime !== null);
    const uptime90 = counted.length ? counted.reduce((n, b) => n + (b.uptime ?? 0), 0) / counted.length : null;
    return { ...p, health, detail, uptime90, days: bars, ms };
  });

  const own = parts.filter((p) => p.key !== "discord");
  const overall = own.some((p) => p.health === "down") ? "down" : own.some((p) => p.health === "degraded") ? "degraded" : "up";
  const view: StatusView = {
    updatedAt: now.toISOString(),
    overall,
    parts,
    active: allIncidents.filter((i) => !i.resolvedAt && i.status !== "scheduled"),
    scheduled: allIncidents.filter((i) => i.status === "scheduled" && !i.resolvedAt),
    past: allIncidents.filter((i) => i.resolvedAt).slice(0, 30),
  };
  viewCache = { at: Date.now(), view };
  return view;
}

// ---------------------------------------------------------------- admin: incidents
const STATUSES: IncidentStatus[] = ["investigating", "identified", "monitoring", "resolved", "scheduled"];
const partKeys = new Set(PARTS.map((p) => p.key));

function cleanParts(v: unknown): PartKey[] {
  const parts = Array.isArray(v) ? Array.from(new Set(v.map(String))).filter((k) => partKeys.has(k as PartKey)) : [];
  if (!parts.length) throw new StatusError("Pick what's affected.");
  return parts as PartKey[];
}
function cleanText(v: unknown, label: string, max: number) {
  const s = String(v ?? "").trim();
  if (!s) throw new StatusError(`${label} can't be empty.`);
  if (s.length > max) throw new StatusError(`${label} must be ${max} characters or fewer.`);
  return s;
}
function cleanDate(v: unknown, label: string) {
  if (!v) return null;
  const d = new Date(String(v));
  if (Number.isNaN(d.getTime())) throw new StatusError(`${label} isn't a valid date.`);
  return d;
}

export async function listIncidents() {
  const docs = await (await incidentsCol()).find({}).sort({ startedAt: -1 }).limit(100).toArray();
  return docs.map(toIncident);
}

export async function createIncident(raw: Record<string, unknown>, by: string) {
  const scheduled = raw.status === "scheduled";
  const status = (STATUSES.includes(raw.status as IncidentStatus) ? raw.status : "investigating") as IncidentStatus;
  const impact = raw.impact === "major" || raw.impact === "maintenance" ? raw.impact : scheduled ? "maintenance" : "minor";
  const scheduledFor = cleanDate(raw.scheduledFor, "The start");
  const scheduledUntil = cleanDate(raw.scheduledUntil, "The end");
  if (scheduled && !scheduledFor) throw new StatusError("Say when the maintenance starts.");
  const now = new Date();
  const res = await (await incidentsCol()).insertOne({
    title: cleanText(raw.title, "The title", 120),
    impact,
    status,
    parts: cleanParts(raw.parts),
    updates: [{ at: now, status, text: cleanText(raw.text, "The message", 2000), by }],
    startedAt: scheduled ? scheduledFor : now,
    resolvedAt: status === "resolved" ? now : null,
    scheduledFor,
    scheduledUntil,
    createdBy: by,
  });
  viewCache = null;
  return { id: String(res.insertedId) };
}

/** Posts an update (a new status and a message); "resolved" closes the incident, "investigating" on a scheduled one starts it. */
export async function updateIncident(id: string, raw: Record<string, unknown>, by: string) {
  if (!ObjectId.isValid(id)) throw new StatusError("Unknown incident.", 404);
  const col = await incidentsCol();
  const doc = await col.findOne({ _id: new ObjectId(id) });
  if (!doc) throw new StatusError("Unknown incident.", 404);
  const status = (STATUSES.includes(raw.status as IncidentStatus) ? raw.status : doc.status) as IncidentStatus;
  const now = new Date();
  const set: Document = { status };
  if (status === "resolved") set.resolvedAt = now;
  else if (doc.resolvedAt) set.resolvedAt = null;
  if (doc.status === "scheduled" && status !== "scheduled" && status !== "resolved") set.startedAt = now;
  if (raw.parts) set.parts = cleanParts(raw.parts);
  if (raw.title) set.title = cleanText(raw.title, "The title", 120);
  await col.updateOne({ _id: doc._id }, { $set: set, $push: { updates: { at: now, status, text: cleanText(raw.text, "The message", 2000), by } } as Document });
  viewCache = null;
}

export async function deleteIncident(id: string) {
  if (!ObjectId.isValid(id)) throw new StatusError("Unknown incident.", 404);
  await (await incidentsCol()).deleteOne({ _id: new ObjectId(id) });
  viewCache = null;
}
