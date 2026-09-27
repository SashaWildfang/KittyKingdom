import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../../lib/admin";
import { trafficSlot, type TrafficRange } from "../../../../../lib/analytics";

export const dynamic = "force-dynamic";
export const maxDuration = 20;

const RANGES: TrafficRange[] = ["24h", "7d", "30d", "90d", "365d"];

/** ?range=7d&hour=0-23&weekday=0-6 (0 = Sunday): details for one slot of the "When people visit" chart. */
export async function GET(request: Request) {
  const admin = await requireAdmin(request);
  if (admin instanceof NextResponse) return admin;
  const params = new URL(request.url).searchParams;
  const raw = params.get("range") as TrafficRange | null;
  const range = raw && RANGES.includes(raw) ? raw : "7d";
  const int = (key: string, max: number) => {
    const v = params.get(key);
    if (v === null || v === "") return undefined;
    const n = Number(v);
    return Number.isInteger(n) && n >= 0 && n <= max ? n : null;
  };
  const hour = int("hour", 23);
  const weekday = int("weekday", 6);
  if (hour === null || weekday === null || (hour === undefined && weekday === undefined)) {
    return NextResponse.json({ ok: false, error: "Pick an hour or a day." }, { status: 400 });
  }
  try {
    return NextResponse.json({ ok: true, ...(await trafficSlot(range, { hour, weekday })) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Traffic slot failed", error);
    return NextResponse.json({ ok: false, error: "Couldn't load that time slot." }, { status: 500 });
  }
}
