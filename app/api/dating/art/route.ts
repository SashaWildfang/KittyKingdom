import { NextResponse } from "next/server";
import { savePhoto } from "../../../../lib/dating/media";
import { getProfile } from "../../../../lib/dating/profiles";
import { requireDating, sameOrigin } from "../../../../lib/dating/route-helpers";
import { HOUR, allow } from "../../../../lib/rate-limit";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** Uploads a piece of fursona art (SFW, metadata removed). Returns its URL to add to a fursona;
 *  it's attached (and kept) when the profile is saved. */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ ok: false, error: "Invalid request origin." }, { status: 403 });
  const me = await requireDating();
  if (me instanceof NextResponse) return me;
  if (!(await allow([{ key: `dating-photo:${me.discordId}`, limit: 30, windowMs: HOUR }]))) return NextResponse.json({ ok: false, error: "That's a lot of uploads. Try again in a bit." }, { status: 429 });
  if (!(await getProfile(me.discordId))) return NextResponse.json({ ok: false, error: "Create your profile first." }, { status: 400 });
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!file || typeof file === "string") return NextResponse.json({ ok: false, error: "Pick an image." }, { status: 400 });
  try {
    const saved = await savePhoto(Buffer.from(await file.arrayBuffer()), me.discordId);
    return NextResponse.json({ ok: true, url: `/api/dating/media/${saved.id}.${saved.ext}` });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Upload failed." }, { status: 400 });
  }
}
