// Admin → Website → Admin log: every change made in the panel (website.admin_audit), searchable, with Undo for
// the ones that can be reversed safely. An undone entry is marked {undoneAt, undoneBy, undoneByName}.

import { ObjectId, type Document } from "mongodb";
import type { PanelUser } from "./admin";
import { changeMemberRole } from "./admin-roles";
import { markFalsePositive } from "./automod-fp";
import { setMaintenance } from "./maintenance";
import { bulkRoleBatch } from "./members-manager";
import { getBotCollection, getMongoClient } from "./mongodb";
import { setWatch } from "./staff-notes";

const LABELS: Record<string, string> = {
  "role-add": "Gave a role",
  "role-remove": "Took a role",
  "bulk-role-add": "Gave a role to many members",
  "bulk-role-remove": "Took a role from many members",
  "watchlist-add": "Added to the watchlist",
  "watchlist-remove": "Removed from the watchlist",
  "staff-note-delete": "Deleted a staff note",
  "report-handled": "Marked a report handled",
  "report-dismissed": "Dismissed a report",
  "automod-false-positive": "Marked an AutoMod catch as a mistake",
  "maintenance-on": "Turned on maintenance mode",
  "maintenance-off": "Turned off maintenance mode",
  "announcement-sent": "Posted an announcement",
  "announcement-scheduled": "Scheduled an announcement",
  "reply-template-add": "Added a saved reply",
  "reply-template-edit": "Edited a saved reply",
  "reply-template-delete": "Deleted a saved reply",
  "bot-power": "Started / stopped a bot",
  "bot-issues-resolve": "Marked bot problems fixed",
  "wipe-member": "Wiped a member's data",
  "live-message-delete": "Deleted a message (Live Chat)",
  "undo": "Undid a change",
};

/** What Undo does for each action (only these can be undone). */
const UNDO: Record<string, string> = {
  "role-add": "Takes the role back",
  "role-remove": "Gives the role back",
  "bulk-role-add": "Takes the role back from everyone it was given to",
  "bulk-role-remove": "Gives the role back to everyone it was taken from",
  "watchlist-add": "Takes them off the watchlist",
  "report-handled": "Reopens the report",
  "report-dismissed": "Reopens the report",
  "automod-false-positive": "Puts the strike back",
  "maintenance-on": "Turns maintenance mode off",
};

export type LogEntry = { id: string; at: string; action: string; label: string; adminDiscordId: string; adminName: string; target: string | null; summary: string; undo: string | null; undone: { at: string; byName: string } | null };

const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : "");
async function col() {
  return (await getMongoClient()).db(process.env.MONGODB_DB ?? "website").collection("admin_audit");
}

function summarize(d: Document) {
  const bits: string[] = [];
  if (d.roleName) bits.push(`@${d.roleName}`);
  if (Array.isArray(d.members)) bits.push(`${d.members.length} member${d.members.length === 1 ? "" : "s"}`);
  if (d.reason) bits.push(String(d.reason).slice(0, 120));
  if (d.note) bits.push(String(d.note).slice(0, 120));
  if (d.name) bits.push(String(d.name).slice(0, 80));
  if (d.signal) bits.push(`${d.signal} ${d.server ?? ""}`.trim());
  if (d.message && typeof d.message === "string") bits.push(d.message.slice(0, 120));
  if (d.rule) bits.push(`rule: ${d.rule}`);
  if (typeof d.count === "number") bits.push(`${d.count}`);
  return bits.join(" · ");
}

const toEntry = (d: Document): LogEntry => ({
  id: String(d._id),
  at: iso(d.at),
  action: String(d.action ?? ""),
  label: LABELS[String(d.action)] ?? String(d.action ?? "").replace(/[-_]/g, " "),
  adminDiscordId: String(d.adminDiscordId ?? ""),
  adminName: String(d.adminName ?? ""),
  target: d.targetDiscordId ? String(d.targetDiscordId) : null,
  summary: summarize(d),
  undo: d.undoneAt || !UNDO[String(d.action)] ? null : UNDO[String(d.action)],
  undone: d.undoneAt ? { at: iso(d.undoneAt), byName: String(d.undoneByName ?? "") } : null,
});

