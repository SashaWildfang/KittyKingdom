import { NextResponse } from "next/server";
import { requirePanel } from "../../../../../lib/admin";
import { people } from "../../../../../lib/admin-people";
import { EventError, deleteEvent, eventGuests, setCancelled, updateEvent } from "../../../../../lib/events";

export const dynamic = "force-dynamic";

function fail(error: unknown) {
  if (error instanceof EventError) return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
  console.error("Event admin failed", error);
  return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500 });
}

/** Staff: who asked to be reminded. */
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const panel = await requirePanel(request, "staff");
  if (panel instanceof NextResponse) return panel;
  try {
    const ids = await eventGuests(params.id);
    return NextResponse.json({ ok: true, guests: ids, people: await people(ids) });
  } catch (error) {
    return fail(error);
  }
}

/** Staff: edit ({...event}) or {action: "cancel" | "restore"}. */
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const panel = await requirePanel(request, "staff");
  if (panel instanceof NextResponse) return panel;
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    if (body.action === "cancel" || body.action === "restore") await setCancelled(params.id, body.action === "cancel", panel.discordId);
    else await updateEvent(params.id, body, panel.discordId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return fail(error);
  }
}

/** Staff: delete an event (and its Discord copy). */
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const panel = await requirePanel(request, "staff");
  if (panel instanceof NextResponse) return panel;
  try {
    await deleteEvent(params.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return fail(error);
  }
}
