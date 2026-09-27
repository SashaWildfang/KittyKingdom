import { NextResponse } from "next/server";
import { requirePanel } from "../../../../../lib/admin";
import { pendingJoinCount } from "../../../../../lib/join-apps";

export const dynamic = "force-dynamic";

/** How many applications are waiting (the bubble on the Join Apps tab). */
export async function GET(request: Request) {
  const panel = await requirePanel(request);
  if (panel instanceof NextResponse) return panel;
  const pending = await pendingJoinCount().catch(() => null);
  return NextResponse.json({ ok: true, pending }, { headers: { "Cache-Control": "no-store" } });
}
