// One member's whole story in order: joins and leaves, their join application, tickets, punishments,
// AutoMod hits, appeals, staff notes, name and role changes (from the bot logs) and their website account.

import { Long } from "mongodb";
import type { PanelUser } from "./admin";
import { ADMIN_ONLY_LOG_TYPES } from "./bot-logs";
import { getBotCollection, getMongoClient, getUsersCollection } from "./mongodb";
import { queryPunishments } from "./moderation";
import { listNotes } from "./staff-notes";
import { queryTickets } from "./tickets";

export type TimelineKind = "account" | "server" | "join-app" | "ticket" | "punishment" | "automod" | "appeal" | "note" | "watch" | "member" | "website";

export type TimelineEvent = {
  id: string;
  at: string;
  kind: TimelineKind;
  title: string;
  detail: string | null;
  /** Someone else involved (who issued it, closed it, wrote it) */
  by: string | null;
  tone: "neutral" | "good" | "bad" | "warn";
  /** Ticket to open from the row */
  ticket?: { id: number; key: string; transcript: boolean } | null;
};

const DISCORD_EPOCH = BigInt("1420070400000");
const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : typeof v === "string" && !Number.isNaN(Date.parse(v)) ? new Date(v).toISOString() : null);
const site = async () => (await getMongoClient()).db(process.env.MONGODB_DB ?? "website");
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const BAD_ACTIONS = /ban|kick|mute|muzzle|timeout/;

