import { NextResponse } from "next/server";
import { requireAdmin, transcriptToken } from "../../../../../lib/admin";
import { people } from "../../../../../lib/admin-people";
import { getTicket, transcriptDownload } from "../../../../../lib/tickets";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

/** One ticket, with a signed link to view its transcript and a fresh zip download link. */
export async function GET(request: Request, { params }: { params: { ticketId: string } }) {
  const admin = await requireAdmin(request);
  if (admin instanceof NextResponse) return admin;
  const ticket = await getTicket(Number(params.ticketId));
  if (!ticket) return NextResponse.json({ ok: false, error: "Ticket not found." }, { status: 404 });

  const download = ticket.transcriptId ? await transcriptDownload(ticket.transcriptId) : null;
  const viewer = ticket.transcriptId && download
    ? `/api/admin/transcript-files/${ticket.transcriptId}/${transcriptToken(ticket.transcriptId)}/index.html`
    : null;
  const who = await people([ticket.openedBy, ticket.claimedBy, ticket.resolvedBy]);
  return NextResponse.json({ ok: true, ticket, viewer, download, people: who });
}
