// Deleting closed tickets: owners from the website (Admin → Tickets or a member's profile), and the automatic
// clean-up of people who left (lib/ticket-autoclean.ts). Removes the ticket record and its transcript upload
// (zip + media parts) in the transcript log channel.
// Open tickets are closed in Discord instead. After any deletion the remaining tickets are renumbered so
// the numbers never have gaps (and the Ticket Bot's counter follows). Every deletion is saved to
// admin_audit; single deletions and each automatic clean-up are posted in the bot logs channel.

import { ObjectId, type Document, type WithId } from "mongodb";
import type { PanelUser } from "./admin";
import { deleteChannelMessage, memberRoleIdsCached, postChannelMessage } from "./discord-member";
import { getBotCollection, getMongoClient } from "./mongodb";
import { withTicketLock } from "./ticket-lock";
import { TRANSCRIPT_CHANNEL_ID } from "./transcript-store";

export const STAFF_LOG_CHANNEL_ID = "1360344042705256660";
const NSFW = /nsfw/i;
// Sasha (server owner): used by the owner-only database tools elsewhere
export const OWNER_DISCORD_ID = "164577223162986498";

// The Owner role in the server
const OWNER_ROLE_ID = "1358473248534167663";

/** Only owners (Sasha, or anyone with the Owner role) can delete tickets, of any type. */
export async function isTicketOwner(discordId: string | null | undefined) {
  if (!discordId) return false;
  if (discordId === OWNER_DISCORD_ID) return true;
  return ((await memberRoleIdsCached(discordId).catch(() => null)) ?? []).includes(OWNER_ROLE_ID);
}

export async function canDeleteTickets(panel: { level: string; discordId: string } | null | undefined) {
  return Boolean(panel && panel.level === "admin" && (await isTicketOwner(panel.discordId)));
}

export class TicketDeleteError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

const snowflake = (v: unknown) => (typeof v === "string" && /^\d{15,21}$/.test(v) ? v : null);
const when = (d: unknown) => (d instanceof Date ? `<t:${Math.floor(d.getTime() / 1000)}:f>` : "Unknown");

/** Deletes one closed ticket's transcript uploads and record. Throws if Discord refuses (nothing is deleted then). */
export async function removeTicket(actor: PanelUser, doc: WithId<Document>, how: "single" | "auto") {
  const ticketId = Number(doc.ticket_id);
  const messageIds = [snowflake(doc.transcript_id), ...((Array.isArray(doc.transcript_parts) ? doc.transcript_parts : []) as unknown[]).map(snowflake)].filter(
    (id): id is string => Boolean(id),
  );
  // The transcript upload first. The uploads are the Ticket Bot's own messages: if this bot isn't allowed to
  // delete them (no Manage Messages there), the Ticket Bot is asked to (it can always delete its own).
  const handOff: string[] = [];
  for (const id of messageIds) {
    const res = await deleteChannelMessage(TRANSCRIPT_CHANNEL_ID, id, how === "auto" ? `Ticket #${ticketId} deleted: the member left the server` : `Ticket #${ticketId} deleted from the website by ${actor.name}`);
    // 404: already gone (someone else deleted it at the same moment, or it was removed by hand)
    if (res.ok || res.status === 404) continue;
    if (res.forbidden) handOff.push(id);
    else throw new TicketDeleteError(`Discord is busy and didn't delete ticket #${ticketId}'s transcript (error ${res.status || "network"}). Nothing was deleted for it; try again in a minute.`, 502);
  }
  if (handOff.length) {
    await (await getBotCollection("transcript_delete_queue")).insertOne({ channelId: TRANSCRIPT_CHANNEL_ID, messageIds: handOff, ticketId, by: actor.discordId, status: "pending", tries: 0, createdAt: new Date() });
  }
  const removed = await (await getBotCollection("resolvedTickets")).deleteOne({ _id: doc._id });
  if (!removed.deletedCount) throw new TicketDeleteError(`Ticket #${ticketId} was already deleted by someone else.`, 409);

  const site = (await getMongoClient()).db(process.env.MONGODB_DB ?? "website");
  await site
    .collection<{ _id: string }>("transcript_cache")
    .deleteMany({ _id: { $in: messageIds.flatMap((id) => [`zip:${id}`, `att:${TRANSCRIPT_CHANNEL_ID}/${id}`]) } })
    .catch(() => undefined);
  // Its description (not one that has since been moved to this number for another ticket)
  await site.collection<{ _id: number }>("ticket_summaries").deleteOne({ _id: ticketId, ticketKey: { $in: [null, String(doc._id)] } } as never).catch(() => undefined);
  await site
    .collection("admin_audit")
    .insertOne({ at: new Date(), action: how === "auto" ? "ticket-auto-cleanup" : "ticket-delete", ticketId, ticketType: String(doc.ticket_type ?? "support"), openedBy: snowflake(doc.opened_by), transcriptMessages: messageIds, adminDiscordId: actor.discordId, adminName: actor.name })
    .catch(() => undefined);
  return { uploads: messageIds.length, handedOff: handOff.length };
}

