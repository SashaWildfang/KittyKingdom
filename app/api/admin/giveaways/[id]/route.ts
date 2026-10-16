import { NextResponse } from "next/server";
import { requireGiveawayManager } from "../../../../../lib/giveaway-access";
import { GiveawayError, deleteGiveaway, getGiveaway, updateGiveaway } from "../../../../../lib/giveaways";

export const dynamic = "force-dynamic";

function fail(error: unknown) {
  if (error instanceof GiveawayError) return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
  console.error("Giveaway failed", error);
  return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500 });
}

/** One giveaway with its entries (?page=). */
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const panel = await requireGiveawayManager(request);
  if (panel instanceof NextResponse) return panel;
  try {
    const data = await getGiveaway(params.id, Number(new URL(request.url).searchParams.get("page") ?? 1));
    return NextResponse.json({ ok: true, ...data, isAdmin: panel.isAdmin }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return fail(error);
  }
}

/** Edit an upcoming, running or waiting giveaway. */
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const panel = await requireGiveawayManager(request);
  if (panel instanceof NextResponse) return panel;
  try {
    const body = await request.json().catch(() => ({}));
    return NextResponse.json(await updateGiveaway(params.id, body, panel));
  } catch (error) {
    return fail(error);
  }
}

/** Delete a giveaway that isn't running (admins; Community Managers only their own waiting ones). */
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const panel = await requireGiveawayManager(request);
  if (panel instanceof NextResponse) return panel;
  try {
    return NextResponse.json(await deleteGiveaway(params.id, panel));
  } catch (error) {
    return fail(error);
  }
}
