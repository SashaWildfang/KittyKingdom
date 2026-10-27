import { NextResponse } from "next/server";
import { requirePanel } from "../../../../../../lib/admin";
import { people } from "../../../../../../lib/admin-people";
import { memberTimeline } from "../../../../../../lib/member-timeline";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

/** Everything that happened with one member, newest first. */
export async function GET(request: Request, { params }: { params: { userId: string } }) {
  const panel = await requirePanel(request);
  if (panel instanceof NextResponse) return panel;
  if (!/^\d{15,21}$/.test(params.userId)) return NextResponse.json({ ok: false, error: "Invalid Discord ID." }, { status: 400 });
  try {
    const events = await memberTimeline(panel, params.userId);
    return NextResponse.json({ ok: true, events, people: await people(events.map((e) => e.by)) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Member timeline failed", error);
    return NextResponse.json({ ok: false, error: "Couldn't load their history." }, { status: 500 });
  }
}
