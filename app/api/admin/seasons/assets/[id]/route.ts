import { NextResponse } from "next/server";
import { requirePanel } from "../../../../../../lib/admin";
import { SeasonError, deleteAsset, useAsset } from "../../../../../../lib/season-store";
import { ASSET_KINDS, SEASON_KEYS, type AssetKind, type SeasonKey } from "../../../../../../lib/seasons";

export const dynamic = "force-dynamic";

function fail(error: unknown) {
  if (error instanceof SeasonError) return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
  console.error("Season asset failed", error);
  return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500 });
}

/** Admins: use this image for its season ({season, kind}); id "default" goes back to the built-in art. */
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const panel = await requirePanel(request, "admin");
  if (panel instanceof NextResponse) return panel;
  try {
    const body = (await request.json().catch(() => ({}))) as { season?: string; kind?: string };
    if (!SEASON_KEYS.includes(body.season as SeasonKey) || !ASSET_KINDS.includes(body.kind as AssetKind)) throw new SeasonError("Pick a season and kind.");
    await useAsset(body.season as SeasonKey, body.kind as AssetKind, params.id === "default" ? null : params.id, panel.discordId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return fail(error);
  }
}

/** Admins: delete an uploaded image for good. */
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const panel = await requirePanel(request, "admin");
  if (panel instanceof NextResponse) return panel;
  try {
    await deleteAsset(params.id, panel.discordId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return fail(error);
  }
}
