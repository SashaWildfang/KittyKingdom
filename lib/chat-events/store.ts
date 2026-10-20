// Admin → Members → Chat Events (server side). See types.ts for what an event is.
//
// zeo_bot.chat_events          {_id: "config", settings: {changed only}, events: {id: whole event}, version, updatedAt, updatedBy,
//                               botSeenAt, appliedVersion, liveSeason (written by the bot)}
// zeo_bot.chat_event_requests  "Run now" {eventId, channelId, ping, by, byName, status, error, createdAt}
// zeo_bot.chat_event_runs      what ran (written by the bot)

import { randomUUID } from "crypto";
import type { PanelUser } from "../admin";
import { logExternalChanges } from "../bot-settings/store";
import { getBotCollection } from "../mongodb";
import { getSeason } from "../season-store";
import { BUILT_IN, CATALOG, ChatEventError, EVENT_TYPES, blankEvent, cleanEvent, cleanSettings, type ChatEvent, type ChatEventSettings, type EventSeason, type EventType } from "./types";

type ConfigDoc = {
  _id: string;
  settings?: Partial<ChatEventSettings>;
  events?: Record<string, ChatEvent>;
  version?: number;
  updatedAt?: Date;
  updatedBy?: string;
  botSeenAt?: Date;
  appliedVersion?: number;
  liveSeason?: string;
};

const iso = (d: unknown) => (d instanceof Date ? d.toISOString() : null);

async function config() {
  const col = await getBotCollection("chat_events");
  return { col, doc: ((await col.findOne({ _id: "config" } as never)) ?? { _id: "config" }) as ConfigDoc };
}

export type ChatEventRow = ChatEvent & { builtIn: boolean; changed: boolean };

export type RunRow = {
  id: string;
  eventId: string;
  name: string;
  type: string;
  channelId: string;
  channelName: string | null;
  trigger: string;
  startedAt: string | null;
  players: number;
  totalLeaves: number;
  totalXp: number;
  results: { id: string; name: string; leaves: number; xp: number; text?: string }[];
};

export type ChatEventsView = {
  settings: ChatEventSettings;
  defaults: ChatEventSettings;
  changedSettings: string[];
  events: ChatEventRow[];
  version: number;
  appliedVersion: number | null;
  botSeenAt: string | null;
  season: { key: string; name: string; one: string; many: string };
  runs: RunRow[];
  stats: Record<string, { runs: number; players: number; leaves: number; xp: number; last: string | null }>;
  totals: { runs: number; players: number; leaves: number; xp: number; people: number };
  requests: { id: string; eventId: string; status: string; error: string | null; at: string | null }[];
};

export function mergedEvents(doc: ConfigDoc): ChatEventRow[] {
  const saved = doc.events ?? {};
  const rows: ChatEventRow[] = CATALOG.events.map((e) => ({ ...e, ...(saved[e.id] ?? {}), id: e.id, builtIn: true, changed: Boolean(saved[e.id]) }));
  for (const [id, e] of Object.entries(saved)) if (!BUILT_IN.has(id) && e?.custom) rows.push({ ...e, id, builtIn: false, changed: true });
  return rows;
}

export async function getChatEvents(): Promise<ChatEventsView> {
  const { doc } = await config();
  const [season, runsCol, reqCol] = await Promise.all([getSeason(), getBotCollection("chat_event_runs"), getBotCollection("chat_event_requests")]);
  const since = new Date(Date.now() - 30 * 86_400_000);
  const [runs, grouped, totals, people, requests] = await Promise.all([
    runsCol.find({}).sort({ startedAt: -1 }).limit(40).toArray(),
    runsCol.aggregate([{ $match: { startedAt: { $gte: since } } }, { $group: { _id: "$eventId", runs: { $sum: 1 }, players: { $sum: "$players" }, leaves: { $sum: "$totalLeaves" }, xp: { $sum: "$totalXp" }, last: { $max: "$startedAt" } } }]).toArray(),
    runsCol.aggregate([{ $match: { startedAt: { $gte: since } } }, { $group: { _id: null, runs: { $sum: 1 }, players: { $sum: "$players" }, leaves: { $sum: "$totalLeaves" }, xp: { $sum: "$totalXp" } } }]).toArray(),
    runsCol.aggregate([{ $match: { startedAt: { $gte: since } } }, { $unwind: "$results" }, { $group: { _id: "$results.id" } }, { $count: "n" }]).toArray(),
    reqCol.find({ createdAt: { $gte: new Date(Date.now() - 10 * 60_000) } }).sort({ createdAt: -1 }).limit(10).toArray(),
  ]);
  const settings = { ...CATALOG.settings, ...(doc.settings ?? {}) } as ChatEventSettings;
  const t = totals[0] ?? {};
  return {
    settings,
    defaults: CATALOG.settings,
    changedSettings: Object.keys(doc.settings ?? {}),
    events: mergedEvents(doc),
    version: doc.version ?? 0,
    appliedVersion: typeof doc.appliedVersion === "number" ? doc.appliedVersion : null,
    botSeenAt: iso(doc.botSeenAt),
    season: { key: season.key, name: season.name, one: season.one, many: season.many },
    runs: runs.map((r) => ({
      id: String(r._id),
      eventId: String(r.eventId ?? ""),
      name: String(r.name ?? r.eventId ?? "Event"),
      type: String(r.type ?? ""),
      channelId: String(r.channelId ?? ""),
      channelName: r.channelName ? String(r.channelName) : null,
      trigger: String(r.trigger ?? "auto"),
      startedAt: iso(r.startedAt),
      players: Number(r.players ?? 0),
      totalLeaves: Number(r.totalLeaves ?? 0),
      totalXp: Number(r.totalXp ?? 0),
      results: ((r.results as RunRow["results"]) ?? []).slice(0, 50),
    })),
    stats: Object.fromEntries(grouped.map((g) => [String(g._id), { runs: g.runs, players: g.players, leaves: g.leaves, xp: g.xp, last: iso(g.last) }])),
    totals: { runs: Number(t.runs ?? 0), players: Number(t.players ?? 0), leaves: Number(t.leaves ?? 0), xp: Number(t.xp ?? 0), people: Number(people[0]?.n ?? 0) },
    requests: requests.map((r) => ({ id: String(r._id), eventId: String(r.eventId ?? ""), status: String(r.status ?? "pending"), error: r.error ? String(r.error) : null, at: iso(r.createdAt) })),
  };
}

