// Tickets from people who left are deleted automatically: every closed ticket they opened (NSFW verification
// included, but never ones staff opened with /ticket create) and its transcript upload, once the grace period after they left has passed (Admin → Bots →
// Ticket Bot → Leaver clean-up). If they rejoin in time, nothing is deleted.
//
// Runs off the Main Bot's minute check (app/api/status/ping), a few tickets at a time, so the first run works
// through the backlog over a few minutes. Someone only counts as gone when the full member list agrees AND
// Discord says "Unknown Member" for them; any doubt (Discord errors, no member list yet) skips them.
// Remaining tickets are renumbered once the backlog is cleared, and each sweep is logged in the bot logs channel.

import type { PanelUser } from "./admin";
import { getBotSettings } from "./bot-settings/store";
import { isInServer, postChannelMessage } from "./discord-member";
import { inServerIds } from "./member-directory";
import { getBotCollection, getMongoClient } from "./mongodb";
import { STAFF_LOG_CHANNEL_ID, TicketDeleteError, removeTicket, renumberTickets } from "./ticket-delete";

const STATE_ID = "ticket_autoclean";
const EVERY_MS = 10 * 60_000;
const NSFW = /nsfw/i;
const SYSTEM: PanelUser = { discordId: "", name: "Leaver clean-up", level: "admin", websiteUserId: "" };

type State = {
  _id: string;
  lastRunAt?: Date;
  lockUntil?: Date;
  /** Totals for the sweep in progress (logged and reset once the backlog is cleared) */
  pending?: { tickets: number; nsfw: number; members: string[] };
  lastSweep?: { at: Date; tickets: number; nsfw: number; members: number };
  totalDeleted?: number;
};

async function stateCol() {
  return (await getMongoClient()).db(process.env.MONGODB_DB ?? "website").collection<State>("job_state");
}

export async function autoCleanupSettings() {
  const v = (await getBotSettings("ticketing").catch(() => null))?.values ?? {};
  return { enabled: v["tickets.leaverCleanup"] !== false, graceDays: Math.max(0, Math.min(90, Number(v["tickets.leaverGraceDays"] ?? 3))) };
}

/** For Admin → Tickets: is it on, and what has it done. */
export async function autoCleanupStatus() {
  const [settings, state] = await Promise.all([autoCleanupSettings(), (await stateCol()).findOne({ _id: STATE_ID })]);
  const iso = (d: unknown) => (d instanceof Date ? d.toISOString() : null);
  return {
    ...settings,
    lastRunAt: iso(state?.lastRunAt),
    totalDeleted: state?.totalDeleted ?? 0,
    working: Boolean(state?.pending?.tickets),
    lastSweep: state?.lastSweep ? { at: iso(state.lastSweep.at), tickets: state.lastSweep.tickets, nsfw: state.lastSweep.nsfw, members: state.lastSweep.members } : null,
  };
}

