import { NextResponse } from "next/server";
import { requireAdmin, transcriptToken } from "../../../../../lib/admin";
import { people } from "../../../../../lib/admin-people";
import { TicketDeleteError, deleteTicket } from "../../../../../lib/ticket-delete";
import { getTicket } from "../../../../../lib/tickets";
import { warmTranscript } from "../../../../../lib/transcript-store";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** One ticket, with a signed link to view its transcript and a fresh zip download link. */
export async function GET(request: Request, { params }: { params: { ticketId: string } }) {
  const admin = await requireAdmin(request);
  if (admin instanceof NextResponse) return admin;
  const ticket = await getTicket(Number(params.ticketId));
  if (!ticket) return NextResponse.json({ ok: false, error: "Ticket not found." }, { status: 404 });

  const download = ticket.transcriptId ? await warmTranscript(ticket.transcriptId).catch(() => null) : null;
  const viewer = ticket.transcriptId && download
    ? `/api/admin/transcript-files/${ticket.transcriptId}/${transcriptToken(ticket.transcriptId)}/index.html`
    : null;
  const who = await people([ticket.openedBy, ticket.claimedBy, ticket.resolvedBy]);
  return NextResponse.json({ ok: true, ticket, viewer, download, people: who });
}

/** Deletes a closed ticket and its transcript (never NSFW tickets). Admins only; logged. */
export async function DELETE(request: Request, { params }: { params: { ticketId: string } }) {
  const admin = await requireAdmin(request);
  if (admin instanceof NextResponse) return admin;
  try {
    const result = await deleteTicket(admin, Number(params.ticketId));
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof TicketDeleteError) return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    console.error("Ticket delete failed", error);
    return NextResponse.json({ ok: false, error: "That didn't work right now. Please try again." }, { status: 500 });
  }
}
