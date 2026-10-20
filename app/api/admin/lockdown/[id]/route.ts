import { NextResponse } from "next/server";
import { requirePanel } from "../../../../../lib/admin";
import { LockdownError, lockRequestStatus } from "../../../../../lib/lockdown";

export const dynamic = "force-dynamic";

/** Staff: whether the bot has finished one of your lock requests yet. */
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const panel = await requirePanel(request, "staff");
  if (panel instanceof NextResponse) return panel;
  try {
    return NextResponse.json({ ok: true, ...(await lockRequestStatus(params.id, panel)) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof LockdownError) return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500 });
  }
}
