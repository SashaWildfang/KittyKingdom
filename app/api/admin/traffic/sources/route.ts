import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../../lib/admin";
import { growthBySource } from "../../../../../lib/growth";

export const dynamic = "force-dynamic";

/** Visitors, invite clicks, sign-ups and Discord links per source (last 30 days). */
export async function GET(request: Request) {
  const admin = await requireAdmin(request);
  if (admin instanceof NextResponse) return admin;
  return NextResponse.json({ ok: true, rows: await growthBySource(30) }, { headers: { "Cache-Control": "no-store" } });
}
