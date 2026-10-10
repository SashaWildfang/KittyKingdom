import { NextResponse } from "next/server";
import { requirePanel } from "../../../../lib/admin";
import { people } from "../../../../lib/admin-people";
import { EventError, createEvent, staffEvents } from "../../../../lib/events";

export const dynamic = "force-dynamic";

function fail(error: unknown) {
  if (error instanceof EventError) return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
  console.error("Events admin failed", error);
  return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500 });
}

/** Staff: upcoming and past events. */
export async function GET(request: Request) {
  const panel = await requirePanel(request, "staff");
  if (panel instanceof NextResponse) return panel;
  try {
    const data = await staffEvents();
    const who = await people([...data.upcoming, ...data.past].flatMap((e) => [e.hostId, e.createdBy]));
    return NextResponse.json({ ok: true, ...data, people: who }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return fail(error);
  }
}

/** Staff: plan an event. */
export async function POST(request: Request) {
  const panel = await requirePanel(request, "staff");
  if (panel instanceof NextResponse) return panel;
  try {
    const body = await request.json().catch(() => ({}));
    return NextResponse.json({ ok: true, ...(await createEvent(body, panel.discordId)) });
  } catch (error) {
    return fail(error);
  }
}
