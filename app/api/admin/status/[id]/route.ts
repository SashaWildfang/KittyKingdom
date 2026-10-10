import { NextResponse } from "next/server";
import { requirePanel } from "../../../../../lib/admin";
import { StatusError, deleteIncident, updateIncident } from "../../../../../lib/status";

export const dynamic = "force-dynamic";

function fail(error: unknown) {
  if (error instanceof StatusError) return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
  console.error("Status admin failed", error);
  return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500 });
}

/** Admins: post an update on an incident ({status, text}); "resolved" closes it. */
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const panel = await requirePanel(request, "admin");
  if (panel instanceof NextResponse) return panel;
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    await updateIncident(params.id, body, panel.discordId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return fail(error);
  }
}

/** Admins: delete an incident (e.g. posted by mistake). */
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const panel = await requirePanel(request, "admin");
  if (panel instanceof NextResponse) return panel;
  try {
    await deleteIncident(params.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return fail(error);
  }
}
