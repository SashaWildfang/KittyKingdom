import { NextResponse } from "next/server";
import { requirePanel } from "../../../../../lib/admin";
import { people } from "../../../../../lib/admin-people";
import { openTickets } from "../../../../../lib/ticket-live";

export const dynamic = "force-dynamic";

/** Tickets open right now (also drives the bubble on the Tickets tab). */
export async function GET(request: Request) {
  const panel = await requirePanel(request);
  if (panel instanceof NextResponse) return panel;
  const tickets = await openTickets(panel.level !== "admin");
  const who = new URL(request.url).searchParams.get("count") ? {} : await people(tickets.flatMap((t) => [t.openedBy, t.claimedBy])).catch(() => ({}));
  return NextResponse.json({ ok: true, count: tickets.length, tickets, people: who }, { headers: { "Cache-Control": "no-store" } });
}
