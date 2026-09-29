import { NextResponse } from "next/server";
import { getCurrentUser } from "../../../../lib/auth";
import { activeLinkCode, createLinkCode, formatCode } from "../../../../lib/link-codes";
import { HOUR, allow } from "../../../../lib/rate-limit";

export const dynamic = "force-dynamic";

/** Link status for the account page: linked yet? and the current code, if any. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Please log in." }, { status: 401 });
  if (user.discordId) {
    return NextResponse.json({ ok: true, linked: true, discordName: String(user.discord?.globalName ?? user.discord?.username ?? user.discordId) }, { headers: { "Cache-Control": "no-store" } });
  }
  if (user.emailVerified !== true) {
    return NextResponse.json({ ok: true, linked: false, needsEmail: true, code: null, expiresAt: null }, { headers: { "Cache-Control": "no-store" } });
  }
  const active = await activeLinkCode(user._id);
  return NextResponse.json(
    { ok: true, linked: false, code: active ? formatCode(active._id) : null, expiresAt: active?.expiresAt.toISOString() ?? null },
    { headers: { "Cache-Control": "no-store" } },
  );
}

/** Makes a new code (the old one stops working). */
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) return NextResponse.json({ ok: false, error: "Invalid request origin." }, { status: 403 });
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Please log in." }, { status: 401 });
  if (user.discordId) return NextResponse.json({ ok: false, error: "Your Discord is already linked." }, { status: 409 });
  // Email first: a mistyped address would otherwise leave a linked account nobody can confirm
  if (user.emailVerified !== true) return NextResponse.json({ ok: false, error: "Confirm your email address first, then you can link Discord." }, { status: 403 });
  if (!(await allow([{ key: `linkcode:${String(user._id)}`, limit: 12, windowMs: HOUR }]))) {
    return NextResponse.json({ ok: false, error: "You've made a lot of codes. Please wait a bit before getting another." }, { status: 429 });
  }
  const { code, expiresAt } = await createLinkCode(user._id);
  return NextResponse.json({ ok: true, code: formatCode(code), expiresAt: expiresAt.toISOString() }, { headers: { "Cache-Control": "no-store" } });
}
