import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../lib/admin";
import { dateRange, listParam, people } from "../../../../lib/admin-people";
import { queryTickets, type TicketQuery } from "../../../../lib/tickets";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

export async function GET(request: Request) {
  const admin = await requireAdmin(request);
  if (admin instanceof NextResponse) return admin;
  try {
    const params = new URL(request.url).searchParams;
    const { from, to } = dateRange(params);
    const result = await queryTickets({
      search: params.get("search") ?? undefined,
      types: listParam(params, "types"),
      statuses: listParam(params, "statuses"),
      userId: params.get("userId") ?? undefined,
      staffId: params.get("staffId") ?? undefined,
      hasTranscript: params.get("hasTranscript") === "1",
      from,
      to,
      sort: (params.get("sort") as TicketQuery["sort"]) ?? "ticketId",
      order: params.get("order") === "asc" ? "asc" : "desc",
      page: Number(params.get("page") ?? 1),
      pageSize: Number(params.get("pageSize") ?? 25),
    });
    const who = await people(result.rows.flatMap((t) => [t.openedBy, t.claimedBy, t.resolvedBy]));
    return NextResponse.json({ ok: true, ...result, people: who });
  } catch (error) {
    console.error("Admin tickets failed", error);
    return NextResponse.json({ ok: false, error: "Couldn't load tickets." }, { status: 500 });
  }
}