async function bump(col: Awaited<ReturnType<typeof config>>["col"], update: Record<string, unknown>, admin: PanelUser) {
  await col.updateOne({ _id: "config" } as never, { ...update, $inc: { version: 1 }, $set: { ...((update.$set as object) ?? {}), updatedAt: new Date(), updatedBy: admin.name } } as never, { upsert: true });
}

export async function saveChatEventSettings(raw: Partial<ChatEventSettings>, admin: PanelUser) {
  const clean = cleanSettings(raw);
  const { col, doc } = await config();
  const set: Record<string, unknown> = {};
  const unset: Record<string, ""> = {};
  const log: { key: string; label: string; section: string; old: unknown; new: unknown }[] = [];
  for (const [k, v] of Object.entries(clean)) {
    const def = (CATALOG.settings as Record<string, unknown>)[k];
    const old = (doc.settings as Record<string, unknown> | undefined)?.[k] ?? def;
    if (JSON.stringify(old) === JSON.stringify(v)) continue;
    if (JSON.stringify(def) === JSON.stringify(v)) unset[`settings.${k}`] = "";
    else set[`settings.${k}`] = v;
    log.push({ key: `chatEvents.${k}`, label: `Chat events: ${k}`, section: "Chat events", old, new: v });
  }
  if (!log.length) return { changed: 0 };
  await bump(col, { ...(Object.keys(set).length ? { $set: set } : {}), ...(Object.keys(unset).length ? { $unset: unset } : {}) }, admin);
  await logExternalChanges("economy", log, admin).catch(() => undefined);
  return { changed: log.length };
}

export async function saveChatEvent(id: string, raw: Partial<ChatEvent>, admin: PanelUser) {
  const { col, doc } = await config();
  const current = mergedEvents(doc).find((e) => e.id === id);
  if (!current) throw new ChatEventError("That event doesn't exist.", 404);
  const { builtIn: _b, changed: _c, ...base } = current;
  const clean = cleanEvent({ ...raw, type: base.type }, base);
  await bump(col, { $set: { [`events.${id}`]: clean } }, admin);
  await logExternalChanges("economy", [{ key: `chatEvents.event.${id}`, label: `Chat event: ${clean.name}`, section: "Chat events", old: summary(base), new: summary(clean) }], admin).catch(() => undefined);
  return clean;
}

const summary = (e: ChatEvent) => `${e.enabled ? "on" : "off"} · chance ${e.weight} · ${e.seconds}s`;

export async function createChatEvent(type: EventType, season: EventSeason, admin: PanelUser) {
  if (!(type in EVENT_TYPES)) throw new ChatEventError("Pick a kind of event.");
  const { col } = await config();
  const id = `custom-${randomUUID().slice(0, 8)}`;
  const e = cleanEvent(blankEvent(type, season, id), blankEvent(type, season, id));
  await bump(col, { $set: { [`events.${id}`]: e } }, admin);
  await logExternalChanges("economy", [{ key: `chatEvents.event.${id}`, label: `Chat event: ${e.name}`, section: "Chat events", old: null, new: "created" }], admin).catch(() => undefined);
  return e;
}

/** Built-in: back to how it ships. Custom: deleted. */
export async function resetChatEvent(id: string, admin: PanelUser) {
  const { col, doc } = await config();
  if (!doc.events?.[id]) return { reset: false };
  await bump(col, { $unset: { [`events.${id}`]: "" } }, admin);
  await logExternalChanges("economy", [{ key: `chatEvents.event.${id}`, label: `Chat event: ${doc.events[id].name}`, section: "Chat events", old: "changed", new: BUILT_IN.has(id) ? "reset" : "deleted" }], admin).catch(() => undefined);
  return { reset: true, deleted: !BUILT_IN.has(id) };
}

export async function requestRun(eventId: string, channelId: string, ping: boolean, admin: PanelUser) {
  if (!/^\d{15,21}$/.test(channelId)) throw new ChatEventError("Pick a channel.");
  if (eventId !== "random") {
    const { doc } = await config();
    if (!mergedEvents(doc).some((e) => e.id === eventId)) throw new ChatEventError("That event doesn't exist.", 404);
  }
  const col = await getBotCollection("chat_event_requests");
  const recent = await col.countDocuments({ by: admin.discordId, createdAt: { $gte: new Date(Date.now() - 60_000) } });
  if (recent >= 5) throw new ChatEventError("Slow down a little: five a minute at most.", 429);
  const res = await col.insertOne({ eventId, channelId, ping: Boolean(ping), by: admin.discordId, byName: admin.name, status: "pending", error: null, createdAt: new Date() });
  return { id: String(res.insertedId) };
}
