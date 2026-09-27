import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../lib/admin";
import { trafficReport, type TrafficRange } from "../../../../lib/analytics";

export const dynamic = "force-dynamic";
export const maxDuration = 20;

const RANGES: TrafficRange[] = ["24h", "7d", "30d", "90d", "365d"];

/** Website traffic and site statistics for the Admin → Traffic tab (admins only). */
export async function GET(request: Request) {
  const admin = await requireAdmin(request);
  if (admin instanceof NextResponse) return admin;
  try {
    const raw = new URL(request.url).searchParams.get("range") as TrafficRange | null;
    const range = raw && RANGES.includes(raw) ? raw : "7d";
    return NextResponse.json({ ok: true, ...(await trafficReport(range)) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Traffic report failed", error);
    return NextResponse.json({ ok: false, error: "Couldn't load the traffic stats." }, { status: 500 });
  }
}
