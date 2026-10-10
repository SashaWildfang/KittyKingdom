// Admin → Giveaways: giveaways are written here and run by the Main Bot (Main_Bot events/giveaways.py).
//   zeo_bot.giveaways         one per giveaway (the bot sets status, messageId, results)
//   zeo_bot.giveaway_entries  {giveawayId, userId, at}, one per person who pressed Enter
// The bot picks scheduled giveaways up within ~10 seconds of startAt, re-renders the post when `version`
// changes, and handles `requests` (end now, cancel, reroll). How giveaways run in general (default channel,
// ping, DMs, button) is in Admin → Bots → Main Bot → Giveaways.

import { Long, ObjectId, type Document } from "mongodb";
import { people, type Person } from "./admin-people";
import { getBotCollection } from "./mongodb";
import { getGuildRoles, getMemberBasics } from "./discord-member";
import { RETIRED_ITEM_IDS } from "./store";
import { seasonal } from "./season-store";

export class GiveawayError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

export type PrizeType = "leaves" | "item" | "custom";
export type Prize = { type: PrizeType; amount?: number; itemId?: string; itemName?: string; quantity?: number; text?: string };
export type Requirements = { minLevel: number; minDaysInServer: number; requiredRoles: string[]; blockedRoles: string[] };
export type Recurring = "none" | "daily" | "weekly" | "monthly";
export type Status = "scheduled" | "running" | "ended" | "cancelled";

export type GiveawayInput = {
  title: string;
  description: string;
  prize: Prize;
  winners: number;
  channelId: string | null;
  pingRoleId: string | null;
  color: string | null;
  image: string | null;
  /** null: start right away */
  startAt: string | null;
  endAt: string;
  requirements: Requirements;
  recurring: Recurring;
};

export type Result = { userId: string; awarded: boolean; note: string };

export type Giveaway = GiveawayInput & {
  id: string;
  status: Status;
  entries: number;
  messageId: string | null;
  postedChannelId: string | null;
  results: Result[];
  createdBy: string | null;
  createdAt: string | null;
  endedAt: string | null;
  lastError: string | null;
  pending: { end: boolean; cancel: boolean; reroll: number; edit: boolean };
  previousId: string | null;
  history: { at: string | null; by: string; action: string; detail?: string }[];
};

export type StoreItem = { id: string; name: string; price: number; image: string | null; category: string | null; active: boolean; role: boolean };

const ID = /^\d{15,21}$/;
const MAX_DAYS = 60;
const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : typeof v === "string" ? v : null);

async function giveaways() {
  return getBotCollection("giveaways");
}
async function entries() {
  const c = await getBotCollection("giveaway_entries");
  await c.createIndex({ giveawayId: 1, userId: 1 }, { unique: true }).catch(() => undefined);
  return c;
}

function oid(id: string) {
  if (!ObjectId.isValid(id)) throw new GiveawayError("Unknown giveaway.", 404);
  return new ObjectId(id);
}

