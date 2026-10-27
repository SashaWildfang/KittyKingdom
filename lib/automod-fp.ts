// AutoMod false positives: staff mark a catch as a mistake. That takes back its strike (the strike's decay
// time is set to now, so it stops counting toward AutoMod's escalating mutes), can add the matched word to the
// allow list (admins), and is counted per rule so you can see which rules misfire.
//
// automod_events.falsePositive {by, byName, at, note, strikesCleared, allowed}

import { Long, ObjectId, type Document } from "mongodb";
import type { PanelUser } from "./admin";
import { applyChange, planChange } from "./automod";
import { getBotCollection, getMongoClient } from "./mongodb";

export class FalsePositiveError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

export async function markFalsePositive(panel: PanelUser, id: string, input: { note?: unknown; allow?: unknown; undo?: unknown }) {
  if (!ObjectId.isValid(id)) throw new FalsePositiveError("That catch wasn't found.", 404);
  const events = await getBotCollection("automod_events");
  const e = await events.findOne({ _id: new ObjectId(id) });
  if (!e) throw new FalsePositiveError("That catch wasn't found.", 404);

  if (input.undo) {
    await events.updateOne({ _id: e._id }, { $unset: { falsePositive: "" } });
    return { strikesCleared: 0, allowed: null as string | null };
  }

  // The strike AutoMod recorded with this catch (same member, within a minute of it)
  let strikesCleared = 0;
  if (e.action === "punish" && e.userId && e.at instanceof Date) {
    const uid = String(e.userId);
    const ids: unknown[] = [uid, Long.fromString(uid)];
    const res = await (await getBotCollection("punishments")).updateMany(
      { discordId: { $in: ids }, extraInfo: { $exists: true }, timestamp: { $gte: new Date(e.at.getTime() - 60_000), $lte: new Date(e.at.getTime() + 60_000) }, falsePositive: { $ne: true } } as never,
      { $set: { expiresAt: new Date(), falsePositive: true, falsePositiveBy: panel.discordId } },
    );
    strikesCleared = res.modifiedCount;
  }

  let allowed: string | null = null;
  if (input.allow && e.term) {
    if (panel.level !== "admin") throw new FalsePositiveError("Only admins can change the allow list.", 403);
    const plan = await planChange({ type: "allow", w: String(e.term) }, panel.level);
    if (typeof plan === "string") throw new FalsePositiveError(plan);
    await applyChange(plan, panel);
    allowed = String(e.term);
  }

  const note = String(input.note ?? "").trim().slice(0, 300);
  await events.updateOne({ _id: e._id }, { $set: { falsePositive: { by: panel.discordId, byName: panel.name, at: new Date(), note, strikesCleared, allowed } } });
  await (await getMongoClient())
    .db(process.env.MONGODB_DB ?? "website")
    .collection("admin_audit")
    .insertOne({ at: new Date(), action: "automod-false-positive", eventId: id, rule: e.rule, targetDiscordId: e.userId ? String(e.userId) : null, strikesCleared, allowed, note, adminDiscordId: panel.discordId, adminName: panel.name })
    .catch(() => undefined);
  return { strikesCleared, allowed };
}

/** Per rule over the last `days`: how many catches, and how many staff marked as false positives. */
export async function falsePositiveRates(days = 30) {
  const from = new Date(Date.now() - days * 86_400_000);
  const rows = (await (await getBotCollection("automod_events"))
    .aggregate([{ $match: { at: { $gte: from }, rule: { $ne: "raid" } } }, { $group: { _id: "$rule", total: { $sum: 1 }, fp: { $sum: { $cond: [{ $ifNull: ["$falsePositive", false] }, 1, 0] } } } }, { $sort: { fp: -1, total: -1 } }])
    .toArray()) as Document[];
  return rows.map((r) => ({ rule: String(r._id), total: Number(r.total), falsePositives: Number(r.fp) }));
}
