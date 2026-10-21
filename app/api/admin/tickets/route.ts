import { NextResponse } from "next/server";
import { requirePanel } from "../../../../lib/admin";
import { dateRange, listParam, people } from "../../../../lib/admin-people";
import { tagCounts, ticketIdsWithTags } from "../../../../lib/ticket-summary";
import { queryTickets, type TicketQuery } from "../../../../lib/tickets";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

export async function GET(request: Request) {
  // All staff can look (read only); NSFW verification tickets are admins only
  const panel = await requirePanel(request);
  if (panel instanceof NextResponse) return panel;
  try {
    const params = new URL(request.url).searchParams;
    const { from, to } = dateRange(params);
    const tags = listParam(params, "tags");
    const opener = params.get("opener");
    const [ticketIds, counts] = await Promise.all([ticketIdsWithTags(tags), params.get("tagCounts") === "1" ? tagCounts() : Promise.resolve(null)]);
    const query: TicketQuery = {
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
      summary: params.get("summary") === "1",
      excludeNsfw: panel.level !== "admin",
      opener: opener === "in" || opener === "left" || opener === "deleted" ? opener : undefined,
      ticketIds,
    };
    const result = await queryTickets(query);
    // Status counts that ignore the status filter itself (so picking "Closed" doesn't hide "Open")
    if (query.statuses?.length) result.statusCounts = (await queryTickets({ ...query, statuses: [], page: 1, pageSize: 10, summary: false })).statusCounts;
    const who = await people([
      ...result.rows.flatMap((t) => [t.openedBy, t.claimedBy, t.resolvedBy]),
      ...(result.summary ? [...result.summary.handlers, ...result.summary.openers].map((x) => x.id) : []),
    ]);
    return NextResponse.json({ ok: true, ...result, people: who, tagCounts: counts });
  } catch (error) {
    console.error("Admin tickets failed", error);
    return NextResponse.json({ ok: false, error: "Couldn't load tickets." }, { status: 500 });
  }
}
