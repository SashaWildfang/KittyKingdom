import { NextResponse } from "next/server";
import { requirePanel } from "../../../../../lib/admin";
import { EventError } from "../../../../../lib/events";
import { deletePoll, endPoll } from "../../../../../lib/event-polls";

export const dynamic = "force-dynamic";

function fail(error: unknown) {
  if (error instanceof EventError) return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
  console.error("Event poll admin failed", error);
  return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500 });
}

/** Staff: {action: "end"} closes the poll early in Discord. */
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const panel = await requirePanel(request, "staff");
  if (panel instanceof NextResponse) return panel;
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    if (body.action !== "end") throw new EventError("Unknown action.");
    await endPoll(params.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return fail(error);
  }
}

/** Staff: delete a poll (and its Discord message). */
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const panel = await requirePanel(request, "staff");
  if (panel instanceof NextResponse) return panel;
  try {
    await deletePoll(params.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return fail(error);
  }
}
