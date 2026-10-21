import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../../../lib/admin";
import { calculateAge, parseDateOfBirth } from "../../../../../../lib/dates";
import { getJoinApplication } from "../../../../../../lib/join-application";
import { getJoinApplicationsCollection } from "../../../../../../lib/mongodb";
import { summarizeTicket } from "../../../../../../lib/ticket-summary";
import { getTicket, isNsfwTicket } from "../../../../../../lib/tickets";

export const dynamic = "force-dynamic";

/**
 * Admins: fill in the date of birth on a member's join application when it's missing (older forms, or an answer
 * the bot couldn't read), so their 18+ ticket can be checked. Their original answer is kept. The description is
 * rebuilt right away.
 */
export async function POST(request: Request, { params }: { params: { ticketId: string } }) {
  const admin = await requireAdmin(request);
  if (admin instanceof NextResponse) return admin;
  const ticket = await getTicket(Number(params.ticketId));
  if (!ticket || !isNsfwTicket(ticket.type) || !ticket.openedBy) return NextResponse.json({ ok: false, error: "That isn't an 18+ verification ticket." }, { status: 404 });
  const body = (await request.json().catch(() => ({}))) as { dob?: string; openedBy?: string };
  // Ticket numbers move after deletions: make sure this is still the member the page showed
  if (body.openedBy && body.openedBy !== ticket.openedBy) return NextResponse.json({ ok: false, error: "Ticket numbers changed since this page loaded. Reload and try again." }, { status: 409 });
  const dob = parseDateOfBirth(String(body.dob ?? ""));
  if (!dob || dob.getUTCFullYear() < 1900 || dob.getTime() > Date.now()) return NextResponse.json({ ok: false, error: "Type the date like 10/12/2001." }, { status: 400 });
  const app = await getJoinApplication(ticket.openedBy);
  if (!app?._id) return NextResponse.json({ ok: false, error: "They don't have a join application to add it to." }, { status: 404 });
  const mdy = `${String(dob.getUTCMonth() + 1).padStart(2, "0")}/${String(dob.getUTCDate()).padStart(2, "0")}/${dob.getUTCFullYear()}`;
  await (await getJoinApplicationsCollection()).updateOne(
    { _id: app._id } as never,
    { $set: { dateOfBirth: mdy, dobSetBy: admin.discordId, dobSetByName: admin.name, dobSetAt: new Date(), dobSetVia: "website" } },
  );
  const summary = await summarizeTicket(ticket.ticketId, admin, true);
  return NextResponse.json({ ok: true, summary, age: calculateAge(dob) });
}
