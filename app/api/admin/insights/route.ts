import { NextResponse } from "next/server";
import { requirePanel } from "../../../../lib/admin";
import { people } from "../../../../lib/admin-people";
import { economyHealth, eventResults, joinFunnel, leavers } from "../../../../lib/insights";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** Admins: ?kind=funnel|leavers|economy|events (&days= for leavers/economy/events) */
export async function GET(request: Request) {
  const panel = await requirePanel(request, "admin");
  if (panel instanceof NextResponse) return panel;
  const q = new URL(request.url).searchParams;
  const days = Number(q.get("days"));
  try {
    switch (q.get("kind")) {
      case "funnel":
        return NextResponse.json({ ok: true, cohorts: await joinFunnel(8) }, { headers: { "Cache-Control": "no-store" } });
      case "leavers": {
        const data = await leavers([7, 30, 90].includes(days) ? days : 30);
        return NextResponse.json({ ok: true, ...data, people: await people(data.recent.map((r) => r.id)) }, { headers: { "Cache-Control": "no-store" } });
      }
      case "economy":
        return NextResponse.json({ ok: true, ...(await economyHealth([7, 30, 90].includes(days) ? days : 30)) }, { headers: { "Cache-Control": "no-store" } });
      case "events":
        return NextResponse.json({ ok: true, ...(await eventResults([30, 60, 120].includes(days) ? days : 60)) }, { headers: { "Cache-Control": "no-store" } });
      default:
        return NextResponse.json({ ok: false, error: "Pick an insight." }, { status: 400 });
    }
  } catch (error) {
    console.error("Insights failed", error);
    return NextResponse.json({ ok: false, error: "Couldn't work that out right now." }, { status: 500 });
  }
}