/**
 * Numbers the tickets 1, 2, 3… in order, closing the gaps deletions leave, and points the Ticket Bot's counter at
 * the last one. Descriptions and bell notifications move with their tickets. Safe with several people (and the
 * leaver clean-up) working at once:
 * - only one renumber runs at a time (lib/ticket-lock.ts)
 * - open tickets and ones closed in the last 10 minutes keep their number: the Ticket Bot finds tickets by number
 *   while it closes them and saves their transcript, so those never move under it. The rest close up around
 *   them, keeping their order (a gap can stay just below a held ticket until the next renumber).
 * - the counter is only lowered if the bot hasn't opened a ticket meanwhile
 */
export async function renumberTickets() {
  return withTicketLock(renumberLocked);
}

const SETTLE_MS = 10 * 60_000;

async function renumberLocked() {
  const [active, resolved, counters] = await Promise.all([getBotCollection("activeTickets"), getBotCollection("resolvedTickets"), getBotCollection("counters")]);
  const counterBefore = Number(((await counters.findOne({ _id: "ticket_id" } as never)) as { value?: number } | null)?.value ?? 0);
  const settled = new Date(Date.now() - SETTLE_MS);
  const proj = { projection: { ticket_id: 1, created: 1, resolved_at: 1 } };
  const rows = [
    ...(await active.find({}, proj).toArray()).map((d) => ({ d, col: active, held: true })),
    ...(await resolved.find({}, proj).toArray()).map((d) => ({ d, col: resolved, held: d.resolved_at instanceof Date && d.resolved_at > settled })),
  ].sort((a, b) => Number(a.d.ticket_id) - Number(b.d.ticket_id) || (a.d.created?.getTime?.() ?? 0) - (b.d.created?.getTime?.() ?? 0));

  // Held tickets keep their numbers; everything else takes the lowest free number, in order (moves only go down)
  const taken = new Set(rows.filter((r) => r.held).map((r) => Number(r.d.ticket_id)));
  const moves: { d: (typeof rows)[number]["d"]; col: (typeof rows)[number]["col"]; from: number; to: number }[] = [];
  let next = 1;
  for (const r of rows) {
    // Nothing jumps in front of a held ticket, so the order never changes (a gap can stay just below it)
    if (r.held) {
      next = Math.max(next, Number(r.d.ticket_id) + 1);
      continue;
    }
    while (taken.has(next)) next += 1;
    const from = Number(r.d.ticket_id);
    if (from !== next) moves.push({ d: r.d, col: r.col, from, to: next });
    taken.add(next);
    next += 1;
  }
  for (const m of moves) await m.col.updateOne({ _id: m.d._id, ticket_id: m.d.ticket_id }, { $set: { ticket_id: m.to } });

  // The bot's next ticket follows on from the highest number, unless it opened one while this ran
  const highest = Math.max(0, ...Array.from(taken));
  await counters.updateOne({ _id: "ticket_id", value: counterBefore } as never, { $set: { value: highest } });
  if (!counterBefore) await counters.updateOne({ _id: "ticket_id" } as never, { $setOnInsert: { value: highest } }, { upsert: true });

  if (moves.length) {
    const summaries = (await getMongoClient()).db(process.env.MONGODB_DB ?? "website").collection<Document & { _id: number }>("ticket_summaries");
    const saved = await summaries.find({ _id: { $in: moves.map((m) => m.from) } }).toArray();
    const byId = new Map(saved.map((s) => [s._id, s]));
    await summaries.deleteMany({ _id: { $in: moves.map((m) => m.from).concat(moves.map((m) => m.to)) } });
    const moved = moves.map((m) => byId.get(m.from) && { ...byId.get(m.from)!, _id: m.to, checkedAt: new Date(0) }).filter(Boolean) as (Document & { _id: number })[];
    if (moved.length) await summaries.insertMany(moved).catch(() => undefined);
    // Bell notifications about a ticket ("18+ ticket #31: no photo") follow it to its new number
    const notes = (await getMongoClient()).db(process.env.MONGODB_DB ?? "website").collection("notifications");
    const to = new Map(moves.map((m) => [m.from, m.to]));
    const affected = await notes.find({ key: { $in: moves.map((m) => `ticket-flag:${m.from}`) } }, { projection: { key: 1, title: 1 } }).toArray();
    for (const n of affected) {
      const from = Number(String(n.key).split(":")[1]);
      const nextNo = to.get(from);
      if (!nextNo) continue;
      await notes
        .updateOne({ _id: n._id }, { $set: { key: `ticket-flag:${nextNo}`, link: `/admin?tab=tickets&search=%23${nextNo}&ticket=${nextNo}`, title: String(n.title ?? "").replace(`#${from}`, `#${nextNo}`) } })
        .catch(() => undefined);
    }
  }
  return { total: rows.length, moved: moves.length };
}

