import { NextResponse } from "next/server";
import { AppealError, appealIdentity, clearAppealIdentity, myAppeals, myPunishments, submitAppeal } from "../../../../lib/appeals";
import { HOUR, allow, clientIp } from "../../../../lib/rate-limit";

export const dynamic = "force-dynamic";

const sameOrigin = (request: Request) => request.headers.get("origin") === new URL(request.url).origin;

/** The signed-in (via Discord) appellant: their punishments and appeals. */
export async function GET() {
  const me = await appealIdentity();
  if (!me) return NextResponse.json({ ok: true, me: null }, { headers: { "Cache-Control": "no-store" } });
  try {
    const [punishments, appeals] = await Promise.all([myPunishments(me.discordId), myAppeals(me.discordId)]);
    return NextResponse.json({ ok: true, me, punishments, appeals }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Appeal lookup failed", error);
    return NextResponse.json({ ok: false, error: "We couldn't load your record right now. Please try again." }, { status: 500 });
  }
}

/** Files an appeal: { punishmentId, message, email? }. */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ ok: false, error: "Invalid request origin." }, { status: 403 });
  const me = await appealIdentity();
  if (!me) return NextResponse.json({ ok: false, error: "Your Discord sign-in expired. Please continue with Discord again." }, { status: 401 });
  if (!(await allow([{ key: `appeal-submit:${me.discordId}`, limit: 5, windowMs: 24 * HOUR }, { key: `appeal-submit-ip:${await clientIp()}`, limit: 10, windowMs: 24 * HOUR }]))) {
    return NextResponse.json({ ok: false, error: "You've sent a lot of appeals today. Please try again tomorrow." }, { status: 429 });
  }
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    return NextResponse.json({ ok: true, ...(await submitAppeal(me, body)) });
  } catch (error) {
    if (error instanceof AppealError) return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    console.error("Appeal submit failed", error);
    return NextResponse.json({ ok: false, error: "That didn't send. Please try again." }, { status: 500 });
  }
}

/** "Not you?" forgets the Discord sign-in. */
export async function DELETE(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ ok: false, error: "Invalid request origin." }, { status: 403 });
  await clearAppealIdentity();
  return NextResponse.json({ ok: true });
}
