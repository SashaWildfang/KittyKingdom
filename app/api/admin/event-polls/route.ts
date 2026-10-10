import { NextResponse } from "next/server";
import { requirePanel } from "../../../../lib/admin";
import { people } from "../../../../lib/admin-people";
import { EventError } from "../../../../lib/events";
import { createPoll, staffPolls } from "../../../../lib/event-polls";

export const dynamic = "force-dynamic";

function fail(error: unknown) {
  if (error instanceof EventError) return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
  console.error("Event polls admin failed", error);
  return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500 });
}

/** Staff: recent event polls with their results. */
export async function GET(request: Request) {
  const panel = await requirePanel(request, "staff");
  if (panel instanceof NextResponse) return panel;
  try {
    const polls = await staffPolls();
    return NextResponse.json({ ok: true, polls, people: await people(polls.map((p) => p.createdBy)) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return fail(error);
  }
}

/** Staff: write a poll (the Main Bot posts it within a minute). */
export async function POST(request: Request) {
  const panel = await requirePanel(request, "staff");
  if (panel instanceof NextResponse) return panel;
  try {
    const body = await request.json().catch(() => ({}));
    return NextResponse.json({ ok: true, ...(await createPoll(body, panel.discordId)) });
  } catch (error) {
    return fail(error);
  }
}
