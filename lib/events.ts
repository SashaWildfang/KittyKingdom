// Events: staff plan them in Admin → Events, members see them on /events (and the homepage) and can ask
// for a reminder. The Main Bot (events/server_events.py) DMs reminders, announces events when they start
// and mirrors them into Discord's own Events tab.
//   zeo_bot.events         one per event (the bot sets discordEventId / remindedAt / announcedAt)
//   zeo_bot.event_rsvps    {eventId, discordId, at}, one per member who asked to be reminded

import { ObjectId, type Document } from "mongodb";
import { getBotCollection } from "./mongodb";
import { guildPickers } from "./bot-settings/guild";

export class EventError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

export { EVENT_KINDS } from "./events-shared";
export type { EventKind, ServerEvent, PublicEvent } from "./events-shared";
import { EVENT_KINDS, type EventKind, type ServerEvent } from "./events-shared";

export type EventInput = Omit<ServerEvent, "id" | "going" | "createdBy" | "cancelled" | "hostName"> & { hostName?: string | null };

const ID = /^\d{15,21}$/;
const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : typeof v === "string" ? v : null);

async function eventsCol() {
  return getBotCollection("events");
}
async function rsvpsCol() {
  const c = await getBotCollection("event_rsvps");
  await c.createIndex({ eventId: 1, discordId: 1 }, { unique: true }).catch(() => undefined);
  return c;
}

function toEvent(d: Document, going = 0): ServerEvent {
  return {
    id: String(d._id),
    title: String(d.title ?? ""),
    description: String(d.description ?? ""),
    kind: (EVENT_KINDS.some((k) => k.key === d.kind) ? d.kind : "other") as EventKind,
    startAt: iso(d.startAt) ?? "",
    endAt: iso(d.endAt),
    channelId: d.channelId ? String(d.channelId) : null,
    place: d.place ? String(d.place) : null,
    hostId: d.hostId ? String(d.hostId) : null,
    hostName: d.hostName ? String(d.hostName) : null,
    image: d.image ? String(d.image) : null,
    weekly: Boolean(d.weekly),
    discord: d.discord !== false,
    post: d.post !== false,
    cancelled: Boolean(d.cancelled),
    going,
    createdBy: d.createdBy ? String(d.createdBy) : null,
  };
}

async function goingCounts(ids: string[]) {
  if (!ids.length) return new Map<string, number>();
  const rows = await (await rsvpsCol()).aggregate([{ $match: { eventId: { $in: ids } } }, { $group: { _id: "$eventId", n: { $sum: 1 } } }]).toArray();
  return new Map(rows.map((r) => [String(r._id), Number(r.n)]));
}

// Channel names for "Where" (cached; only names of channels events use are sent out)
let channelCache: { at: number; names: Map<string, { name: string; voice: boolean }> } | null = null;
async function channelNames() {
  if (channelCache && Date.now() - channelCache.at < 10 * 60_000) return channelCache.names;
  try {
    const { channels } = await guildPickers();
    channelCache = { at: Date.now(), names: new Map(channels.map((c) => [c.id, { name: c.name, voice: c.type === 2 || c.type === 13 }])) };
  } catch {
    channelCache = { at: Date.now() - 9 * 60_000, names: channelCache?.names ?? new Map() };
  }
  return channelCache.names;
}

/** Adds the channel's name (and whether it's a voice channel) to public events. */
export async function withPlaces<T extends ServerEvent>(events: T[]) {
  const names = await channelNames();
  return events.map((e) => {
    const ch = e.channelId ? names.get(e.channelId) : null;
    return { ...e, channelName: ch?.name ?? null, voice: ch?.voice ?? false };
  });
}

/** Upcoming and recent events for the public page (and which ones this member asked to be reminded about). */
export async function listEvents(opts: { discordId?: string | null; from?: Date; days?: number; includePast?: boolean } = {}) {
  const now = new Date();
  const from = opts.from ?? new Date(now.getTime() - 6 * 3600_000);
  const until = new Date(from.getTime() + (opts.days ?? 62) * 86_400_000);
  const col = await eventsCol();
  const docs = await col
    .find({ startAt: { $gte: from, $lt: until }, deleted: { $ne: true } })
    .sort({ startAt: 1 })
    .limit(300)
    .toArray();
  const ids = docs.map((d) => String(d._id));
  const counts = await goingCounts(ids);
  const mine = opts.discordId ? new Set((await (await rsvpsCol()).find({ eventId: { $in: ids }, discordId: opts.discordId }).toArray()).map((r) => String(r.eventId))) : new Set<string>();
  const past = opts.includePast
    ? (await col.find({ startAt: { $lt: from, $gte: new Date(from.getTime() - 30 * 86_400_000) }, cancelled: { $ne: true }, deleted: { $ne: true } }).sort({ startAt: -1 }).limit(12).toArray()).map((d) => toEvent(d))
    : [];
  return { events: await withPlaces(docs.map((d) => toEvent(d, counts.get(String(d._id)) ?? 0))), mine: Array.from(mine), past: await withPlaces(past) };
}

