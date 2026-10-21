import { NextResponse } from "next/server";
import { requirePanel } from "../../../../../lib/admin";
import { aiEnabled } from "../../../../../lib/ai";
import { RECHECK_MS, savedSummaries } from "../../../../../lib/ticket-summary";
import { getTickets, isNsfwTicket } from "../../../../../lib/tickets";

export const dynamic = "force-dynamic";

/** Staff: the saved AI descriptions for these tickets (?ids=1,2,3). NSFW tickets: admins only. */
export async function GET(request: Request) {
  const panel = await requirePanel(request);
  if (panel instanceof NextResponse) return panel;
  const ids = (new URL(request.url).searchParams.get("ids") ?? "").split(",").map(Number).filter((n) => Number.isInteger(n) && n > 0).slice(0, 100);
  try {
    const tickets = (await getTickets(ids)).filter((t) => panel.level === "admin" || !isNsfwTicket(t.type));
    return NextResponse.json({ ok: true, enabled: aiEnabled(), recheckMs: RECHECK_MS, summaries: await savedSummaries(tickets) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Ticket summaries failed", error);
    return NextResponse.json({ ok: false, error: "Couldn't load the ticket descriptions." }, { status: 500 });
  }
}
