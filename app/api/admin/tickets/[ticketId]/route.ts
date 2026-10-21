import { requireTwoFactorForAction } from "../../../../../lib/admin-2fa";
import { NextResponse } from "next/server";
import { requireAdmin, requirePanel, transcriptToken } from "../../../../../lib/admin";
import { people } from "../../../../../lib/admin-people";
import { TicketDeleteError, deleteTicket } from "../../../../../lib/ticket-delete";
import { findTicket, isNsfwTicket } from "../../../../../lib/tickets";
import { warmTranscript } from "../../../../../lib/transcript-store";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** One ticket, with a signed link to view its transcript and a fresh zip download link. All staff (NSFW: admins only). */
export async function GET(request: Request, { params }: { params: { ticketId: string } }) {
  const panel = await requirePanel(request);
  if (panel instanceof NextResponse) return panel;
  const ticket = await findTicket(Number(params.ticketId), new URL(request.url).searchParams.get("key"));
  if (!ticket || (panel.level !== "admin" && isNsfwTicket(ticket.type))) return NextResponse.json({ ok: false, error: "Ticket not found." }, { status: 404 });

  const download = ticket.transcriptId ? await warmTranscript(ticket.transcriptId).catch(() => null) : null;
  const viewer = ticket.transcriptId && download
    ? `/api/admin/transcript-files/${ticket.transcriptId}/${transcriptToken(ticket.transcriptId)}/index.html`
    : null;
  const who = await people([ticket.openedBy, ticket.claimedBy, ticket.resolvedBy]);
  return NextResponse.json({ ok: true, ticket, viewer, download, people: who });
}

/** Deletes a closed ticket and its transcript. Owners only; logged. ?key= picks the ticket by its database id. */
export async function DELETE(request: Request, { params }: { params: { ticketId: string } }) {
  const admin = await requireAdmin(request);
  if (admin instanceof NextResponse) return admin;
  const twoFactor = await requireTwoFactorForAction();
  if (twoFactor) return twoFactor;
  try {
    const q = new URL(request.url).searchParams;
    const result = await deleteTicket(admin, Number(params.ticketId), { key: q.get("key"), created: q.get("created"), openedBy: q.get("openedBy") });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof TicketDeleteError) return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    console.error("Ticket delete failed", error);
    return NextResponse.json({ ok: false, error: "That didn't work right now. Please try again." }, { status: 500 });
  }
}
