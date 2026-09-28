import { NextResponse } from "next/server";
import { invalidatePool } from "../../../../lib/dating/pool";
import { deleteProfile, getProfile, ownProfileData, profileView, saveProfile, type ProfilePatch } from "../../../../lib/dating/profiles";
import { requireDating, sameOrigin } from "../../../../lib/dating/route-helpers";
import { deletePhoto } from "../../../../lib/dating/media";
import { hasOperatorKeys } from "../../../../lib/validate";

export const dynamic = "force-dynamic";

/** Your own dating profile: the editor's values, review flags, strength tips and how others see it. */
export async function GET() {
  const me = await requireDating();
  if (me instanceof NextResponse) return me;
  const doc = await getProfile(me.discordId);
  return NextResponse.json(
    { ok: true, booster: me.booster, profile: ownProfileData(doc), view: doc ? await profileView(doc, { viewerIsOwner: true }) : null },
    { headers: { "Cache-Control": "no-store" } },
  );
}

/** Saves changes (creates the profile the first time). */
export async function PUT(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ ok: false, error: "Invalid request origin." }, { status: 403 });
  const me = await requireDating();
  if (me instanceof NextResponse) return me;
  const body = (await request.json().catch(() => null)) as ProfilePatch | null;
  if (!body || typeof body !== "object" || hasOperatorKeys(body)) return NextResponse.json({ ok: false, error: "Invalid profile." }, { status: 400 });
  const error = await saveProfile(me.discordId, body);
  if (error) return NextResponse.json({ ok: false, error }, { status: 400 });
  invalidatePool();
  const doc = await getProfile(me.discordId);
  return NextResponse.json({ ok: true, profile: ownProfileData(doc), view: doc ? await profileView(doc, { viewerIsOwner: true }) : null });
}

/** Deletes your dating profile, likes, matches and photos. Needs { confirm: "DELETE" }. */
export async function DELETE(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ ok: false, error: "Invalid request origin." }, { status: 403 });
  const me = await requireDating();
  if (me instanceof NextResponse) return me;
  const body = (await request.json().catch(() => null)) as { confirm?: string } | null;
  if (body?.confirm !== "DELETE") return NextResponse.json({ ok: false, error: "Type DELETE to confirm." }, { status: 400 });
  const doc = await getProfile(me.discordId);
  for (const p of (doc?.photos ?? []) as { id: string }[]) await deletePhoto(p.id);
  await deleteProfile(me.discordId);
  invalidatePool();
  return NextResponse.json({ ok: true });
}
