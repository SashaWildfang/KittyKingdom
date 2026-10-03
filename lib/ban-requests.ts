// Ban requests from Jr Mods (Discord /ban), waiting for a Mod+ to approve or deny. They live in `ban_requests`
// (website database), shared with the moderation bot: it posts each one in the staff alerts channel with
// Approve / Deny buttons, and carries out approvals made here (status "approved" → it bans → "executed").

import { ObjectId, type Document } from "mongodb";
import { people } from "./admin-people";
import { getCurrentBans } from "./moderation";
import { getMongoClient } from "./mongodb";
import { rankIndex } from "./staff-guide-data";
import { staffRank } from "./staff-guide";

export type BanRequestStatus = "pending" | "approved" | "executing" | "executed" | "denied" | "failed" | "cancelled";
export type BanRequest = {
  id: string;
  user: { id: string; name: string; avatar: string | null };
  requester: { id: string; name: string };
  reviewer: { id: string; name: string } | null;
  reason: string;
  appealable: boolean;
  status: BanRequestStatus;
  createdAt: string;
  reviewedAt: string | null;
  reviewedVia: string | null;
  reviewNote: string | null;
  result: string | null;
  alreadyBanned: boolean;
};

export class BanRequestError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

async function col() {
  return (await getMongoClient()).db(process.env.MONGODB_DB ?? "website").collection("ban_requests");
}

/** Mods and up review ban requests. */
export async function canReviewBans(discordId: string) {
  const rank = await staffRank(discordId).catch(() => null);
  return Boolean(rank && rankIndex(rank) >= rankIndex("Mod"));
}

export async function listBanRequests(filter: "pending" | "all" = "pending") {
  const c = await col();
  const q: Document = filter === "pending" ? { status: { $in: ["pending", "approved", "executing"] } } : {};
  const [docs, pending, bans] = await Promise.all([
    c.find(q).sort({ createdAt: -1 }).limit(filter === "pending" ? 100 : 200).toArray(),
    c.countDocuments({ status: "pending" }),
    getCurrentBans().catch(() => null),
  ]);
  const ids = Array.from(new Set(docs.flatMap((d) => [String(d.userId), String(d.requesterId), d.reviewedBy ? String(d.reviewedBy) : ""]).filter(Boolean)));
  const who = await people(ids).catch(() => ({}) as Record<string, { name: string; avatar: string | null }>);
  const name = (id: string, fallback?: unknown) => who[id]?.name ?? (fallback ? String(fallback) : "Unknown member");
  const requests: BanRequest[] = docs.map((d) => ({
    id: String(d._id),
    user: { id: String(d.userId), name: name(String(d.userId), d.userName), avatar: who[String(d.userId)]?.avatar ?? null },
    requester: { id: String(d.requesterId), name: name(String(d.requesterId), d.requesterName) },
    reviewer: d.reviewedBy ? { id: String(d.reviewedBy), name: name(String(d.reviewedBy)) } : null,
    reason: String(d.reason ?? ""),
    appealable: d.appealable !== false,
    status: d.status as BanRequestStatus,
    createdAt: (d.createdAt instanceof Date ? d.createdAt : new Date(0)).toISOString(),
    reviewedAt: d.reviewedAt instanceof Date ? d.reviewedAt.toISOString() : null,
    reviewedVia: d.reviewedVia ? String(d.reviewedVia) : null,
    reviewNote: d.reviewNote ? String(d.reviewNote) : null,
    result: d.result ? String(d.result) : null,
    alreadyBanned: Boolean(bans?.has(String(d.userId))),
  }));
  return { requests, pending };
}

export async function pendingBanRequests() {
  return (await col()).countDocuments({ status: "pending" });
}

/** A Mod+ approves (the bot bans) or denies a request. Approving needs "CONFIRM" typed. */
export async function decideBanRequest(id: string, reviewer: { discordId: string; name: string }, decision: "approve" | "deny", note: string, confirm: string) {
  if (!ObjectId.isValid(id)) throw new BanRequestError("That request doesn't exist.", 404);
  if (!(await canReviewBans(reviewer.discordId))) throw new BanRequestError("Only Mods and up can review ban requests.", 403);
  const c = await col();
  const req = await c.findOne({ _id: new ObjectId(id) });
  if (!req) throw new BanRequestError("That request doesn't exist.", 404);
  if (req.status !== "pending") throw new BanRequestError("Someone already dealt with this request.", 409);
  if (String(req.requesterId) === reviewer.discordId) throw new BanRequestError("You can't review your own request.", 403);
  const cleanNote = note.trim().slice(0, 500);

  if (decision === "deny") {
    if (!cleanNote) throw new BanRequestError("Say why you're denying it (the requester sees this).");
    const done = await c.findOneAndUpdate(
      { _id: req._id, status: "pending" },
      { $set: { status: "denied", reviewedBy: reviewer.discordId, reviewedAt: new Date(), reviewedVia: "website", reviewNote: cleanNote } },
      { returnDocument: "after" },
    );
    if (!done) throw new BanRequestError("Someone already dealt with this request.", 409);
    return { status: "denied" as const };
  }

  if (confirm.trim() !== "CONFIRM") throw new BanRequestError('Type CONFIRM to approve the ban.');
  // Already banned some other way? Close it instead of banning twice
  const bans = await getCurrentBans().catch(() => null);
  if (bans?.has(String(req.userId))) {
    await c.updateOne({ _id: req._id, status: "pending" }, { $set: { status: "cancelled", result: "They were already banned.", reviewedBy: reviewer.discordId, reviewedAt: new Date(), reviewedVia: "website" } });
    throw new BanRequestError("They're already banned, so the request was closed.", 409);
  }
  const done = await c.findOneAndUpdate(
    { _id: req._id, status: "pending" },
    { $set: { status: "approved", reviewedBy: reviewer.discordId, reviewedAt: new Date(), reviewedVia: "website", ...(cleanNote ? { reviewNote: cleanNote } : {}) } },
    { returnDocument: "after" },
  );
  if (!done) throw new BanRequestError("Someone already dealt with this request.", 409);
  return { status: "approved" as const };
}