/** The next few events (for the homepage). */
export async function nextEvents(limit = 3) {
  const docs = await (await eventsCol())
    .find({ startAt: { $gte: new Date(Date.now() - 2 * 3600_000) }, cancelled: { $ne: true }, deleted: { $ne: true } })
    .sort({ startAt: 1 })
    .limit(limit)
    .toArray();
  const counts = await goingCounts(docs.map((d) => String(d._id)));
  return withPlaces(docs.filter((d) => (d.endAt ? new Date(d.endAt) : new Date(new Date(d.startAt).getTime() + 2 * 3600_000)) > new Date()).map((d) => toEvent(d, counts.get(String(d._id)) ?? 0)));
}

/** "Remind me" on or off for a member. */
export async function setReminder(eventId: string, discordId: string, on: boolean) {
  if (!ObjectId.isValid(eventId)) throw new EventError("Unknown event.", 404);
  const ev = await (await eventsCol()).findOne({ _id: new ObjectId(eventId) });
  if (!ev || ev.cancelled) throw new EventError("That event isn't happening.", 404);
  if (new Date(ev.startAt).getTime() < Date.now()) throw new EventError("That event already started.");
  const col = await rsvpsCol();
  if (on) await col.updateOne({ eventId, discordId }, { $setOnInsert: { eventId, discordId, at: new Date() } }, { upsert: true });
  else await col.deleteOne({ eventId, discordId });
  return { going: await col.countDocuments({ eventId }) };
}

// ---------------------------------------------------------------- staff
function clean(raw: Partial<EventInput>) {
  const title = String(raw.title ?? "").trim();
  if (!title) throw new EventError("Give the event a title.");
  if (title.length > 100) throw new EventError("The title must be 100 characters or fewer.");
  const description = String(raw.description ?? "").trim();
  if (description.length > 1000) throw new EventError("The description must be 1,000 characters or fewer (Discord's limit).");
  const kind = EVENT_KINDS.some((k) => k.key === raw.kind) ? (raw.kind as EventKind) : "other";
  const startAt = new Date(String(raw.startAt ?? ""));
  if (Number.isNaN(startAt.getTime())) throw new EventError("Pick when it starts.");
  const endAt = raw.endAt ? new Date(String(raw.endAt)) : null;
  if (endAt && (Number.isNaN(endAt.getTime()) || endAt <= startAt)) throw new EventError("The end has to be after the start.");
  if (endAt && endAt.getTime() - startAt.getTime() > 7 * 86_400_000) throw new EventError("An event can last at most a week.");
  const channelId = raw.channelId ? String(raw.channelId) : null;
  if (channelId && !ID.test(channelId)) throw new EventError("Pick a channel.");
  const place = raw.place ? String(raw.place).trim().slice(0, 100) : null;
  if (!channelId && !place) throw new EventError("Say where it happens (a channel, or type a place).");
  const hostId = raw.hostId ? String(raw.hostId) : null;
  if (hostId && !ID.test(hostId)) throw new EventError("Pick a host from the list.");
  const image = raw.image ? String(raw.image).trim() : null;
  if (image && (!/^https:\/\/\S+$/i.test(image) || image.length > 500)) throw new EventError("The image must be an https:// link.");
  // Discord's events need an end when they're not in a voice channel
  return {
    title,
    description,
    kind,
    startAt,
    endAt: endAt ?? new Date(startAt.getTime() + 2 * 3600_000),
    channelId,
    place,
    hostId,
    hostName: raw.hostName ? String(raw.hostName).slice(0, 80) : null,
    image,
    weekly: Boolean(raw.weekly),
    discord: raw.discord !== false,
    post: raw.post !== false,
  };
}

export async function staffEvents() {
  const col = await eventsCol();
  const now = new Date();
  const [upcoming, past] = await Promise.all([
    col.find({ startAt: { $gte: new Date(now.getTime() - 12 * 3600_000) }, deleted: { $ne: true } }).sort({ startAt: 1 }).limit(200).toArray(),
    col.find({ startAt: { $lt: new Date(now.getTime() - 12 * 3600_000) }, deleted: { $ne: true } }).sort({ startAt: -1 }).limit(40).toArray(),
  ]);
  const counts = await goingCounts([...upcoming, ...past].map((d) => String(d._id)));
  const map = (d: Document) => ({ ...toEvent(d, counts.get(String(d._id)) ?? 0), discordEventId: d.discordEventId ? String(d.discordEventId) : null, posted: Boolean(d.postMessageId), postError: d.postError ? String(d.postError) : null, lastError: d.lastError ? String(d.lastError) : null });
  return { upcoming: upcoming.map(map), past: past.map(map) };
}

