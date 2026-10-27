import { NextResponse } from "next/server";
import { requirePanel } from "../../../../../lib/admin";
import { uptimeTimeline } from "../../../../../lib/bot-versions";
import { PARTS } from "../../../../../lib/status";

export const dynamic = "force-dynamic";

/** Admins: hour-by-hour up/down for one part (?part=main) over ?days=7 (max 30). */
export async function GET(request: Request) {
  const panel = await requirePanel(request, "admin");
  if (panel instanceof NextResponse) return panel;
  const q = new URL(request.url).searchParams;
  const part = q.get("part") ?? "main";
  if (!PARTS.some((p) => p.key === part)) return NextResponse.json({ ok: false, error: "Unknown part." }, { status: 400 });
  const days = Math.min(30, Math.max(1, Number(q.get("days")) || 7));
  return NextResponse.json({ ok: true, part, days: await uptimeTimeline(part, days) }, { headers: { "Cache-Control": "no-store" } });
}