function toGiveaway(d: Document, count?: number): Giveaway {
  const req = (d.requirements ?? {}) as Partial<Requirements>;
  const requests = (d.requests ?? {}) as { end?: boolean; cancel?: boolean; reroll?: number };
  const status = (d.status === "ending" ? "running" : d.status) as Status;
  return {
    id: String(d._id),
    title: String(d.title ?? ""),
    description: String(d.description ?? ""),
    prize: (d.prize ?? { type: "custom", text: "" }) as Prize,
    winners: Number(d.winners ?? 1),
    channelId: d.channelId ? String(d.channelId) : null,
    pingRoleId: d.pingRoleId ? String(d.pingRoleId) : null,
    color: d.color ? String(d.color) : null,
    image: d.image ? String(d.image) : null,
    startAt: iso(d.startAt),
    endAt: iso(d.endAt) ?? "",
    requirements: {
      minLevel: Number(req.minLevel ?? 0),
      minDaysInServer: Number(req.minDaysInServer ?? 0),
      requiredRoles: (req.requiredRoles ?? []).map(String),
      blockedRoles: (req.blockedRoles ?? []).map(String),
    },
    recurring: (d.recurring ?? "none") as Recurring,
    status,
    entries: count ?? Number(d.entries ?? 0),
    messageId: d.messageId ? String(d.messageId) : null,
    postedChannelId: d.postedChannelId ? String(d.postedChannelId) : null,
    results: ((d.results ?? []) as Result[]).map((r) => ({ userId: String(r.userId), awarded: Boolean(r.awarded), note: String(r.note ?? "") })),
    createdBy: d.createdBy ? String(d.createdBy) : null,
    createdAt: iso(d.createdAt),
    endedAt: iso(d.endedAt),
    lastError: d.lastError ? String(d.lastError) : null,
    pending: {
      end: Boolean(requests.end),
      cancel: Boolean(requests.cancel),
      reroll: Number(requests.reroll ?? 0),
      edit: status === "running" && d.version !== d.appliedVersion,
    },
    previousId: d.previousId ? String(d.previousId) : null,
    history: ((d.history ?? []) as Document[]).slice(-30).map((h) => ({ at: iso(h.at), by: String(h.by ?? ""), action: String(h.action ?? ""), ...(h.detail ? { detail: String(h.detail) } : {}) })),
  };
}

// ---------------------------------------------------------------- validation
const whole = (v: unknown, label: string, min: number, max: number) => {
  const n = Number(v);
  if (!Number.isInteger(n) || n < min || n > max) throw new GiveawayError(`${label} must be a whole number from ${min.toLocaleString()} to ${max.toLocaleString()}.`);
  return n;
};
const idOrNull = (v: unknown, label: string) => {
  if (v === null || v === undefined || v === "") return null;
  const s = String(v);
  if (!ID.test(s)) throw new GiveawayError(`Pick a ${label}.`);
  return s;
};
const ids = (v: unknown, label: string) => {
  if (!Array.isArray(v)) return [];
  const out = Array.from(new Set(v.map(String)));
  if (out.some((x) => !ID.test(x))) throw new GiveawayError(`${label} has something that isn't a role.`);
  return out.slice(0, 25);
};
const date = (v: unknown, label: string) => {
  const d = new Date(String(v ?? ""));
  if (!v || Number.isNaN(d.getTime())) throw new GiveawayError(`${label} isn't a valid date and time.`);
  return d;
};

async function cleanPrize(raw: Partial<Prize> | undefined): Promise<Prize> {
  const type = raw?.type;
  if (type === "leaves") return { type, amount: whole(raw?.amount, seasonal("The Leaves prize"), 1, 10_000_000) };
  if (type === "item") {
    const itemId = String(raw?.itemId ?? "");
    const item = itemId && !RETIRED_ITEM_IDS.includes(itemId) ? await (await getBotCollection("store_inventory")).findOne({ item_id: itemId, retired: { $ne: true } }) : null;
    if (!item) throw new GiveawayError("Pick a store item for the prize.");
    return { type, itemId, itemName: String(item.name ?? itemId), quantity: whole(raw?.quantity ?? 1, "The item quantity", 1, 25) };
  }
  if (type === "custom") {
    const text = String(raw?.text ?? "").trim();
    if (!text) throw new GiveawayError("Say what the prize is.");
    if (text.length > 200) throw new GiveawayError("The prize must be 200 characters or fewer.");
    return { type, text };
  }
  throw new GiveawayError("Pick a prize type.");
}