export async function listAdminLog(q: { admin?: string; action?: string; target?: string; before?: string }) {
  const filter: Document = {};
  if (q.admin && /^\d{15,21}$/.test(q.admin)) filter.adminDiscordId = q.admin;
  if (q.action) filter.action = q.action;
  if (q.target && /^\d{15,21}$/.test(q.target)) filter.targetDiscordId = q.target;
  if (q.before && ObjectId.isValid(q.before)) filter._id = { $lt: new ObjectId(q.before) };
  const c = await col();
  const [rows, actions, admins] = await Promise.all([
    c.find(filter).sort({ _id: -1 }).limit(50).toArray(),
    c.aggregate([{ $group: { _id: "$action", n: { $sum: 1 } } }, { $sort: { n: -1 } }, { $limit: 60 }]).toArray(),
    c.aggregate([{ $group: { _id: "$adminDiscordId", name: { $last: "$adminName" }, n: { $sum: 1 } } }, { $sort: { n: -1 } }, { $limit: 40 }]).toArray(),
  ]);
  return {
    entries: rows.map(toEntry),
    actions: actions.filter((a) => a._id).map((a) => ({ action: String(a._id), label: LABELS[String(a._id)] ?? String(a._id), n: Number(a.n) })),
    admins: admins.filter((a) => a._id).map((a) => ({ id: String(a._id), name: String(a.name ?? ""), n: Number(a.n) })),
  };
}

export class UndoError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

export async function undoEntry(panel: PanelUser, id: string) {
  if (!ObjectId.isValid(id)) throw new UndoError("Not found.", 404);
  const c = await col();
  // Claim it first so two people can't undo the same change twice
  const d = await c.findOneAndUpdate({ _id: new ObjectId(id), undoneAt: { $exists: false } }, { $set: { undoneAt: new Date(), undoneBy: panel.discordId, undoneByName: panel.name } });
  if (!d) throw new UndoError("That's already been undone (or doesn't exist).", 409);
  const release = () => c.updateOne({ _id: d._id }, { $unset: { undoneAt: "", undoneBy: "", undoneByName: "" } });
  try {
    switch (d.action) {
      case "role-add":
      case "role-remove":
        await changeMemberRole(panel, String(d.targetDiscordId), String(d.roleId), d.action === "role-remove");
        break;
      case "bulk-role-add":
      case "bulk-role-remove": {
        const ids = ((d.members ?? []) as string[]).map(String);
        for (let i = 0; i < ids.length; i += 25) await bulkRoleBatch(panel, String(d.roleId), d.action === "bulk-role-remove", ids.slice(i, i + 25));
        break;
      }
      case "watchlist-add":
        await setWatch(panel, String(d.targetDiscordId), false);
        break;
      case "report-handled":
      case "report-dismissed": {
        if (!ObjectId.isValid(String(d.reportId))) throw new UndoError("That report is gone.");
        await (await getBotCollection("reports")).updateOne({ _id: new ObjectId(String(d.reportId)) }, { $set: { status: "open" }, $unset: { outcome: "" } });
        break;
      }
      case "automod-false-positive":
        await markFalsePositive(panel, String(d.eventId), { undo: true });
        break;
      case "maintenance-on":
        await setMaintenance(panel, { on: false, message: d.message ?? "" });
        break;
      default:
        throw new UndoError("That change can't be undone from here.");
    }
  } catch (error) {
    await release();
    throw error instanceof UndoError ? error : new UndoError(error instanceof Error ? error.message : "Undo didn't work.");
  }
  await c.insertOne({ at: new Date(), action: "undo", undid: String(d._id), undidAction: d.action, targetDiscordId: d.targetDiscordId ?? null, adminDiscordId: panel.discordId, adminName: panel.name });
}
