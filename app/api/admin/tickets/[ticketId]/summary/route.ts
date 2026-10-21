import { NextResponse } from "next/server";
import { requirePanel } from "../../../../../../lib/admin";
import { AiError } from "../../../../../../lib/ai";
import { SummaryError, summarizeTicket } from "../../../../../../lib/ticket-summary";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Staff: write (or refresh) one ticket's AI description. {force: true} reads it again even if nothing changed. */
export async function POST(request: Request, { params }: { params: { ticketId: string } }) {
  const panel = await requirePanel(request);
  if (panel instanceof NextResponse) return panel;
  try {
    const body = await request.json().catch(() => ({}));
    return NextResponse.json({ ok: true, summary: await summarizeTicket(Number(params.ticketId), panel, Boolean(body?.force)) });
  } catch (error) {
    if (error instanceof SummaryError) return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    if (error instanceof AiError) return NextResponse.json({ ok: false, error: error.message }, { status: 502 });
    console.error("Ticket summary failed", error);
    return NextResponse.json({ ok: false, error: "Couldn't describe this ticket right now." }, { status: 500 });
  }
}
