import { NextResponse } from "next/server";
import { getCurrentUser, getSessionUserId } from "../../../../lib/auth";
import { getEmailPrefs, setEmailPrefs } from "../../../../lib/email-prefs";
import { isEmailPrefKey } from "../../../../lib/email-prefs-shared";
import { MINUTE, hit } from "../../../../lib/rate-limit";

export const dynamic = "force-dynamic";
const NO_STORE = { "Cache-Control": "no-store" };

/** Settings → Email: which notification emails this account gets, and where they go. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Please log in." }, { status: 401 });
  const prefs = await getEmailPrefs(String(user._id));
  return NextResponse.json({ ok: true, prefs, email: String(user.email ?? ""), verified: user.emailVerified === true }, { headers: NO_STORE });
}

export async function PUT(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) return NextResponse.json({ ok: false, error: "Invalid request origin." }, { status: 403 });
  // Null while an admin is viewing the site as someone (read only)
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ ok: false, error: "Please log in." }, { status: 401 });
  if (!(await hit(`email-prefs:${userId}`, 40, MINUTE)).ok) return NextResponse.json({ ok: false, error: "You're changing these too fast. Try again in a minute." }, { status: 429 });
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const patch = Object.fromEntries(Object.entries(body ?? {}).filter(([k, v]) => isEmailPrefKey(k) && typeof v === "boolean")) as Record<string, boolean>;
  if (!Object.keys(patch).length) return NextResponse.json({ ok: false, error: "Nothing to change." }, { status: 400 });
  const prefs = await setEmailPrefs(String(userId), patch);
  return NextResponse.json({ ok: true, prefs }, { headers: NO_STORE });
}
