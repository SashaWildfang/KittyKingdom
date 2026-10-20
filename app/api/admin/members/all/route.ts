import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../../lib/admin";
import { membersSnapshot } from "../../../../../lib/members-manager";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** Every server member with roles and stats (Admin → Members → Discord Members). ?fresh=1 skips the 1-minute cache. */
export async function GET(request: Request) {
  const admin = await requireAdmin(request);
  if (admin instanceof NextResponse) return admin;
  try {
    const data = await membersSnapshot(new URL(request.url).searchParams.get("fresh") === "1");
    return NextResponse.json({ ok: true, ...data }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Couldn't load the member list." }, { status: 502 });
  }
}
