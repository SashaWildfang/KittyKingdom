import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../../lib/admin";
import { STAT_LIST, statOptions } from "../../../../../lib/graphics/stats";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** Every graphic Admin → Graphics can make, plus the choices for its dropdowns (channels, role groups, roles, games). */
export async function GET(request: Request) {
  const admin = await requireAdmin(request);
  if (admin instanceof NextResponse) return admin;
  try {
    return NextResponse.json({ ok: true, stats: STAT_LIST, options: await statOptions() }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Graphics catalog failed", error);
    return NextResponse.json({ ok: false, error: "Couldn't load the graphics list." }, { status: 500 });
  }
}
