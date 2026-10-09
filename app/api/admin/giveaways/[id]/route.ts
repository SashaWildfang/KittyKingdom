import { NextResponse } from "next/server";
import { requirePanel } from "../../../../../lib/admin";
import { GiveawayError, deleteGiveaway, getGiveaway, updateGiveaway } from "../../../../../lib/giveaways";

export const dynamic = "force-dynamic";

function fail(error: unknown) {
  if (error instanceof GiveawayError) return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
  console.error("Giveaway failed", error);
  return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500 });
}

/** Admins: one giveaway with its entries (?page=). */
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const panel = await requirePanel(request, "admin");
  if (panel instanceof NextResponse) return panel;
  try {
    const data = await getGiveaway(params.id, Number(new URL(request.url).searchParams.get("page") ?? 1));
    return NextResponse.json({ ok: true, ...data }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return fail(error);
  }
}

/** Admins: edit an upcoming or running giveaway. */
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const panel = await requirePanel(request, "admin");
  if (panel instanceof NextResponse) return panel;
  try {
    const body = await request.json().catch(() => ({}));
    return NextResponse.json(await updateGiveaway(params.id, body, panel.discordId));
  } catch (error) {
    return fail(error);
  }
}

/** Admins: delete a giveaway that isn't running. */
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const panel = await requirePanel(request, "admin");
  if (panel instanceof NextResponse) return panel;
  try {
    return NextResponse.json(await deleteGiveaway(params.id));
  } catch (error) {
    return fail(error);
  }
}
