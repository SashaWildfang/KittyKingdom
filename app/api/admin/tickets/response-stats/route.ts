import { NextResponse } from "next/server";
import { requirePanel } from "../../../../../lib/admin";
import { people } from "../../../../../lib/admin-people";
import { responseStats } from "../../../../../lib/ticket-work";

export const dynamic = "force-dynamic";

/** How fast staff answer and close tickets (?days=7|30|90). */
export async function GET(request: Request) {
  const panel = await requirePanel(request);
  if (panel instanceof NextResponse) return panel;
  const days = [7, 30, 90].includes(Number(new URL(request.url).searchParams.get("days"))) ? Number(new URL(request.url).searchParams.get("days")) : 30;
  try {
    const stats = await responseStats(panel, days);
    return NextResponse.json({ ok: true, stats, people: await people(stats.byStaff.map((s) => s.id)) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Response stats failed", error);
    return NextResponse.json({ ok: false, error: "Couldn't work out response times." }, { status: 500 });
  }
}
