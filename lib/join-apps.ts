// Admin -> Join Apps: the Discord join applications (zeo_bot.join_applications, written by the
// bot's member_join.py) and staff decisions from the website. Decisions are queued in
// website.join_actions and carried out by the bot with the same code as its Discord buttons.

import { ObjectId, type Document } from "mongodb";
import { people, type Person } from "./admin-people";
import { applicationBirthday } from "./join-application";
import { getJoinApplicationsCollection, getMongoClient } from "./mongodb";

export const JOIN_STATUSES = ["pending", "approved", "denied", "banned", "left", "auto_denied", "underage_kick"] as const;
export type JoinAction = "accept" | "deny" | "ban";
const QUEUE_OFFLINE_AFTER_MS = 30_000;
const DISCORD_EPOCH = BigInt("1420070400000");

export class JoinAppError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

export type JoinApp = {
  discordId: string;
  status: string;
  submittedAt: string | null;
  ageAndDob: string | null;
  age: number | null;
  birthday: string | null;
  howFound: string | null;
  fursonaAndReason: string | null;
  bio: string | null;
  accountCreatedAt: string | null;
  reviewedAt: string | null;
  reviewedBy: string | null;
  reviewedVia: string | null;
  reason: string | null;
  /** The newest website request for this applicant (queued, running or finished) */
  request: { id: string; action: JoinAction; status: string; result: string | null; byName: string; at: string } | null;
};

async function websiteDb() {
  const client = await getMongoClient();
  return client.db(process.env.MONGODB_DB ?? "website");
}

const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : typeof v === "string" && !Number.isNaN(Date.parse(v)) ? new Date(v).toISOString() : null);
const text = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

/** When a Discord account was created, from its id. */
function createdFromId(id: string) {
  if (!/^\d{15,21}$/.test(id)) return null;
  return new Date(Number((BigInt(id) >> BigInt(22)) + DISCORD_EPOCH)).toISOString();
}

function toApp(d: Document, request: JoinApp["request"]): JoinApp {
  const discordId = String(d.discordId ?? d.discord_id ?? d.userId ?? "");
  const birth = applicationBirthday(d as Record<string, unknown>);
  return {
    discordId,
    status: String(d.status ?? "pending"),
    submittedAt: iso(d.submittedAt),
    ageAndDob: text(d.ageAndDob),
    age: birth.age,
    birthday: birth.birthDate ? birth.birthDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }) : null,
    howFound: text(d.howFoundServer),
    fursonaAndReason: text(d.fursonaAndReason),
    bio: text(d.bio),
    accountCreatedAt: createdFromId(discordId),
    reviewedAt: iso(d.reviewedAt),
    reviewedBy: d.reviewedBy !== undefined && d.reviewedBy !== null ? String(d.reviewedBy) : null,
    reviewedVia: text(d.reviewedVia),
    reason: text(d.reason),
    request,
  };
}

async function latestRequests(ids: string[]) {
  if (!ids.length) return new Map<string, JoinApp["request"]>();
  const docs = await (await websiteDb())
    .collection("join_actions")
    .aggregate([{ $match: { discordId: { $in: ids } } }, { $sort: { createdAt: -1 } }, { $group: { _id: "$discordId", doc: { $first: "$$ROOT" } } }])
    .toArray();
  return new Map(
    docs.map((g) => {
      const d = g.doc as Document;
      return [
        String(g._id),
        { id: String(d._id), action: d.action as JoinAction, status: String(d.status), result: text(d.result), byName: String(d.by?.name ?? "staff"), at: iso(d.finishedAt ?? d.createdAt) ?? new Date().toISOString() },
      ];
    }),
  );
}

