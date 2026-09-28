import { NextResponse } from "next/server";
import { invalidatePool } from "../../../../lib/dating/pool";
import { datingCols, toLong } from "../../../../lib/dating/db";
import { deletePhoto, savePhoto } from "../../../../lib/dating/media";
import { getProfile, ownProfileData } from "../../../../lib/dating/profiles";
import { requireDating, sameOrigin } from "../../../../lib/dating/route-helpers";
import { MAX_PHOTOS } from "../../../../lib/dating/schema";
import { HOUR, allow } from "../../../../lib/rate-limit";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** Adds a photo to your profile (SFW images only, location data removed). */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ ok: false, error: "Invalid request origin." }, { status: 403 });
  const me = await requireDating();
  if (me instanceof NextResponse) return me;
  if (!(await allow([{ key: `dating-photo:${me.discordId}`, limit: 30, windowMs: HOUR }]))) return NextResponse.json({ ok: false, error: "That's a lot of uploads. Try again in a bit." }, { status: 429 });
  const doc = await getProfile(me.discordId);
  if (!doc) return NextResponse.json({ ok: false, error: "Create your profile first." }, { status: 400 });
  if (((doc.photos ?? []) as unknown[]).length >= MAX_PHOTOS) return NextResponse.json({ ok: false, error: `You can have up to ${MAX_PHOTOS} photos. Remove one first.` }, { status: 400 });
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!file || typeof file === "string") return NextResponse.json({ ok: false, error: "Pick a photo." }, { status: 400 });
  try {
    const saved = await savePhoto(Buffer.from(await file.arrayBuffer()), me.discordId);
    const { profiles } = await datingCols();
    const res = await profiles.updateOne(
      { _id: toLong(me.discordId), [`photos.${MAX_PHOTOS - 1}`]: { $exists: false } } as never,
      { $push: { photos: { id: saved.id, ext: saved.ext } }, $set: { updated_at: new Date(), last_active: new Date() } } as never,
    );
    if (!res.modifiedCount) {
      await deletePhoto(saved.id);
      return NextResponse.json({ ok: false, error: `You can have up to ${MAX_PHOTOS} photos.` }, { status: 400 });
    }
    invalidatePool();
    return NextResponse.json({ ok: true, profile: ownProfileData(await getProfile(me.discordId)) });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Upload failed." }, { status: 400 });
  }
}
