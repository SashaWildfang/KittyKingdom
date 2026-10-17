import { NextResponse } from "next/server";
import { getCurrentSessionId, getSessionUserId } from "../../../../lib/auth";
import { sessionsCollection } from "../../../../lib/sessions";

export const dynamic = "force-dynamic";
const NO_STORE = { "Cache-Control": "no-store" };
// Signed-in devices seen in the last 30 days (older sign-ins have expired anyway)
const RECENT_MS = 30 * 86_400_000;

/** Settings → Security → Devices & sessions: where this account is signed in. */
export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ ok: false, error: "Please log in." }, { status: 401 });
  const current = await getCurrentSessionId();
  const rows = await (await sessionsCollection())
    .find({ userId, revokedAt: { $exists: false }, lastSeenAt: { $gte: new Date(Date.now() - RECENT_MS) } })
    .sort({ lastSeenAt: -1 })
    .limit(30)
    .toArray();
  const sessions = rows.map((r) => ({
    id: r._id,
    current: r._id === current,
    device: r.device,
    place: [r.location?.city, r.location?.region, r.location?.country].filter(Boolean).join(", ") || null,
    lastSeenAt: r.lastSeenAt.toISOString(),
    createdAt: r.createdAt.toISOString(),
  }));
  return NextResponse.json({ ok: true, sessions }, { headers: NO_STORE });
}

/** Signs out one other device (?id=) or every other device (?others=1). This device signs out with Log out. */
export async function DELETE(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) return NextResponse.json({ ok: false, error: "Invalid request origin." }, { status: 403 });
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ ok: false, error: "Please log in." }, { status: 401 });
  const current = await getCurrentSessionId();
  const params = new URL(request.url).searchParams;
  const id = params.get("id");
  const col = await sessionsCollection();
  const end = { $set: { revokedAt: new Date(), revokedBy: "member" } };
  if (params.get("others") === "1") {
    const res = await col.updateMany({ userId, revokedAt: { $exists: false }, ...(current ? { _id: { $ne: current } } : {}) }, end);
    return NextResponse.json({ ok: true, ended: res.modifiedCount });
  }
  if (!id || id === current) return NextResponse.json({ ok: false, error: "Pick another device. To sign out here, use Log out." }, { status: 400 });
  const res = await col.updateOne({ _id: id, userId, revokedAt: { $exists: false } }, end);
  return NextResponse.json({ ok: Boolean(res.modifiedCount), ended: res.modifiedCount, ...(res.modifiedCount ? {} : { error: "That device is already signed out." }) });
}
