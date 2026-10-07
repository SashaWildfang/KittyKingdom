import { NextResponse } from "next/server";
import { requirePanel } from "../../../../../../lib/admin";
import { joinActionStatus } from "../../../../../../lib/join-apps";

export const dynamic = "force-dynamic";

/** Whether the bot has finished a queued decision yet. */
export async function GET(request: Request, props: { params: Promise<{ actionId: string }> }) {
  const params = await props.params;
  const panel = await requirePanel(request);
  if (panel instanceof NextResponse) return panel;
  const status = await joinActionStatus(params.actionId);
  if (!status) return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
  return NextResponse.json({ ok: true, ...status }, { headers: { "Cache-Control": "no-store" } });
}
