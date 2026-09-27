import { NextResponse } from "next/server";
import { requirePanel } from "../../../../lib/admin";
import { dateRange, listParam, people } from "../../../../lib/admin-people";
import { resolveMentions } from "../../../../lib/discord-mentions";
import { punishmentStats, type StatsQuery } from "../../../../lib/moderation";
import { ticketStats } from "../../../../lib/tickets";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

export async function GET(request: Request) {
  const panel = await requirePanel(request);
  if (panel instanceof NextResponse) return panel;
  try {
    const params = new URL(request.url).searchParams;
    const { from, to } = dateRange(params);
    const unit = (["day", "week", "month"].includes(params.get("unit") ?? "") ? params.get("unit") : "day") as StatsQuery["unit"];
    const [punishments, tickets] = await Promise.all([
      punishmentStats({ from, to, unit, actions: listParam(params, "actions"), source: (params.get("source") as StatsQuery["source"]) ?? "all" }),
      // Ticket numbers are admin-only
      panel.level === "admin" ? ticketStats({ from, to, unit }) : Promise.resolve(null),
    ]);
    const { mentions, userIds } = await resolveMentions(punishments.topReasons.map((r) => r.reason));
    const who = await people([
      ...userIds,
      ...punishments.topUsers.map((u) => u.id),
      ...punishments.topIssuers.map((u) => u.id),
      ...(tickets?.topStaff.map((u) => u.id) ?? []),
      ...(tickets?.topOpeners.map((u) => u.id) ?? []),
    ]);
    return NextResponse.json({ ok: true, punishments, tickets, people: who, mentions });
  } catch (error) {
    console.error("Admin stats failed", error);
    return NextResponse.json({ ok: false, error: "Couldn't load stats." }, { status: 500 });
  }
}
