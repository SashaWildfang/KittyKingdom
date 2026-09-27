import { NextResponse } from "next/server";
import { requirePanel } from "../../../../lib/admin";
import { dateRange, listParam, people } from "../../../../lib/admin-people";
import { resolveMentions } from "../../../../lib/discord-mentions";
import { queryPunishments, type PunishmentQuery } from "../../../../lib/moderation";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

export async function GET(request: Request) {
  const panel = await requirePanel(request);
  if (panel instanceof NextResponse) return panel;
  try {
    const params = new URL(request.url).searchParams;
    const { from, to } = dateRange(params);
    const result = await queryPunishments({
      actions: listParam(params, "actions"),
      search: params.get("search") ?? undefined,
      reason: params.get("reason") ?? undefined,
      userId: params.get("userId") ?? undefined,
      issuerId: params.get("issuerId") ?? undefined,
      source: (params.get("source") as PunishmentQuery["source"]) ?? "all",
      status: (params.get("status") as PunishmentQuery["status"]) ?? "all",
      from,
      to,
      sort: (params.get("sort") as PunishmentQuery["sort"]) ?? "timestamp",
      order: params.get("order") === "asc" ? "asc" : "desc",
      page: Number(params.get("page") ?? 1),
      pageSize: Number(params.get("pageSize") ?? 25),
    });
    const { mentions, userIds } = await resolveMentions(result.rows.flatMap((r) => [r.reason, r.extraInfo, r.messageContent]));
    const who = await people([...result.rows.flatMap((r) => [r.userId, r.issuerId]), ...userIds]);
    return NextResponse.json({ ok: true, ...result, people: who, mentions });
  } catch (error) {
    console.error("Admin punishments failed", error);
    return NextResponse.json({ ok: false, error: "Couldn't load punishments." }, { status: 500 });
  }
}
