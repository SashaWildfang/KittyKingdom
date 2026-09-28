import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../../lib/admin";
import { people } from "../../../../../lib/admin-people";
import { openTickets } from "../../../../../lib/ticket-live";

export const dynamic = "force-dynamic";

/** Tickets open right now (also drives the bubble on the Tickets tab). */
export async function GET(request: Request) {
  const admin = await requireAdmin(request);
  if (admin instanceof NextResponse) return admin;
  const tickets = await openTickets();
  const who = new URL(request.url).searchParams.get("count") ? {} : await people(tickets.flatMap((t) => [t.openedBy, t.claimedBy])).catch(() => ({}));
  return NextResponse.json({ ok: true, count: tickets.length, tickets, people: who }, { headers: { "Cache-Control": "no-store" } });
}