export async function eventGuests(id: string) {
  if (!ObjectId.isValid(id)) throw new EventError("Unknown event.", 404);
  return (await (await rsvpsCol()).find({ eventId: id }).sort({ at: 1 }).limit(500).toArray()).map((r) => String(r.discordId));
}

export async function createEvent(raw: Partial<EventInput>, by: string) {
  const ev = clean(raw);
  if (ev.startAt.getTime() < Date.now() - 60_000) throw new EventError("The start has to be in the future.");
  const res = await (await eventsCol()).insertOne({ ...ev, cancelled: false, version: 1, createdBy: by, createdAt: new Date() });
  return { id: String(res.insertedId) };
}

export async function updateEvent(id: string, raw: Partial<EventInput>, by: string) {
  if (!ObjectId.isValid(id)) throw new EventError("Unknown event.", 404);
  const ev = clean(raw);
  const res = await (await eventsCol()).updateOne(
    { _id: new ObjectId(id) },
    // A moved start means members get reminded again
    { $set: { ...ev, updatedBy: by, updatedAt: new Date(), remindedAt: null, announcedAt: null }, $inc: { version: 1 } },
  );
  if (!res.matchedCount) throw new EventError("Unknown event.", 404);
}

export async function setCancelled(id: string, cancelled: boolean, by: string) {
  if (!ObjectId.isValid(id)) throw new EventError("Unknown event.", 404);
  await (await eventsCol()).updateOne({ _id: new ObjectId(id) }, { $set: { cancelled, updatedBy: by, updatedAt: new Date() }, $inc: { version: 1 } });
}

export async function deleteEvent(id: string) {
  if (!ObjectId.isValid(id)) throw new EventError("Unknown event.", 404);
  const col = await eventsCol();
  const doc = await col.findOne({ _id: new ObjectId(id) });
  if (!doc) return;
  // The bot removes the Discord event and the posted embed when it sees `deleted`, then the record goes
  if (doc.discordEventId || doc.postMessageId) await col.updateOne({ _id: doc._id }, { $set: { deleted: true, cancelled: true }, $inc: { version: 1 } });
  else await col.deleteOne({ _id: doc._id });
  await (await rsvpsCol()).deleteMany({ eventId: id });
}

/** One event as an .ics calendar file (Google, Apple and Outlook all read these). */
export async function eventIcs(id: string) {
  if (!ObjectId.isValid(id)) throw new EventError("Unknown event.", 404);
  const d = await (await eventsCol()).findOne({ _id: new ObjectId(id), deleted: { $ne: true } });
  if (!d) throw new EventError("Unknown event.", 404);
  const [e] = await withPlaces([toEvent(d)]);
  const stamp = (v: string | Date) => new Date(v).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const esc = (t: string) => t.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/[,;]/g, (m) => `\\${m}`);
  const where = e.channelName ? `#${e.channelName} on the Kitty Kingdom Discord` : e.place ?? "Kitty Kingdom";
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Kitty Kingdom//Events//EN",
    "BEGIN:VEVENT",
    `UID:${e.id}@kittykingdom.net`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(e.startAt)}`,
    `DTEND:${stamp(e.endAt ?? new Date(new Date(e.startAt).getTime() + 2 * 3600_000))}`,
    `SUMMARY:${esc(e.title)}`,
    `DESCRIPTION:${esc(`${e.description}\n\nhttps://www.kittykingdom.net/events`)}`,
    `LOCATION:${esc(where)}`,
    ...(e.cancelled ? ["STATUS:CANCELLED"] : []),
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

/**
 * For the bubble on the Events tab: upcoming events and open polls (by id, so the bubble can count the ones
 * you haven't seen on /events yet) and whether an event is happening right now.
 */
export async function eventNavStamps(): Promise<{ ids: string[]; live: boolean }> {
  try {
    const now = new Date();
    const [events, polls] = await Promise.all([
      (await eventsCol())
        .find(
          { deleted: { $ne: true }, cancelled: { $ne: true }, startAt: { $lte: new Date(now.getTime() + 30 * 86_400_000) }, $or: [{ endAt: { $gt: now } }, { endAt: null, startAt: { $gt: new Date(now.getTime() - 2 * 3600_000) } }] },
          { projection: { startAt: 1, endAt: 1 } },
        )
        .limit(50)
        .toArray(),
      (await getBotCollection("event_polls"))
        .find({ status: "posted", deleted: { $ne: true }, endRequested: { $ne: true }, $or: [{ expiresAt: { $gt: now } }, { expiresAt: null }] }, { projection: { _id: 1 } })
        .limit(20)
        .toArray(),
    ]);
    const live = events.some((e) => new Date(e.startAt).getTime() <= now.getTime());
    return { ids: [...events.map((e) => `e:${e._id}`), ...polls.map((p) => `p:${p._id}`)], live };
  } catch {
    return { ids: [], live: false };
  }
}
