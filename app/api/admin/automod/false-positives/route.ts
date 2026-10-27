import { NextResponse } from "next/server";
import { requirePanel } from "../../../../../lib/admin";
import { falsePositiveRates } from "../../../../../lib/automod-fp";

export const dynamic = "force-dynamic";

/** Which AutoMod rules staff have marked as mistakes in the last 30 days. */
export async function GET(request: Request) {
  const panel = await requirePanel(request);
  if (panel instanceof NextResponse) return panel;
  return NextResponse.json({ ok: true, rules: await falsePositiveRates(30).catch(() => []) }, { headers: { "Cache-Control": "no-store" } });
}
