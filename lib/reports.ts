// Message reports from Discord (right-click a message → Apps → Report message, in the Moderation Bot).
// zeo_bot.reports: one document per reported message; more reporters stack onto it. See cmds/report_message.py.

import { ObjectId, type Document } from "mongodb";
import type { PanelUser } from "./admin";
import { deleteChannelMessage, postChannelMessage } from "./discord-member";
import { getBotCollection, getMongoClient } from "./mongodb";

export type ReportStatus = "open" | "handled" | "dismissed";
export type Report = {
  id: string;
  messageId: string;
  channelId: string;
  jump: string | null;
  authorId: string;
  authorName: string;
  content: string;
  attachments: string[];
  messageAt: string | null;
  reporters: { id: string; name: string; reason: string; at: string }[];
  count: number;
  status: ReportStatus;
  createdAt: string;
  lastReportAt: string;
  outcome: { by: string; byName: string; at: string; note: string; messageDeleted: boolean } | null;
};

export class ReportError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : null);
const toReport = (d: Document): Report => ({
  id: String(d._id),
  messageId: String(d.messageId),
  channelId: String(d.channelId ?? ""),
  jump: typeof d.jump === "string" ? d.jump : null,
  authorId: String(d.authorId ?? ""),
  authorName: String(d.authorName ?? "Member"),
  content: String(d.content ?? ""),
  attachments: Array.isArray(d.attachments) ? d.attachments.map(String) : [],
  messageAt: iso(d.messageAt),
  reporters: (Array.isArray(d.reporters) ? d.reporters : []).map((r: Document) => ({ id: String(r.id), name: String(r.name ?? ""), reason: String(r.reason ?? ""), at: iso(r.at) ?? "" })),
  count: Number(d.count ?? 1),
  status: (["open", "handled", "dismissed"].includes(String(d.status)) ? d.status : "open") as ReportStatus,
  createdAt: iso(d.createdAt) ?? "",
  lastReportAt: iso(d.lastReportAt) ?? iso(d.createdAt) ?? "",
  outcome: d.outcome ? { by: String(d.outcome.by ?? ""), byName: String(d.outcome.byName ?? ""), at: iso(d.outcome.at) ?? "", note: String(d.outcome.note ?? ""), messageDeleted: Boolean(d.outcome.messageDeleted) } : null,
});

export async function listReports(status: ReportStatus | "all", page = 1) {
  const c = await getBotCollection("reports");
  const filter = status === "all" ? {} : { status };
  const size = 25;
  const [rows, total, counts] = await Promise.all([
    c.find(filter).sort(status === "open" ? { lastReportAt: 1 } : { lastReportAt: -1 }).skip((Math.max(1, page) - 1) * size).limit(size).toArray(),
    c.countDocuments(filter),
    c.aggregate([{ $group: { _id: "$status", n: { $sum: 1 } } }]).toArray(),
  ]);
  return { reports: rows.map(toReport), total, pageSize: size, counts: Object.fromEntries(counts.map((x) => [String(x._id), Number(x.n)])) as Record<string, number> };
}

/** Past reports against the same member (for context while deciding). */
export async function reportsAbout(authorId: string, exceptId?: string) {
  const c = await getBotCollection("reports");
  const rows = await c.find({ authorId, ...(exceptId && ObjectId.isValid(exceptId) ? { _id: { $ne: new ObjectId(exceptId) } } : {}) }).sort({ createdAt: -1 }).limit(10).toArray();
  return rows.map(toReport);
}

/** Close a report: handled (with what was done) or dismissed. Optionally deletes the reported message. */
export async function resolveReport(panel: PanelUser, id: string, input: { status?: unknown; note?: unknown; deleteMessage?: unknown }) {
  if (!ObjectId.isValid(id)) throw new ReportError("Report not found.", 404);
  const status = String(input.status ?? "");
  if (!["handled", "dismissed", "open"].includes(status)) throw new ReportError("Pick handled, dismissed or reopen.");
  const c = await getBotCollection("reports");
  const report = await c.findOne({ _id: new ObjectId(id) });
  if (!report) throw new ReportError("Report not found.", 404);
  if (status === "open") {
    await c.updateOne({ _id: report._id }, { $set: { status: "open" }, $unset: { outcome: "" } });
    return;
  }
  let messageDeleted = false;
  if (input.deleteMessage && status === "handled") {
    const r = await deleteChannelMessage(String(report.channelId), String(report.messageId), `Reported message removed from the website by ${panel.name}`);
    if (!r.ok) throw new ReportError(r.status === 403 ? "The bot isn't allowed to delete messages in that channel." : "Discord didn't delete the message. Try again.", 502);
    messageDeleted = true;
    // The same notice the bot's right-click actions post: what was removed (behind a spoiler), never who removed it
    const text = String(report.content ?? "").replace(/\|\|/g, "|\u200b|").trim();
    const files = Array.isArray(report.attachments) ? report.attachments.length : 0;
    const quote = [text ? `||${text.length > 700 ? `${text.slice(0, 700)}…` : text}||` : "", files ? `*${files} attachment${files === 1 ? "" : "s"}*` : ""].filter(Boolean).join(" ") || "*no text*";
    await postChannelMessage(String(report.channelId), {
      embeds: [
        {
          author: { name: "🛡️ Moderation" },
          description: `<@${report.authorId}> had a reported message **removed**.\n**Reason:** Breaking the server rules\n**Message:** ${quote}`,
          color: 0xd56300,
          footer: { text: "Questions? Open a support ticket. Think it's a mistake? bear-nation.net/appeals" },
          timestamp: new Date().toISOString(),
        },
      ],
    }).catch(() => undefined);
  }
  const note = String(input.note ?? "").trim().slice(0, 500);
  await c.updateOne({ _id: report._id }, { $set: { status, outcome: { by: panel.discordId, byName: panel.name, at: new Date(), note, messageDeleted } } });
  await (await getMongoClient())
    .db(process.env.MONGODB_DB ?? "website")
    .collection("admin_audit")
    .insertOne({ at: new Date(), action: `report-${status}`, reportId: id, targetDiscordId: String(report.authorId), note, messageDeleted, adminDiscordId: panel.discordId, adminName: panel.name })
    .catch(() => undefined);
}

export async function openReportCount() {
  return (await getBotCollection("reports")).countDocuments({ status: "open" });
}
