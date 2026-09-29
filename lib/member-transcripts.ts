// Members see transcripts of the tickets they opened (matched by their linked Discord account),
// as the redacted copy built by ./transcript-member. The page loads inside a sandboxed frame that
// doesn't send the login cookie, so each transcript gets a short-lived signed link, like the Admin
// viewer's but signed differently: a member link can never open the full staff copy.

import { createHmac, timingSafeEqual } from "crypto";
import { getTicket, queryTickets, type Ticket } from "./tickets";

const LINK_MS = 2 * 60 * 60 * 1000;

function sign(messageId: string, expires: number) {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");
  return createHmac("sha256", secret).update(`member-transcript:${messageId}:${expires}`).digest("hex").slice(0, 40);
}

export function memberTranscriptToken(messageId: string) {
  const expires = Date.now() + LINK_MS;
  return `${expires}.${sign(messageId, expires)}`;
}

export function verifyMemberTranscriptToken(messageId: string, token: string) {
  const [expiresText, signature] = token.split(".");
  const expires = Number(expiresText);
  if (!Number.isFinite(expires) || expires < Date.now() || !signature) return false;
  const expected = Buffer.from(sign(messageId, expires));
  const actual = Buffer.from(signature);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/** Closed tickets this Discord account opened that have a saved transcript, newest first. */
export async function memberTranscripts(discordId: string): Promise<Ticket[]> {
  if (!/^\d{15,21}$/.test(discordId)) return [];
  const { rows } = await queryTickets({ userId: discordId, hasTranscript: true, sort: "created", order: "desc", pageSize: 100 });
  return rows.filter((t) => t.transcriptId);
}

/** The ticket, if this Discord account opened it and its transcript is saved. */
export async function memberTranscript(discordId: string, ticketId: number): Promise<Ticket | null> {
  if (!/^\d{15,21}$/.test(discordId) || !Number.isInteger(ticketId) || ticketId < 0) return null;
  const ticket = await getTicket(ticketId);
  if (!ticket || ticket.openedBy !== discordId || !ticket.transcriptId) return null;
  return ticket;
}

/** "support" → "Support", "join_app" → "Join App". */
export function ticketTypeLabel(type: string) {
  return type.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()).trim() || "Ticket";
}
