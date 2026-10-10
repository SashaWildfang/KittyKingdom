import { NextResponse } from "next/server";
import { requirePanel } from "../../../../lib/admin";
import { StatusError, createIncident, listIncidents } from "../../../../lib/status";

export const dynamic = "force-dynamic";

function fail(error: unknown) {
  if (error instanceof StatusError) return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
  console.error("Status admin failed", error);
  return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500 });
}

/** Admins: every incident (newest first). */
export async function GET(request: Request) {
  const panel = await requirePanel(request, "admin");
  if (panel instanceof NextResponse) return panel;
  try {
    return NextResponse.json({ ok: true, incidents: await listIncidents() }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return fail(error);
  }
}

/** Admins: post an incident or schedule maintenance. */
export async function POST(request: Request) {
  const panel = await requirePanel(request, "admin");
  if (panel instanceof NextResponse) return panel;
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    return NextResponse.json({ ok: true, ...(await createIncident(body, panel.discordId)) });
  } catch (error) {
    return fail(error);
  }
}
