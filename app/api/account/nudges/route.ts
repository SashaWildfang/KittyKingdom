import { Long } from "mongodb";
import { NextResponse } from "next/server";
import { getCurrentUser, getViewAs } from "../../../../lib/auth";
import { getBotCollection, getUsersCollection } from "../../../../lib/mongodb";

export const dynamic = "force-dynamic";

// Gentle reminders after signing in: pick a username, and refresh a Social profile that's gone stale.
// "Later" hides one for a week, "Don't ask again" for good. Saved on the account (users.nudges) so it
// follows the member across devices.
const STALE_DAYS = 90;
const SNOOZE_DAYS = 7;
type Nudge = { until?: Date | null; never?: boolean };

const waiting = (n: Nudge | undefined) => !n?.never && !(n?.until instanceof Date && n.until.getTime() > Date.now());

/** Which reminders are due for the signed-in member. */
export async function GET() {
  const user = await getCurrentUser().catch(() => null);
  if (!user || (await getViewAs())) return NextResponse.json({ ok: true, due: [] });
  const nudges = (user.nudges ?? {}) as Record<string, Nudge>;
  const due: { kind: "username" | "social"; updatedAt?: string | null }[] = [];
  if (!user.username && waiting(nudges.username)) due.push({ kind: "username" });
  if (user.discordId && waiting(nudges.social)) {
    const profile = await (await getBotCollection("dating_profiles"))
      .findOne({ _id: Long.fromString(String(user.discordId)) } as never, { projection: { updated_at: 1 } })
      .catch(() => null);
    const at = profile?.updated_at instanceof Date ? profile.updated_at : profile?.updated_at ? new Date(String(profile.updated_at)) : null;
    if (profile && (!at || Date.now() - at.getTime() > STALE_DAYS * 86_400_000)) due.push({ kind: "social", updatedAt: at && !Number.isNaN(at.getTime()) ? at.toISOString() : null });
  }
  return NextResponse.json({ ok: true, due }, { headers: { "Cache-Control": "no-store" } });
}

/** {kind, action: "later" | "never"} */
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return NextResponse.json({ ok: false }, { status: 403 });
  const user = await getCurrentUser().catch(() => null);
  if (!user || (await getViewAs())) return NextResponse.json({ ok: false }, { status: 403 });
  const body = (await request.json().catch(() => ({}))) as { kind?: string; action?: string };
  if (body.kind !== "username" && body.kind !== "social") return NextResponse.json({ ok: false }, { status: 400 });
  const value: Nudge = body.action === "never" ? { never: true } : { until: new Date(Date.now() + SNOOZE_DAYS * 86_400_000) };
  await (await getUsersCollection()).updateOne({ _id: user._id }, { $set: { [`nudges.${body.kind}`]: value } });
  return NextResponse.json({ ok: true });
}
