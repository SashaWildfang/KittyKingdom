import { NextResponse } from "next/server";
import { ExplicitError, addExplicit, reorderExplicit } from "../../../../lib/dating/explicit";
import { getProfile, ownProfileData } from "../../../../lib/dating/profiles";
import { requireDating, sameOrigin } from "../../../../lib/dating/route-helpers";
import { HOUR, allow } from "../../../../lib/rate-limit";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const fail = (error: unknown) =>
  error instanceof ExplicitError
    ? NextResponse.json({ ok: false, error: error.message }, { status: error.status })
    : NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "That didn't work." }, { status: 400 });

/** Adds an explicit photo to your profile (form: file, confirmed=1). */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ ok: false, error: "Invalid request origin." }, { status: 403 });
  const me = await requireDating();
  if (me instanceof NextResponse) return me;
  if (me.readOnly) return NextResponse.json({ ok: false, error: "Not while viewing as someone else." }, { status: 403 });
  if (!(await allow([{ key: `dating-explicit:${me.discordId}`, limit: 30, windowMs: HOUR }]))) return NextResponse.json({ ok: false, error: "That's a lot of uploads. Try again in a bit." }, { status: 429 });
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!file || typeof file === "string") return NextResponse.json({ ok: false, error: "Pick a photo." }, { status: 400 });
  try {
    await addExplicit(me.discordId, Buffer.from(await file.arrayBuffer()), form?.get("confirmed") === "1");
    return NextResponse.json({ ok: true, profile: ownProfileData(await getProfile(me.discordId)) });
  } catch (error) {
    return fail(error);
  }
}

/** Reorders your explicit photos: {order: [ids]}. */
export async function PUT(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ ok: false, error: "Invalid request origin." }, { status: 403 });
  const me = await requireDating();
  if (me instanceof NextResponse) return me;
  if (me.readOnly) return NextResponse.json({ ok: false, error: "Not while viewing as someone else." }, { status: 403 });
  try {
    const body = (await request.json().catch(() => ({}))) as { order?: unknown };
    await reorderExplicit(me.discordId, body.order);
    return NextResponse.json({ ok: true, profile: ownProfileData(await getProfile(me.discordId)) });
  } catch (error) {
    return fail(error);
  }
}