/** Checks a giveaway from the admin form. `running`: it has already started, so its start can't move. */
export async function cleanInput(raw: Partial<GiveawayInput>, running = false) {
  const title = String(raw.title ?? "").trim();
  if (!title) throw new GiveawayError("Give the giveaway a title.");
  if (title.length > 100) throw new GiveawayError("The title must be 100 characters or fewer.");
  const description = String(raw.description ?? "").trim();
  if (description.length > 1500) throw new GiveawayError("The description must be 1,500 characters or fewer.");
  const now = Date.now();
  const startAt = running || !raw.startAt ? null : date(raw.startAt, "The start");
  const endAt = date(raw.endAt, "The end");
  const from = startAt?.getTime() ?? now;
  if (endAt.getTime() <= now + 30_000) throw new GiveawayError("The end has to be in the future.");
  if (endAt.getTime() - from < 60_000) throw new GiveawayError("A giveaway has to run for at least a minute.");
  if (endAt.getTime() - from > MAX_DAYS * 86_400_000) throw new GiveawayError(`A giveaway can run for at most ${MAX_DAYS} days.`);
  if (startAt && startAt.getTime() > now + 365 * 86_400_000) throw new GiveawayError("The start can be at most a year away.");
  const color = raw.color ? String(raw.color).trim().toLowerCase() : null;
  if (color && !/^#[0-9a-f]{6}$/.test(color)) throw new GiveawayError("Pick a color (#RRGGBB).");
  const image = raw.image ? String(raw.image).trim() : null;
  if (image && (!/^https:\/\/\S+$/i.test(image) || image.length > 500)) throw new GiveawayError("The image must be an https:// link.");
  const req = raw.requirements ?? ({} as Partial<Requirements>);
  const recurring = (["none", "daily", "weekly", "monthly"] as const).includes(raw.recurring as Recurring) ? (raw.recurring as Recurring) : "none";
  if (recurring !== "none") {
    const period = { daily: 1, weekly: 7, monthly: 30 }[recurring] * 86_400_000;
    if (endAt.getTime() - from > period) throw new GiveawayError(`A ${recurring} giveaway can't run longer than one ${recurring === "daily" ? "day" : recurring === "weekly" ? "week" : "month"}.`);
  }
  return {
    title,
    description,
    prize: await cleanPrize(raw.prize),
    winners: whole(raw.winners ?? 1, "Winners", 1, 50),
    channelId: idOrNull(raw.channelId, "channel"),
    pingRoleId: idOrNull(raw.pingRoleId, "ping role"),
    color,
    image,
    startAt,
    endAt,
    requirements: {
      minLevel: whole(req.minLevel ?? 0, "Minimum level", 0, 500),
      minDaysInServer: whole(req.minDaysInServer ?? 0, "Days in the server", 0, 3650),
      requiredRoles: ids(req.requiredRoles, "Required roles"),
      blockedRoles: ids(req.blockedRoles, "Blocked roles"),
    },
    recurring,
  };
}

// ---------------------------------------------------------------- reads
export type GiveawayList = {
  rows: Giveaway[];
  people: Record<string, Person>;
  counts: Record<"scheduled" | "running" | "ended" | "cancelled", number>;
  stats: { total: number; entries: number; winners: number; leaves: number; items: number; manualToDo: number };
};

export async function listGiveaways(status: string, search = ""): Promise<GiveawayList> {
  const col = await giveaways();
  const filter: Document = {};
  if (status === "running") filter.status = { $in: ["running", "ending"] };
  else if (["scheduled", "ended", "cancelled"].includes(status)) filter.status = status;
  if (search.trim()) filter.title = { $regex: search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
  const sort: Document = status === "scheduled" ? { startAt: 1 } : status === "running" ? { endAt: 1 } : { endAt: -1 };
  const [docs, grouped, all] = await Promise.all([
    col.find(filter).sort(sort).limit(200).toArray(),
    col.aggregate([{ $group: { _id: "$status", n: { $sum: 1 } } }]).toArray(),
    col.find({ status: "ended" }, { projection: { prize: 1, results: 1, entries: 1 } }).toArray(),
  ]);
  const ent = await entries();
  const live = docs.filter((d) => d.status === "running" || d.status === "ending");
  const liveCounts = live.length
    ? await ent.aggregate([{ $match: { giveawayId: { $in: live.map((d) => String(d._id)) } } }, { $group: { _id: "$giveawayId", n: { $sum: 1 } } }]).toArray()
    : [];
  const byId = new Map(liveCounts.map((c) => [String(c._id), Number(c.n)]));
  const rows = docs.map((d) => toGiveaway(d, byId.get(String(d._id))));
  const counts = { scheduled: 0, running: 0, ended: 0, cancelled: 0 };
  for (const g of grouped) {
    const key = g._id === "ending" ? "running" : (g._id as keyof typeof counts);
    if (key in counts) counts[key] += Number(g.n);
  }
  const stats = { total: counts.scheduled + counts.running + counts.ended + counts.cancelled, entries: 0, winners: 0, leaves: 0, items: 0, manualToDo: 0 };
  for (const d of all) {
    const results = (d.results ?? []) as Result[];
    stats.entries += Number(d.entries ?? 0);
    stats.winners += results.length;
    if (d.prize?.type === "leaves") stats.leaves += Number(d.prize.amount ?? 0) * results.length;
    if (d.prize?.type === "item") stats.items += Number(d.prize.quantity ?? 1) * results.length;
    stats.manualToDo += results.filter((r) => !r.awarded && !(r as { handed?: boolean }).handed).length;
  }
  const who = await people(rows.flatMap((r) => [r.createdBy, ...r.results.map((x) => x.userId)]));
  return { rows, people: who, counts, stats };
}

export async function getGiveaway(id: string, page = 1) {
  const doc = await (await giveaways()).findOne({ _id: oid(id) });
  if (!doc) throw new GiveawayError("Unknown giveaway.", 404);
  const ent = await entries();
  const pageSize = 50;
  const p = Math.max(1, Math.floor(page) || 1);
  const [total, list] = await Promise.all([
    ent.countDocuments({ giveawayId: id }),
    ent.find({ giveawayId: id }).sort({ at: -1 }).skip((p - 1) * pageSize).limit(pageSize).toArray(),
  ]);
  const g = toGiveaway(doc, doc.status === "ended" || doc.status === "cancelled" ? undefined : total);
  const handed = new Set(((doc.results ?? []) as (Result & { handed?: boolean })[]).filter((r) => r.handed).map((r) => String(r.userId)));
  const entrants = list.map((e) => ({ userId: String(e.userId), at: iso(e.at) }));
  const who = await people([g.createdBy, ...g.history.map((h) => h.by), ...g.results.map((r) => r.userId), ...entrants.map((e) => e.userId)]);
  return { giveaway: g, handed: Array.from(handed), entrants, total, page: p, pageSize, people: who };
}

export async function storeItems(): Promise<StoreItem[]> {
  const docs = await (await getBotCollection("store_inventory")).find({ item_id: { $nin: RETIRED_ITEM_IDS }, retired: { $ne: true } }, { projection: { item_id: 1, name: 1, price: 1, image_url: 1, category: 1, is_active: 1, role_id: 1 } }).toArray();
  return docs
    .map((d) => ({
      id: String(d.item_id),
      name: String(d.name ?? d.item_id),
      price: Number(d.price ?? 0),
      image: d.image_url ? String(d.image_url) : null,
      category: d.category ? String(d.category) : null,
      active: Boolean(d.is_active),
      role: Boolean(d.role_id),
    }))
    .sort((a, b) => (a.category ?? "").localeCompare(b.category ?? "") || a.name.localeCompare(b.name));
}

// ---------------------------------------------------------------- writes
const historyEntry = (by: string, action: string, detail?: string) => ({ at: new Date(), by, action, ...(detail ? { detail } : {}) });

export async function createGiveaway(raw: Partial<GiveawayInput>, by: string) {
  const clean = await cleanInput(raw);
  const now = new Date();
  const res = await (await giveaways()).insertOne({
    ...clean,
    startAt: clean.startAt ?? now,
    status: "scheduled",
    version: 1,
    createdBy: by,
    createdAt: now,
    history: [historyEntry(by, "created")],
  });
  return { id: String(res.insertedId) };
}

export async function updateGiveaway(id: string, raw: Partial<GiveawayInput>, by: string) {
  const col = await giveaways();
  const doc = await col.findOne({ _id: oid(id) });
  if (!doc) throw new GiveawayError("Unknown giveaway.", 404);
  if (doc.status !== "scheduled" && doc.status !== "running") throw new GiveawayError("Only upcoming and running giveaways can be edited.");
  const running = doc.status === "running";
  const clean = await cleanInput(raw, running);
  const set: Document = { ...clean, updatedAt: new Date(), updatedBy: by };
  if (running) {
    // Already posted: the start and channel can't change; the bot re-renders the post on the next version
    delete set.startAt;
    delete set.channelId;
    delete set.pingRoleId;
  } else {
    set.startAt = clean.startAt ?? new Date();
  }
  const res = await col.updateOne(
    { _id: doc._id, status: doc.status },
    { $set: set, $inc: { version: 1 }, $push: { history: historyEntry(by, "edited") } as Document },
  );
  if (!res.matchedCount) throw new GiveawayError("The giveaway changed while you were editing (it may have just started or ended). Reload and try again.", 409);
  return { ok: true };
}

export async function deleteGiveaway(id: string) {
  const col = await giveaways();
  const doc = await col.findOne({ _id: oid(id) });
  if (!doc) throw new GiveawayError("Unknown giveaway.", 404);
  if (doc.status === "running" || doc.status === "ending") throw new GiveawayError("Cancel or end a running giveaway before deleting it.");
  await col.deleteOne({ _id: doc._id, status: doc.status });
  await (await entries()).deleteMany({ giveawayId: id });
  return { ok: true };
}

export type GiveawayAction = "end" | "cancel" | "reroll" | "start" | "handed" | "duplicate";

/** End now / cancel / reroll are picked up by the bot; "start" makes an upcoming one start now. */
export async function giveawayAction(id: string, action: GiveawayAction, by: string, opts: { count?: number; userId?: string } = {}) {
  const col = await giveaways();
  const doc = await col.findOne({ _id: oid(id) });
  if (!doc) throw new GiveawayError("Unknown giveaway.", 404);
  const push = (detail?: string) => ({ $push: { history: historyEntry(by, action, detail) } as Document });
  switch (action) {
    case "start": {
      if (doc.status !== "scheduled") throw new GiveawayError("Only upcoming giveaways can be started early.");
      const start = new Date();
      const length = Math.max(60_000, new Date(doc.endAt).getTime() - new Date(doc.startAt ?? start).getTime());
      await col.updateOne({ _id: doc._id, status: "scheduled" }, { $set: { startAt: start, endAt: new Date(start.getTime() + length) }, ...push() });
      return { ok: true };
    }
    case "end":
      if (doc.status !== "running") throw new GiveawayError("Only running giveaways can be ended early.");
      await col.updateOne({ _id: doc._id }, { $set: { "requests.end": true }, ...push() });
      return { ok: true };
    case "cancel":
      if (doc.status === "scheduled") {
        await col.updateOne({ _id: doc._id, status: "scheduled" }, { $set: { status: "cancelled", endedAt: new Date() }, ...push() });
      } else if (doc.status === "running") {
        await col.updateOne({ _id: doc._id }, { $set: { "requests.cancel": true }, ...push() });
      } else throw new GiveawayError("This giveaway already finished.");
      return { ok: true };
    case "reroll": {
      if (doc.status !== "ended") throw new GiveawayError("Only ended giveaways can be rerolled.");
      const count = whole(opts.count ?? 1, "Rerolled winners", 1, 50);
      await col.updateOne({ _id: doc._id }, { $set: { "requests.reroll": count }, ...push(`${count}`) });
      return { ok: true };
    }
    case "handed": {
      const uid = String(opts.userId ?? "");
      const res = await col.updateOne({ _id: doc._id, "results.userId": uid }, { $set: { "results.$.handed": true, "results.$.handedBy": by, "results.$.handedAt": new Date() }, ...push(uid) });
      if (!res.matchedCount) throw new GiveawayError("That person didn't win this giveaway.");
      return { ok: true };
    }
    case "duplicate": {
      const length = Math.max(3_600_000, new Date(doc.endAt).getTime() - new Date(doc.startAt ?? doc.endAt).getTime());
      const start = new Date(Date.now() + 3_600_000);
      const keep = ["title", "description", "prize", "winners", "channelId", "pingRoleId", "color", "image", "requirements", "recurring"];
      const copy: Document = Object.fromEntries(keep.filter((k) => k in doc).map((k) => [k, doc[k]]));
      const res = await col.insertOne({
        ...copy,
        title: `${String(doc.title ?? "Giveaway")}`.slice(0, 100),
        startAt: start,
        endAt: new Date(start.getTime() + Math.min(length, MAX_DAYS * 86_400_000)),
        status: "scheduled",
        version: 1,
        createdBy: by,
        createdAt: new Date(),
        copiedFrom: String(doc._id),
        history: [historyEntry(by, "created", `copy of ${String(doc._id)}`)],
      });
      return { ok: true, id: String(res.insertedId) };
    }
  }
  throw new GiveawayError("Unknown action.");
}

// ---------------------------------------------------------------- members: giveaways on the website
export type PublicGiveaway = {
  id: string;
  title: string;
  description: string;
  prize: Prize;
  winners: number;
  status: "scheduled" | "running" | "ended";
  startAt: string | null;
  endAt: string;
  entries: number;
  color: string | null;
  image: string | null;
  needs: string[];
  winnerNames: string[];
};

const STAFF_TEAM_ROLE = "1358470109965979859";

async function roleNames(ids: string[]) {
  if (!ids.length) return new Map<string, string>();
  const roles = await getGuildRoles().catch(() => new Map());
  return new Map(ids.map((id) => [id, (roles.get(id) as { name?: string } | undefined)?.name ?? "a role"]));
}

/** Running and upcoming giveaways, and the last few winners (for /giveaways). */
export async function publicGiveaways(discordId: string | null) {
  const col = await giveaways();
  const now = new Date();
  const [running, upcoming, ended] = await Promise.all([
    col.find({ status: { $in: ["running", "ending"] } }).sort({ endAt: 1 }).limit(20).toArray(),
    col.find({ status: "scheduled", startAt: { $lte: new Date(now.getTime() + 14 * 86_400_000) } }).sort({ startAt: 1 }).limit(10).toArray(),
    col.find({ status: "ended" }).sort({ endedAt: -1 }).limit(8).toArray(),
  ]);
  const ent = await entries();
  const runningIds = running.map((d) => String(d._id));
  const counts = runningIds.length ? new Map((await ent.aggregate([{ $match: { giveawayId: { $in: runningIds } } }, { $group: { _id: "$giveawayId", n: { $sum: 1 } } }]).toArray()).map((r) => [String(r._id), Number(r.n)])) : new Map();
  const mine = discordId && runningIds.length ? new Set((await ent.find({ giveawayId: { $in: runningIds }, userId: discordId }).toArray()).map((e) => String(e.giveawayId))) : new Set<string>();
  const roleIds = Array.from(new Set([...running, ...upcoming].flatMap((d) => [...(d.requirements?.requiredRoles ?? []), ...(d.requirements?.blockedRoles ?? [])].map(String))));
  const names = await roleNames(roleIds);
  const winnerIds = ended.flatMap((d) => ((d.results ?? []) as Result[]).map((r) => r.userId));
  const who = await people(winnerIds).catch(() => ({}) as Record<string, Person>);
  const view = (d: Document, status: PublicGiveaway["status"]): PublicGiveaway => {
    const g = toGiveaway(d, counts.get(String(d._id)));
    const needs: string[] = [];
    if (g.requirements.minLevel) needs.push(`Level ${g.requirements.minLevel}+`);
    if (g.requirements.minDaysInServer) needs.push(`In the server ${g.requirements.minDaysInServer}+ days`);
    if (g.requirements.requiredRoles.length) needs.push(`Has ${g.requirements.requiredRoles.map((r) => names.get(r)).join(" or ")}`);
    if (g.requirements.blockedRoles.length) needs.push(`Not ${g.requirements.blockedRoles.map((r) => names.get(r)).join(", ")}`);
    return {
      id: g.id,
      title: g.title,
      description: g.description,
      prize: g.prize,
      winners: g.winners,
      status,
      startAt: g.startAt,
      endAt: g.endAt,
      entries: g.entries,
      color: g.color,
      image: g.image,
      needs,
      winnerNames: status === "ended" ? g.results.map((r) => who[r.userId]?.name ?? "A member") : [],
    };
  };
  return { running: running.map((d) => view(d, "running")), upcoming: upcoming.map((d) => view(d, "scheduled")), ended: ended.map((d) => view(d, "ended")), entered: Array.from(mine) };
}

/** Why a member can't enter (null if they can). Same checks as the bot (Main_Bot events/giveaways.py). */
async function entryProblem(doc: Document, discordId: string) {
  const member = await getMemberBasics(discordId);
  if (!member) return "You need to be in the Discord server to enter.";
  const req = (doc.requirements ?? {}) as Partial<Requirements>;
  const roles = new Set(member.roles);
  const allowStaff = await (await getBotCollection("bot_settings")).findOne({ _id: "main" as never }, { projection: { "values.giveaways": 1 } }).then((s) => s?.values?.giveaways?.allowStaff !== false).catch(() => true);
  if (!allowStaff && roles.has(STAFF_TEAM_ROLE)) return "Staff can't enter giveaways.";
  if ((req.blockedRoles ?? []).some((r) => roles.has(String(r)))) return "One of your roles can't enter this giveaway.";
  const needed = (req.requiredRoles ?? []).map(String);
  if (needed.length && !needed.some((r) => roles.has(r))) return "You don't have a role this giveaway needs.";
  const days = Number(req.minDaysInServer ?? 0);
  if (days && member.joinedAt && (Date.now() - new Date(member.joinedAt).getTime()) / 86_400_000 < days) return `You need to have been in the server for ${days} days.`;
  const lvl = Number(req.minLevel ?? 0);
  if (lvl) {
    const users = await getBotCollection("users");
    const u = (await users.findOne({ discordId: Long.fromString(discordId) } as never, { projection: { level: 1 } })) ?? (await users.findOne({ discordId } as never, { projection: { level: 1 } }));
    const have = Number(u?.level ?? 1);
    if (have < lvl) return `You need to be Level ${lvl}+ (you're Level ${have}).`;
  }
  return null;
}

/** Enter (or leave) a running giveaway from the website. */
export async function toggleEntry(id: string, discordId: string, enter: boolean) {
  const doc = await (await giveaways()).findOne({ _id: oid(id) });
  if (!doc || doc.status !== "running") throw new GiveawayError("This giveaway isn't open right now.", 409);
  const ent = await entries();
  if (!enter) {
    await ent.deleteOne({ giveawayId: id, userId: discordId });
  } else {
    const problem = await entryProblem(doc, discordId);
    if (problem) throw new GiveawayError(problem, 403);
    await ent.updateOne({ giveawayId: id, userId: discordId }, { $setOnInsert: { giveawayId: id, userId: discordId, at: new Date(), via: "website" } }, { upsert: true });
  }
  return { entries: await ent.countDocuments({ giveawayId: id }) };
}
