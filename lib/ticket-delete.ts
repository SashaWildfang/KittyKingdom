// Admins deleting a closed ticket from the website (Admin → Tickets, or a member's profile):
// the ticket record and its transcript upload (zip + media parts) in the transcript log channel.
// NSFW tickets can only ever be deleted by the owner, and open tickets are closed in Discord
// instead. Every deletion is saved to admin_audit and posted in the bot logs channel.

import type { PanelUser } from "./admin";
import { deleteChannelMessage, postChannelMessage } from "./discord-member";
import { getBotCollection, getMongoClient } from "./mongodb";
import { TRANSCRIPT_CHANNEL_ID } from "./transcript-store";

const STAFF_LOG_CHANNEL_ID = "1360344042705256660";
const NSFW = /nsfw/i;
// Sasha (server owner): the only account that may delete NSFW verification tickets
export const OWNER_DISCORD_ID = "164577223162986498";

export function canDeleteNsfwTickets(discordId: string | null | undefined) {
  return discordId === OWNER_DISCORD_ID;
}

export class TicketDeleteError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}


const snowflake = (v: unknown) => (typeof v === "string" && /^\d{15,21}$/.test(v) ? v : null);

export async function deleteTicket(actor: PanelUser, ticketId: number) {
  if (!Number.isInteger(ticketId) || ticketId < 0) throw new TicketDeleteError("That isn't a ticket number.");
  const resolved = await getBotCollection("resolvedTickets");
  const idMatch = { ticket_id: { $in: [ticketId, String(ticketId)] } } as never;
  const doc = await resolved.findOne(idMatch);
  if (!doc) {
    const open = await (await getBotCollection("activeTickets")).findOne(idMatch);
    throw open
      ? new TicketDeleteError("That ticket is still open. Close it in Discord first.", 409)
      : new TicketDeleteError("Ticket not found. It may already be deleted.", 404);
  }
  const type = String(doc.ticket_type ?? "support");
  const nsfw = NSFW.test(type);
  if (nsfw && !canDeleteNsfwTickets(actor.discordId)) throw new TicketDeleteError("Only the owner can delete NSFW verification tickets.", 403);

  // The transcript upload first: if Discord refuses, nothing is deleted and it can be retried
  const messageIds = [snowflake(doc.transcript_id), ...((Array.isArray(doc.transcript_parts) ? doc.transcript_parts : []) as unknown[]).map(snowflake)].filter(
    (id): id is string => Boolean(id),
  );
  for (const id of messageIds) {
    const res = await deleteChannelMessage(TRANSCRIPT_CHANNEL_ID, id, `Ticket #${ticketId} deleted from the website by ${actor.name}`);
    // 404: already gone
    if (!res.ok && res.status !== 404) {
      throw new TicketDeleteError("Discord wouldn't delete the transcript upload. Nothing was deleted; try again in a minute.", 502);
    }
  }

  // Never an NSFW ticket unless it's the owner, even if the type changed in between
  const removed = await resolved.deleteOne(canDeleteNsfwTickets(actor.discordId) ? { _id: doc._id } : { _id: doc._id, ticket_type: { $not: NSFW } });
  if (!removed.deletedCount) throw new TicketDeleteError("That ticket couldn't be deleted.", 409);

  const client = await getMongoClient();
  const site = client.db(process.env.MONGODB_DB ?? "website");
  await site
    .collection<{ _id: string }>("transcript_cache")
    .deleteMany({ _id: { $in: messageIds.flatMap((id) => [`zip:${id}`, `att:${TRANSCRIPT_CHANNEL_ID}/${id}`]) } })
    .catch(() => undefined);
  const openedBy = snowflake(doc.opened_by);
  const handledBy = snowflake(doc.claimed_by) ?? snowflake(doc.resolved_by);
  await site
    .collection("admin_audit")
    .insertOne({ at: new Date(), action: "ticket-delete", ticketId, ticketType: type, openedBy, transcriptMessages: messageIds, adminDiscordId: actor.discordId, adminName: actor.name })
    .catch(() => undefined);

  const when = (d: unknown) => (d instanceof Date ? `<t:${Math.floor(d.getTime() / 1000)}:f>` : "Unknown");
  const label = type.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  await postChannelMessage(STAFF_LOG_CHANNEL_ID, {
    embeds: [
      {
        title: nsfw ? "🗑️ NSFW ticket deleted from the website (owner)" : "🗑️ Ticket deleted from the website",
        color: 0xe5484d,
        fields: [
          { name: "Ticket", value: `#${ticketId} · ${label}`, inline: true },
          { name: "Opened by", value: openedBy ? `<@${openedBy}>\n\`${openedBy}\`` : "Unknown", inline: true },
          { name: "Handled by", value: handledBy ? `<@${handledBy}>` : "Nobody", inline: true },
          { name: "Opened", value: when(doc.created), inline: true },
          { name: "Closed", value: when(doc.resolved_at), inline: true },
          { name: "Transcript", value: messageIds.length ? `Deleted (${messageIds.length} upload${messageIds.length === 1 ? "" : "s"})` : "None saved", inline: true },
          { name: "Deleted by", value: `<@${actor.discordId}>`, inline: false },
        ],
        timestamp: new Date().toISOString(),
      },
    ],
  }).catch(() => false);

  return { message: `Ticket #${ticketId} deleted.` };
}
