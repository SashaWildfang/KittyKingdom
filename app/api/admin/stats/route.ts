import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../lib/admin";
import { dateRange, listParam, people } from "../../../../lib/admin-people";
import { punishmentStats, type StatsQuery } from "../../../../lib/moderation";
import { ticketStats } from "../../../../lib/tickets";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

export async function GET(request: Request) {
  const admin = await requireAdmin(request);
  if (admin instanceof NextResponse) return admin;
  try {
    const params = new URL(request.url).searchParams;
    const { from, to } = dateRange(params);
    const unit = (["day", "week", "month"].includes(params.get("unit") ?? "") ? params.get("unit") : "day") as StatsQuery["unit"];
    const [punishments, tickets] = await Promise.all([
      punishmentStats({ from, to, unit, actions: listParam(params, "actions"), source: (params.get("source") as StatsQuery["source"]) ?? "all" }),
      ticketStats({ from, to, unit }),
    ]);
    const who = await people([
      ...punishments.topUsers.map((u) => u.id),
      ...punishments.topIssuers.map((u) => u.id),
      ...tickets.topStaff.map((u) => u.id),
      ...tickets.topOpeners.map((u) => u.id),
    ]);
    return NextResponse.json({ ok: true, punishments, tickets, people: who });
  } catch (error) {
    console.error("Admin stats failed", error);
    return NextResponse.json({ ok: false, error: "Couldn't load stats." }, { status: 500 });
  }
}
