import { NextResponse } from "next/server";
import { getAdminUser } from "../../../../../lib/admin";
import { getViewAs } from "../../../../../lib/auth";
import { datingAccess } from "../../../../../lib/dating/access";
import { adminMayView, canSeeExplicit, readExplicit, removeExplicit } from "../../../../../lib/dating/explicit";
import { getProfile, ownProfileData } from "../../../../../lib/dating/profiles";
import { requireDating, sameOrigin } from "../../../../../lib/dating/route-helpers";

export const dynamic = "force-dynamic";

/**
 * One explicit photo. Checked on every request: the viewer must be 18+ verified and allowed by the owner's
 * "Who can see my explicit photos" setting (or be an admin while a report about the owner is open).
 * Never cached by shared caches.
 */
export async function GET(_request: Request, { params }: { params: { file: string } }) {
  const id = params.file.split(".")[0];
  const photo = await readExplicit(id).catch(() => null);
  if (!photo) return new Response("Not found", { status: 404 });
  // An admin viewing the site as a member doesn't get that member's access: only the report rule below applies
  const viewingAs = Boolean(await getViewAs().catch(() => null));
  const access = viewingAs ? null : await datingAccess();
  let allowed = access?.ok === true && (await canSeeExplicit(access.discordId, photo.owner).catch(() => false));
  if (!allowed && (await getAdminUser().catch(() => null))) allowed = await adminMayView(photo.owner).catch(() => false);
  if (!allowed) return new Response("Not available", { status: 403 });
  return new Response(new Uint8Array(photo.data), {
    headers: {
      "Content-Type": photo.type,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "X-Robots-Tag": "noindex, noimageindex",
    },
  });
}

/** Removes one of your explicit photos (the segment is the photo id). */
export async function DELETE(request: Request, { params }: { params: { file: string } }) {
  if (!sameOrigin(request)) return NextResponse.json({ ok: false, error: "Invalid request origin." }, { status: 403 });
  const me = await requireDating();
  if (me instanceof NextResponse) return me;
  if (me.readOnly) return NextResponse.json({ ok: false, error: "Not while viewing as someone else." }, { status: 403 });
  await removeExplicit(me.discordId, params.file.split(".")[0]);
  return NextResponse.json({ ok: true, profile: ownProfileData(await getProfile(me.discordId)) });
}