export async function deleteTicket(actor: PanelUser, ticketId: number, expect: { key?: string | null; created?: string | null; openedBy?: string | null } = {}) {
  if (actor.level !== "admin" || !(await isTicketOwner(actor.discordId))) throw new TicketDeleteError("Only the owner can delete tickets.", 403);
  const [resolved, active] = await Promise.all([getBotCollection("resolvedTickets"), getBotCollection("activeTickets")]);
  // By its database id when the page sent one: the right ticket even if numbers moved since the page loaded
  const byKey = expect.key && ObjectId.isValid(expect.key);
  if (!byKey && (!Number.isInteger(ticketId) || ticketId < 0)) throw new TicketDeleteError("That isn't a ticket number.");
  const match = (byKey ? { _id: new ObjectId(expect.key!) } : { ticket_id: { $in: [ticketId, String(ticketId)] } }) as never;
  const doc = await resolved.findOne(match);
  if (!doc) {
    const open = await active.findOne(match);
    throw open
      ? new TicketDeleteError("That ticket is still open. Close it in Discord first.", 409)
      : new TicketDeleteError("Ticket not found. Someone may have deleted it already.", 404);
  }
  // Older pages (no key): make sure the number still points at the ticket the page meant
  const created = doc.created instanceof Date ? doc.created.toISOString() : null;
  if (!byKey && ((expect.created && created && expect.created !== created) || (expect.openedBy && snowflake(doc.opened_by) && expect.openedBy !== snowflake(doc.opened_by)))) {
    throw new TicketDeleteError(`Ticket numbers changed since this page loaded (#${ticketId} is a different ticket now). Reload and try again.`, 409);
  }
  const requested = ticketId;
  ticketId = Number(doc.ticket_id);
  const type = String(doc.ticket_type ?? "support");
  const { uploads, handedOff } = await removeTicket(actor, doc, "single");
  const renumbered = await renumberTickets();

  const openedBy = snowflake(doc.opened_by);
  const handledBy = snowflake(doc.claimed_by) ?? snowflake(doc.resolved_by);
  const label = type.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  await postChannelMessage(STAFF_LOG_CHANNEL_ID, {
    embeds: [
      {
        title: NSFW.test(type) ? "🗑️ NSFW ticket deleted from the website" : "🗑️ Ticket deleted from the website",
        color: 0xe5484d,
        fields: [
          { name: "Ticket", value: `#${ticketId} · ${label}`, inline: true },
          { name: "Opened by", value: openedBy ? `<@${openedBy}>\n\`${openedBy}\`` : "Unknown", inline: true },
          { name: "Handled by", value: handledBy ? `<@${handledBy}>` : "Nobody", inline: true },
          { name: "Opened", value: when(doc.created), inline: true },
          { name: "Closed", value: when(doc.resolved_at), inline: true },
          { name: "Transcript", value: uploads ? `Deleted (${uploads} upload${uploads === 1 ? "" : "s"})` : "None saved", inline: true },
          { name: "Deleted by", value: `<@${actor.discordId}>`, inline: true },
          { name: "Renumbered", value: renumbered.moved ? `${renumbered.moved} later ticket${renumbered.moved === 1 ? "" : "s"} moved down` : "Nothing to move", inline: true },
        ],
        timestamp: new Date().toISOString(),
      },
    ],
  }).catch(() => false);

  const was = Number.isInteger(requested) && requested !== ticketId ? ` (it was #${requested} when your page loaded)` : "";
  return { message: `Ticket #${ticketId}${was} deleted.${handedOff ? " The Ticket Bot is removing its transcript from Discord." : ""}${renumbered.moved ? ` ${renumbered.moved} later ticket${renumbered.moved === 1 ? "" : "s"} moved down one number.` : ""}`, renumbered };
}