async function queueHealthy() {
  const beat = await (await websiteDb()).collection("live_meta").findOne({ _id: "join_actions" as never });
  return Boolean(beat?.at instanceof Date && Date.now() - beat.at.getTime() < QUEUE_OFFLINE_AFTER_MS);
}

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Applications for the Join Apps tab, newest first, with counts per status. */
export async function listJoinApps(q: { status?: string; search?: string; page?: number }) {
  const col = await getJoinApplicationsCollection();
  const filter: Document = {};
  if (q.status && q.status !== "all") filter.status = q.status;
  const search = q.search?.trim().slice(0, 80);
  if (search) {
    const regex = new RegExp(escapeRegex(search), "i");
    // Match names from the member directory as well as the answers themselves
    const client = await getMongoClient();
    const nameIds = (
      await client
        .db(process.env.MONGODB_DB ?? "website")
        .collection("member_directory")
        .find({ $or: [{ username: regex }, { displayName: regex }] }, { projection: { _id: 1 } })
        .limit(100)
        .toArray()
    ).map((d) => String(d._id));
    filter.$or = [{ discordId: regex }, { bio: regex }, { fursonaAndReason: regex }, { howFoundServer: regex }, ...(nameIds.length ? [{ discordId: { $in: nameIds } }] : [])];
  }
  const pageSize = 20;
  const page = Math.max(1, q.page ?? 1);
  const [docs, total, counts, healthy] = await Promise.all([
    col.find(filter).sort({ submittedAt: -1 }).skip((page - 1) * pageSize).limit(pageSize).toArray(),
    col.countDocuments(filter),
    col.aggregate([{ $group: { _id: "$status", n: { $sum: 1 } } }]).toArray(),
    queueHealthy(),
  ]);
  const ids = docs.map((d) => String(d.discordId ?? ""));
  const requests = await latestRequests(ids);
  const apps = docs.map((d) => toApp(d, requests.get(String(d.discordId)) ?? null));
  const who = await people([...ids, ...apps.map((a) => a.reviewedBy)]);
  return {
    apps,
    total,
    page,
    pageSize,
    counts: Object.fromEntries(counts.map((c) => [String(c._id ?? "unknown"), c.n as number])) as Record<string, number>,
    people: who,
    queueOnline: healthy,
  };
}

/** Just the number waiting, for the tab's bubble. */
export async function pendingJoinCount() {
  return (await getJoinApplicationsCollection()).countDocuments({ status: "pending" });
}

/** One member's newest application (for their profile in the admin panel). */
export async function joinAppFor(discordId: string): Promise<{ app: JoinApp | null; people: Record<string, Person>; queueOnline: boolean }> {
  if (!/^\d{15,21}$/.test(discordId)) return { app: null, people: {}, queueOnline: false };
  const col = await getJoinApplicationsCollection();
  const doc = await col.findOne({ $or: [{ discordId }, { discord_id: discordId }, { userId: discordId }] }, { sort: { submittedAt: -1 } });
  if (!doc) return { app: null, people: {}, queueOnline: await queueHealthy() };
  const requests = await latestRequests([discordId]);
  const app = toApp(doc, requests.get(discordId) ?? null);
  const [who, healthy] = await Promise.all([people([discordId, app.reviewedBy]), queueHealthy()]);
  return { app, people: who, queueOnline: healthy };
}

/** Queues a staff decision for the bot to carry out. */
export async function queueJoinAction(actor: { discordId: string; name: string }, discordId: string, action: JoinAction, reason: string) {
  if (!/^\d{15,21}$/.test(discordId)) throw new JoinAppError("Unknown applicant.", 404);
  if (!["accept", "deny", "ban"].includes(action)) throw new JoinAppError("Unknown action.");
  const cleanReason = reason.trim().slice(0, 500);
  if (action === "deny" && cleanReason.length < 3) throw new JoinAppError("Give a reason for denying (they'll see it).");
  if (action === "ban" && cleanReason.length < 3) throw new JoinAppError("Give a reason for the ban.");
  if (discordId === actor.discordId) throw new JoinAppError("You can't review your own application.", 403);

  const app = await (await getJoinApplicationsCollection()).findOne({ discordId });
  if (!app) throw new JoinAppError("That application doesn't exist.", 404);
  if (action !== "ban" && app.status !== "pending") throw new JoinAppError(`That application is already ${String(app.status)}.`, 409);

  const actions = (await websiteDb()).collection("join_actions");
  const busy = await actions.findOne({ discordId, status: { $in: ["queued", "processing"] }, createdAt: { $gte: new Date(Date.now() - 10 * 60_000) } });
  if (busy) throw new JoinAppError("Another decision for this applicant is already being processed.", 409);

  const res = await actions.insertOne({
    discordId,
    action,
    reason: cleanReason || null,
    by: { discordId: actor.discordId, name: actor.name },
    status: "queued",
    createdAt: new Date(),
  });
  return { id: String(res.insertedId), queueOnline: await queueHealthy() };
}

/** Status of a queued decision. */
export async function joinActionStatus(id: string) {
  if (!ObjectId.isValid(id)) return null;
  const d = await (await websiteDb()).collection("join_actions").findOne({ _id: new ObjectId(id) });
  return d ? { status: String(d.status), result: text(d.result) } : null;
}
