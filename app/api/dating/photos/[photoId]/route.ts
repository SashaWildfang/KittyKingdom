import { NextResponse } from "next/server";
import { invalidatePool } from "../../../../../lib/dating/pool";
import { datingCols, toLong } from "../../../../../lib/dating/db";
import { deletePhoto } from "../../../../../lib/dating/media";
import { getProfile, ownProfileData } from "../../../../../lib/dating/profiles";
import { requireDating, sameOrigin } from "../../../../../lib/dating/route-helpers";

export const dynamic = "force-dynamic";

/** Removes one of your photos. */
export async function DELETE(request: Request, { params }: { params: { photoId: string } }) {
  if (!sameOrigin(request)) return NextResponse.json({ ok: false, error: "Invalid request origin." }, { status: 403 });
  const me = await requireDating();
  if (me instanceof NextResponse) return me;
  const { profiles } = await datingCols();
  const res = await profiles.updateOne({ _id: toLong(me.discordId), "photos.id": params.photoId } as never, { $pull: { photos: { id: params.photoId } } } as never);
  if (res.modifiedCount) await deletePhoto(params.photoId);
  invalidatePool();
  return NextResponse.json({ ok: true, profile: ownProfileData(await getProfile(me.discordId)) });
}
