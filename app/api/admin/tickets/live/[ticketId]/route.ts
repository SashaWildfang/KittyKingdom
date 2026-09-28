import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../../../lib/admin";
import { ticketLive } from "../../../../../../lib/ticket-live";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

/** The messages in an open ticket's channel (read only), newer than ?after= when given. */
export async function GET(request: Request, { params }: { params: { ticketId: string } }) {
  const admin = await requireAdmin(request);
  if (admin instanceof NextResponse) return admin;
  const id = Number(params.ticketId);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ ok: false, error: "Unknown ticket." }, { status: 400 });
  try {
    const live = await ticketLive(id, new URL(request.url).searchParams.get("after"));
    if (!live) return NextResponse.json({ ok: false, error: "That ticket isn't open any more." }, { status: 404 });
    return NextResponse.json({ ok: true, ...live }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Couldn't load the ticket." }, { status: 502 });
  }
}
