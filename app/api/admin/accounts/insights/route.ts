import { NextResponse } from "next/server";
import { accountSegmentInsights, type AccountSegment } from "../../../../../lib/accounts-admin";
import { requireAdmin } from "../../../../../lib/admin";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const admin = await requireAdmin(request);
  if (admin instanceof NextResponse) return admin;
  const segment = new URL(request.url).searchParams.get("segment") as AccountSegment;
  if (!["all", "verified", "linked", "unverified"].includes(segment)) return NextResponse.json({ ok: false, error: "Unknown group." }, { status: 400 });
  return NextResponse.json({ ok: true, ...(await accountSegmentInsights(segment)) }, { headers: { "Cache-Control": "no-store" } });
}