export async function memberTimeline(panel: PanelUser, discordId: string): Promise<TimelineEvent[]> {
  const isAdmin = panel.level === "admin";
  const ids = [discordId, Long.fromString(discordId)];
  const db = await site();
  const safe = <T>(p: Promise<T>, fallback: T) => p.catch(() => fallback);

  const [punishments, tickets, joinApp, automod, appeals, notes, watch, logs, dir, account] = await Promise.all([
    safe(queryPunishments({ userId: discordId, pageSize: 200 }), { rows: [], total: 0 } as unknown as Awaited<ReturnType<typeof queryPunishments>>),
    safe(queryTickets({ userId: discordId, pageSize: 200, excludeNsfw: !isAdmin }), { rows: [], total: 0 } as unknown as Awaited<ReturnType<typeof queryTickets>>),
    safe(getBotCollection("join_applications").then((c) => c.find({ $or: [{ discordId: { $in: ids } }, { discord_id: { $in: ids } }, { userId: { $in: ids } }] } as never).sort({ submittedAt: -1 }).limit(5).toArray()), []),
    safe(getBotCollection("automod_events").then((c) => c.find({ userId: { $in: ids } } as never).sort({ at: -1 }).limit(150).toArray()), []),
    // Appeals (and what members wrote in them) are admin-only
    isAdmin ? safe(db.collection("appeals").find({ discordId }).sort({ createdAt: -1 }).limit(30).toArray(), []) : Promise.resolve([]),
    safe(listNotes(discordId), []),
    safe(getBotCollection("watchlist").then((c) => c.findOne({ _id: discordId as never })), null),
    // Joins, leaves, name and role changes; the punishment and ticket logs repeat what we already have
    safe(
      db
        .collection("bot_logs")
        .find({ userIds: discordId, category: { $in: ["members", "messages"] }, ...(isAdmin ? {} : { type: { $not: ADMIN_ONLY_LOG_TYPES } }) }, { projection: { text: 0, attachments: 0 } })
        .sort({ ts: -1 })
        .limit(150)
        .toArray(),
      [],
    ),
    safe(db.collection("member_directory").findOne({ _id: discordId as never }), null),
    safe(getUsersCollection().then((c) => c.findOne({ discordId }, { projection: { createdAt: 1, emailVerified: 1 } })), null),
  ]);

  const out: TimelineEvent[] = [];
  const push = (e: Omit<TimelineEvent, "at"> & { at: unknown }) => {
    const at = iso(e.at);
    if (at) out.push({ ...e, at });
  };

  // Discord account age, from the id itself
  push({ id: "acct", at: new Date(Number((BigInt(discordId) >> BigInt(22)) + DISCORD_EPOCH)), kind: "account", title: "Discord account created", detail: null, by: null, tone: "neutral" });
  if (account?.createdAt) push({ id: "web", at: account.createdAt, kind: "website", title: "Made a Bear Nation website account", detail: account.emailVerified ? "Email verified" : "Email not verified", by: null, tone: "neutral" });
  if (dir?.joinedAt) push({ id: "joined", at: dir.joinedAt, kind: "server", title: "Joined the server", detail: null, by: null, tone: "good" });
  if (dir?.leftAt && !dir.inServer) push({ id: "left", at: dir.leftAt, kind: "server", title: "Left the server", detail: null, by: null, tone: "warn" });

  for (const a of joinApp) {
    push({ id: `ja-${a._id}`, at: a.submittedAt, kind: "join-app", title: "Sent a join application", detail: typeof a.howFoundServer === "string" ? `Found us: ${a.howFoundServer.slice(0, 120)}` : null, by: null, tone: "neutral" });
    if (a.reviewedAt && a.status && a.status !== "pending") {
      const status = String(a.status);
      push({
        id: `jar-${a._id}`,
        at: a.reviewedAt,
        kind: "join-app",
        title: status === "left" ? "Join application closed (they left)" : `Join application ${status}`,
        detail: typeof a.reason === "string" ? a.reason.slice(0, 200) : null,
        by: a.reviewedBy ? String(a.reviewedBy) : null,
        tone: status === "accepted" ? "good" : status === "denied" || status === "banned" ? "bad" : "neutral",
      });
    }
  }

  for (const t of tickets.rows) {
    const ticket = { id: t.ticketId, key: t.key, transcript: Boolean(t.transcriptId) };
    push({ id: `t-${t.key}`, at: t.created, kind: "ticket", title: `Opened ticket #${t.ticketId}`, detail: t.topic || cap(t.type.replace(/[-_]/g, " ")), by: null, tone: "neutral", ticket });
    if (t.resolvedAt) push({ id: `tc-${t.key}`, at: t.resolvedAt, kind: "ticket", title: `Ticket #${t.ticketId} closed`, detail: null, by: t.resolvedBy ?? t.claimedBy, tone: "neutral", ticket });
  }

  for (const p of punishments.rows) {
    push({
      id: `p-${p.id}`,
      at: p.timestamp,
      kind: "punishment",
      title: cap(p.action.replace(/_/g, " ")) + (p.source === "automod" ? " (AutoMod)" : ""),
      detail: p.reason || null,
      by: p.source === "automod" ? null : p.issuerId,
      tone: BAD_ACTIONS.test(p.action) ? "bad" : "warn",
    });
  }

  for (const e of automod) {
    // Punishments AutoMod handed out are already listed; these are the alerts and deletions
    if (["warn", "mute", "timeout", "kick", "ban"].includes(String(e.action))) continue;
    push({ id: `am-${e._id}`, at: e.at, kind: "automod", title: `AutoMod ${e.action === "alert" ? "flagged a message" : "deleted a message"}`, detail: `Rule: ${String(e.rule ?? "?").replace(/[-_]/g, " ")}`, by: null, tone: "warn" });
  }

  for (const a of appeals) {
    push({ id: `ap-${a._id}`, at: a.createdAt, kind: "appeal", title: "Appealed a punishment", detail: typeof a.message === "string" ? a.message.slice(0, 200) : null, by: null, tone: "neutral" });
    if (a.decidedAt) push({ id: `apd-${a._id}`, at: a.decidedAt, kind: "appeal", title: `Appeal ${a.status}`, detail: null, by: a.decidedById ? String(a.decidedById) : null, tone: a.status === "accepted" ? "good" : "bad" });
  }

  for (const n of notes) push({ id: `n-${n.id}`, at: n.at, kind: "note", title: n.pinned ? "Staff note (pinned)" : "Staff note", detail: n.text, by: n.by, tone: "neutral" });
  if (watch) push({ id: "watch", at: watch.at, kind: "watch", title: "Added to the watchlist", detail: String(watch.reason ?? ""), by: watch.by ? String(watch.by) : null, tone: "warn" });

  for (const l of logs) {
    const type = String(l.type ?? "");
    if (/^message (sent|edited)/i.test(type)) continue;
    const joinedLeft = /member (joined|left)/i.test(type);
    // The member directory already covers their current join; skip the duplicate
    if (joinedLeft && dir?.joinedAt && Math.abs(new Date(l.ts).getTime() - new Date(dir.joinedAt).getTime()) < 120_000) continue;
    push({
      id: `l-${l._id}`,
      at: l.ts,
      kind: joinedLeft ? "server" : "member",
      title: type,
      detail: typeof l.description === "string" ? l.description.replace(/<@!?\d+>/g, "").replace(/\*\*/g, "").slice(0, 200) : null,
      by: null,
      tone: /left/i.test(type) ? "warn" : /joined/i.test(type) ? "good" : "neutral",
    });
  }

  return out.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 400);
}
