import { Long } from "mongodb";
import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../../../lib/admin";
import { calculateAge, parseDateOfBirth } from "../../../../../../lib/dates";
import { getBotCollection } from "../../../../../../lib/mongodb";
import { summarizeTicket } from "../../../../../../lib/ticket-summary";
import { getTicket, isNsfwTicket } from "../../../../../../lib/tickets";

export const dynamic = "force-dynamic";

/**
 * Admins: record the date of birth on a member's ID for an older 18+ verification ticket (from before the
 * Ticket Bot asked for it), after looking at the ID in the transcript. The description is rebuilt right away.
 */
export async function POST(request: Request, { params }: { params: { ticketId: string } }) {
  const admin = await requireAdmin(request);
  if (admin instanceof NextResponse) return admin;
  const ticket = await getTicket(Number(params.ticketId));
  if (!ticket || !isNsfwTicket(ticket.type) || !ticket.openedBy) return NextResponse.json({ ok: false, error: "That isn't an 18+ verification ticket." }, { status: 404 });
  const body = (await request.json().catch(() => ({}))) as { dob?: string };
  const dob = parseDateOfBirth(String(body.dob ?? ""));
  if (!dob || dob.getUTCFullYear() < 1900 || dob.getTime() > Date.now()) return NextResponse.json({ ok: false, error: "Type the date like 10/12/2001." }, { status: 400 });
  await (await getBotCollection("users")).updateOne(
    { discordId: { $in: [Long.fromString(ticket.openedBy), ticket.openedBy] } } as never,
    { $set: { nsfwIdDob: dob.toISOString().slice(0, 10), nsfwIdRecordedBy: admin.discordId, nsfwIdRecordedVia: "website", nsfwIdRecordedAt: new Date() }, $setOnInsert: { discordId: Long.fromString(ticket.openedBy) } },
    { upsert: true },
  );
  const summary = await summarizeTicket(ticket.ticketId, admin, true);
  return NextResponse.json({ ok: true, summary, age: calculateAge(dob) });
}
