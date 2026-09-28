import { NextResponse } from "next/server";
import { requirePanel } from "../../../../../lib/admin";
import { people } from "../../../../../lib/admin-people";
import { automodActivity } from "../../../../../lib/automod";
import { requestTimeZone } from "../../../../../lib/timezone";

export const dynamic = "force-dynamic";

/** What AutoMod caught: totals, a chart, top rules/members/words and the latest detections. */
export async function GET(request: Request) {
  const panel = await requirePanel(request);
  if (panel instanceof NextResponse) return panel;
  const p = new URL(request.url).searchParams;
  const data = await automodActivity({
    range: p.get("range") ?? "7d",
    timeZone: requestTimeZone(request),
    rule: p.get("rule"),
    userId: p.get("member"),
    page: Number(p.get("page")) || 0,
  });
  const who = await people([...data.members.map((m: { id: string }) => m.id), ...data.rows.map((r: { userId: string | null }) => r.userId)]).catch(() => ({}));
  return NextResponse.json({ ok: true, ...data, people: who }, { headers: { "Cache-Control": "no-store" } });
}