/** Deletes leavers' closed tickets for at most `budgetMs`. Never throws. */
export async function runTicketAutoCleanup(budgetMs = 8_000) {
  const deadline = Date.now() + budgetMs;
  const col = await stateCol();
  const now = new Date();
  await col.updateOne({ _id: STATE_ID }, { $setOnInsert: { lastRunAt: new Date(0) } }, { upsert: true });
  // One run at a time, at most every 10 minutes (sooner while there's a backlog)
  const claimed = await col.findOneAndUpdate(
    {
      _id: STATE_ID,
      $and: [
        { $or: [{ lastRunAt: { $lt: new Date(now.getTime() - EVERY_MS) } }, { "pending.tickets": { $gt: 0 } }] },
        { $or: [{ lockUntil: { $exists: false } }, { lockUntil: { $lt: now } }] },
      ],
    },
    { $set: { lockUntil: new Date(now.getTime() + 60_000) } },
  );
  if (!claimed) return;
  const pending = { tickets: 0, nsfw: 0, members: [] as string[], ...(claimed.pending ?? {}) };
  let backlogLeft = false;
  try {
    const settings = await autoCleanupSettings();
    if (!settings.enabled) return;
    const members = await inServerIds();
    if (!members || members.length < 10) return; // no trustworthy member list yet
    const here = new Set(members);

    const resolved = await getBotCollection("resolvedTickets");
    // Tickets staff opened themselves (/ticket create) are never deleted automatically
    const AUTO = { manual_ticket: { $ne: true } } as never;
    const openers = (await resolved.distinct("opened_by", AUTO)).map(String).filter((id) => /^\d{15,21}$/.test(id) && !here.has(id));
    if (!openers.length) return;
    const dir = (await getMongoClient()).db(process.env.MONGODB_DB ?? "website").collection<{ _id: string; leftAt?: Date | null }>("member_directory");
    const leftAt = new Map((await dir.find({ _id: { $in: openers } }, { projection: { leftAt: 1 } }).toArray()).map((d) => [d._id, d.leftAt ?? null]));
    const cutoff = now.getTime() - settings.graceDays * 86_400_000;
    // No leave date means they left before it was recorded: long past any grace period
    const due = openers.filter((id) => {
      const at = leftAt.get(id);
      return !(at instanceof Date) || at.getTime() <= cutoff;
    });

    for (const id of due) {
      if (Date.now() > deadline) {
        backlogLeft = true;
        break;
      }
      if ((await isInServer(id)) !== false) continue; // back already, or Discord couldn't say
      const docs = await resolved.find({ opened_by: id, manual_ticket: { $ne: true } } as never).sort({ ticket_id: 1 }).toArray();
      let removedAny = false;
      for (const doc of docs) {
        if (Date.now() > deadline) {
          backlogLeft = true;
          break;
        }
        await removeTicket(SYSTEM, doc, "auto");
        pending.tickets++;
        if (NSFW.test(String(doc.ticket_type ?? ""))) pending.nsfw++;
        removedAny = true;
      }
      if (removedAny && !pending.members.includes(id)) pending.members.push(id);
      if (backlogLeft) break;
    }
  } catch (error) {
    // Discord busy etc.: whatever was deleted stays deleted, the rest waits for the next run
    backlogLeft = true;
    if (!(error instanceof TicketDeleteError)) console.error("Ticket auto clean-up stopped", error);
  } finally {
    const set: Partial<State> = { lastRunAt: new Date(), pending };
    if (!backlogLeft && pending.tickets) {
      // Backlog cleared: close the number gaps and log the sweep
      const renumbered = await renumberTickets().catch(() => null);
      await logSweep(pending, renumbered?.total ?? null).catch(() => false);
      set.lastSweep = { at: new Date(), tickets: pending.tickets, nsfw: pending.nsfw, members: pending.members.length };
      set.pending = { tickets: 0, nsfw: 0, members: [] };
    }
    // Gaps left below tickets that were open or just closed during an earlier renumber: close them once they settle
    if (!backlogLeft && !pending.tickets) await closeGaps().catch(() => undefined);
    const added = pending.tickets - (claimed.pending?.tickets ?? 0);
    await col.updateOne({ _id: STATE_ID }, { $set: set, $unset: { lockUntil: "" }, ...(added > 0 ? { $inc: { totalDeleted: added } } : {}) }).catch(() => undefined);
  }
}

/** Renumbers when the numbers have gaps (more numbers than tickets). */
async function closeGaps() {
  const [active, resolved] = await Promise.all([getBotCollection("activeTickets"), getBotCollection("resolvedTickets")]);
  const [a, r, topA, topR] = await Promise.all([
    active.countDocuments(),
    resolved.countDocuments(),
    active.find({}, { projection: { ticket_id: 1 } }).sort({ ticket_id: -1 }).limit(1).toArray(),
    resolved.find({}, { projection: { ticket_id: 1 } }).sort({ ticket_id: -1 }).limit(1).toArray(),
  ]);
  const highest = Math.max(0, Number(topA[0]?.ticket_id ?? 0), Number(topR[0]?.ticket_id ?? 0));
  if (highest > a + r) await renumberTickets();
}

async function logSweep(p: { tickets: number; nsfw: number; members: string[] }, total: number | null) {
  const shown = p.members.slice(0, 25).map((id) => `<@${id}>`).join(" ");
  const more = p.members.length > 25 ? ` and ${p.members.length - 25} more` : "";
  return postChannelMessage(STAFF_LOG_CHANNEL_ID, {
    embeds: [
      {
        title: "🧹 Tickets from members who left were deleted",
        color: 0xe5484d,
        description:
          `**${p.tickets}** closed ticket${p.tickets === 1 ? "" : "s"} and ${p.tickets === 1 ? "its transcript" : "their transcripts"} deleted` +
          `${p.nsfw ? ` (${p.nsfw} NSFW verification)` : ""}, from **${p.members.length}** member${p.members.length === 1 ? "" : "s"} who left the server.` +
          `${shown ? `\n${shown}${more}` : ""}${total !== null ? `\nTickets renumbered: ${total} left, numbered 1–${total}.` : ""}`,
        footer: { text: "Automatic · Admin → Bots → Ticket Bot → Leaver clean-up" },
        timestamp: new Date().toISOString(),
      },
    ],
  });
}
