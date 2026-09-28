// Reports from members about profiles, photos and messages. Staff see only what was reported: a
// reported message comes with two messages before and after for context, nothing else from the chat.
//   dating_reports {type, reporter, reported, reason, details, photoId?, messageId?, snapshot, at, status, handledBy?, action?}

import { ObjectId } from "mongodb";
import { getMongoClient } from "../mongodb";
import { datingCols, toLong } from "./db";
import { deletePhoto } from "./media";
import { messageWithContext } from "./messages";
import { profileView } from "./profiles";

export const REPORT_REASONS = ["Harassment or bullying", "Hate or slurs", "Spam or scam", "Underage", "Not SFW / explicit photo", "Fake or impersonation", "Threats or safety concern", "Something else"];

async function col() {
  return (await getMongoClient()).db(process.env.MONGODB_DB ?? "website").collection("dating_reports");
}

export async function fileReport(reporter: string, input: { type: string; target: string; reason: string; details?: string; photoId?: string; messageId?: string }) {
  if (!REPORT_REASONS.includes(input.reason)) return "Pick a reason.";
  if (!/^\d{15,21}$/.test(input.target) || input.target === reporter) return "Unknown member.";
  const type = ["profile", "photo", "message"].includes(input.type) ? input.type : "profile";
  let snapshot: unknown = null;
  if (type === "message") {
    if (!input.messageId) return "Unknown message.";
    const ctx = await messageWithContext(input.messageId);
    // You can only report a message sent to you
    if (!ctx || ctx.to !== reporter || ctx.from !== input.target) return "You can only report messages sent to you.";
    snapshot = ctx;
  } else {
    const doc = await (await datingCols()).profiles.findOne({ _id: toLong(input.target) } as never);
    if (!doc) return "That profile doesn't exist anymore.";
    snapshot = await profileView(doc);
    if (type === "photo" && !((doc.photos ?? []) as { id: string }[]).some((p) => p.id === input.photoId)) return "That photo was already removed.";
  }
  const c = await col();
  // One open report per reporter/target/type is enough
  await c.updateOne(
    { reporter, reported: input.target, type, status: "open", ...(input.messageId ? { messageId: input.messageId } : {}), ...(input.photoId ? { photoId: input.photoId } : {}) },
    { $set: { reason: input.reason, details: String(input.details ?? "").slice(0, 1000), snapshot, at: new Date() }, $setOnInsert: { status: "open" } },
    { upsert: true },
  );
  return null;
}

export async function listReports(status: "open" | "closed" | "all" = "open") {
  const c = await col();
  const rows = await c.find(status === "all" ? {} : { status }).sort({ at: -1 }).limit(200).toArray();
  return rows.map((r) => ({
    id: String(r._id),
    type: String(r.type),
    reporter: String(r.reporter),
    reported: String(r.reported),
    reason: String(r.reason),
    details: String(r.details ?? ""),
    photoId: r.photoId ? String(r.photoId) : null,
    snapshot: r.snapshot,
    at: (r.at as Date).toISOString(),
    status: String(r.status),
    handledBy: r.handledBy ? String(r.handledBy) : null,
    action: r.action ? String(r.action) : null,
  }));
}

export async function openReportCount() {
  return (await col()).countDocuments({ status: "open" });
}

/** Staff decision on a report: dismiss, remove the reported photo, or pause the profile. */
export async function resolveReport(id: string, action: "dismiss" | "remove-photo" | "pause-profile", staff: string) {
  if (!ObjectId.isValid(id)) return "Unknown report.";
  const c = await col();
  const r = await c.findOne({ _id: new ObjectId(id) });
  if (!r) return "Unknown report.";
  const { profiles } = await datingCols();
  if (action === "remove-photo" && r.photoId) {
    await profiles.updateOne({ _id: toLong(String(r.reported)) } as never, { $pull: { photos: { id: String(r.photoId) } } } as never);
    await deletePhoto(String(r.photoId));
  }
  if (action === "pause-profile") await profiles.updateOne({ _id: toLong(String(r.reported)) } as never, { $set: { "web.paused": true, "web.pausedByStaff": true } });
  await c.updateOne({ _id: r._id }, { $set: { status: "closed", action, handledBy: staff, handledAt: new Date() } });
  return null;
}
