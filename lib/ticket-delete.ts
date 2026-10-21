// Deleting closed tickets: admins from the website (Admin → Tickets or a member's profile), and the automatic
// clean-up of people who left (lib/ticket-autoclean.ts). Removes the ticket record and its transcript upload
// (zip + media parts) in the transcript log channel.
// Open tickets are closed in Discord instead. After any deletion the remaining tickets are renumbered so
// the numbers never have gaps (and the Ticket Bot's counter follows). Every deletion is saved to
// admin_audit; single deletions and each automatic clean-up are posted in the bot logs channel.

import type { Document, WithId } from "mongodb";
import type { PanelUser } from "./admin";
import { deleteChannelMessage, postChannelMessage } from "./discord-member";
import { getBotCollection, getMongoClient } from "./mongodb";
import { TRANSCRIPT_CHANNEL_ID } from "./transcript-store";

export const STAFF_LOG_CHANNEL_ID = "1360344042705256660";
const NSFW = /nsfw/i;
// Sasha (server owner): used by the owner-only database tools elsewhere
export const OWNER_DISCORD_ID = "164577223162986498";

/** Every admin can delete closed tickets, NSFW verification tickets included. */
export function canDeleteNsfwTickets(level: string | null | undefined) {
  return level === "admin";
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
    if (res.ok) continue;
    if (res.forbidden) handOff.push(id);
    else throw new TicketDeleteError(`Discord is busy and didn't delete ticket #${ticketId}'s transcript (error ${res.status || "network"}). Nothing was deleted for it; try again in a minute.`, 502);
  }
  if (handOff.length) {
    await (await getBotCollection("transcript_delete_queue")).insertOne({ channelId: TRANSCRIPT_CHANNEL_ID, messageIds: handOff, ticketId, by: actor.discordId, status: "pending", tries: 0, createdAt: new Date() });
  }
  const removed = await (await getBotCollection("resolvedTickets")).deleteOne({ _id: doc._id });
  if (!removed.deletedCount) throw new TicketDeleteError(`Ticket #${ticketId} couldn't be deleted.`, 409);

  const site = (await getMongoClient()).db(process.env.MONGODB_DB ?? "website");
  await site
    .collection<{ _id: string }>("transcript_cache")
    .deleteMany({ _id: { $in: messageIds.flatMap((id) => [`zip:${id}`, `att:${TRANSCRIPT_CHANNEL_ID}/${id}`]) } })
    .catch(() => undefined);
  await site.collection<{ _id: number }>("ticket_summaries").deleteOne({ _id: ticketId }).catch(() => undefined);
  await site
    .collection("admin_audit")
    .insertOne({ at: new Date(), action: how === "auto" ? "ticket-auto-cleanup" : "ticket-delete", ticketId, ticketType: String(doc.ticket_type ?? "support"), openedBy: snowflake(doc.opened_by), transcriptMessages: messageIds, adminDiscordId: actor.discordId, adminName: actor.name })
    .catch(() => undefined);
  return { uploads: messageIds.length, handedOff: handOff.length };
}

/**
 * Numbers every ticket 1, 2, 3… in order, closing the gaps deletions leave, and points the Ticket Bot's
 * counter at the last one. Descriptions move with their tickets.
 */
export async function renumberTickets() {
  const [active, resolved] = await Promise.all([getBotCollection("activeTickets"), getBotCollection("resolvedTickets")]);
  const rows = [
    ...(await active.find({}, { projection: { ticket_id: 1, created: 1 } }).toArray()).map((d) => ({ d, col: active })),
    ...(await resolved.find({}, { projection: { ticket_id: 1, created: 1 } }).toArray()).map((d) => ({ d, col: resolved })),
  ].sort((a, b) => Number(a.d.ticket_id) - Number(b.d.ticket_id) || (a.d.created?.getTime?.() ?? 0) - (b.d.created?.getTime?.() ?? 0));
  const moves = rows.map((r, i) => ({ ...r, from: Number(r.d.ticket_id), to: i + 1 })).filter((m) => m.from !== m.to);
  for (const m of moves) await m.col.updateOne({ _id: m.d._id }, { $set: { ticket_id: m.to } });
  // The bot's next ticket follows on from the last one
  await (await getBotCollection("counters")).updateOne({ _id: "ticket_id" } as never, { $set: { value: rows.length } }, { upsert: true });
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
      const next = to.get(from);
      if (!next) continue;
      await notes
        .updateOne({ _id: n._id }, { $set: { key: `ticket-flag:${next}`, link: `/admin?tab=tickets&search=%23${next}&ticket=${next}`, title: String(n.title ?? "").replace(`#${from}`, `#${next}`) } })
        .catch(() => undefined);
    }
  }
  return { total: rows.length, moved: moves.length };
}

export async function deleteTicket(actor: PanelUser, ticketId: number, expect: { created?: string | null; openedBy?: string | null } = {}) {
  if (!Number.isInteger(ticketId) || ticketId < 0) throw new TicketDeleteError("That isn't a ticket number.");
  if (actor.level !== "admin") throw new TicketDeleteError("Only admins can delete tickets.", 403);
  const resolved = await getBotCollection("resolvedTickets");
  const idMatch = { ticket_id: { $in: [ticketId, String(ticketId)] } } as never;
  const doc = await resolved.findOne(idMatch);
  if (!doc) {
    const open = await (await getBotCollection("activeTickets")).findOne(idMatch);
    throw open
      ? new TicketDeleteError("That ticket is still open. Close it in Discord first.", 409)
      : new TicketDeleteError("Ticket not found. It may already be deleted.", 404);
  }
  // Ticket numbers move after deletions: make sure this is the ticket the page meant
  const created = doc.created instanceof Date ? doc.created.toISOString() : null;
  if ((expect.created && created && expect.created !== created) || (expect.openedBy && snowflake(doc.opened_by) && expect.openedBy !== snowflake(doc.opened_by))) {
    throw new TicketDeleteError(`Ticket numbers changed since this page loaded (#${ticketId} is a different ticket now). Reload and try again.`, 409);
  }
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

  return { message: `Ticket #${ticketId} deleted.${handedOff ? " The Ticket Bot is removing its transcript from Discord." : ""}${renumbered.moved ? ` ${renumbered.moved} later ticket${renumbered.moved === 1 ? "" : "s"} moved down one number.` : ""}`, renumbered };
}
