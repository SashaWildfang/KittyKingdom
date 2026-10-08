import { NextResponse } from "next/server";
import { verifyPassword } from "../../../../lib/auth";
import { getUsersCollection } from "../../../../lib/mongodb";
import { HOUR, allow, clientIp } from "../../../../lib/rate-limit";
import { changeUnverifiedEmail, pendingRegistration } from "../../../../lib/registration";
import { BLOCKED_EMAIL_MESSAGE, cleanEmail, cleanIdentifier, cleanPassword, hasOperatorKeys, isBlockedEmailDomain } from "../../../../lib/validate";

export const maxDuration = 10;

/**
 * Fixes a mistyped email on an account that hasn't confirmed it yet, and sends the link to the new
 * address. { email } during sign-up (this browser's sign-up), or { identifier, password, email } from
 * the login page. Accounts with a confirmed email can't be changed here.
 */
export async function POST(request: Request) {
  const origin = new URL(request.url).origin;
  if (request.headers.get("origin") !== origin) return NextResponse.json({ ok: false, message: "Invalid request origin." }, { status: 403 });

  const body = (await request.json().catch(() => null)) as unknown;
  if (!body || typeof body !== "object" || hasOperatorKeys(body)) return NextResponse.json({ ok: false, message: "Invalid request." }, { status: 400 });
  const input = body as { email?: unknown; identifier?: unknown; password?: unknown };
  const email = cleanEmail(input.email);
  if (!email) return NextResponse.json({ ok: false, message: "Enter a valid email address." }, { status: 400 });
  if (isBlockedEmailDomain(email)) return NextResponse.json({ ok: false, message: BLOCKED_EMAIL_MESSAGE }, { status: 400 });

  if (!(await allow([{ key: `change-email:ip:${await clientIp()}`, limit: 8, windowMs: HOUR }]))) {
    return NextResponse.json({ ok: false, message: "You've tried a few times already. Please wait a while, then try again." }, { status: 429 });
  }

  try {
    let user = input.identifier === undefined ? await pendingRegistration() : null;
    if (input.identifier !== undefined) {
      const identifier = cleanIdentifier(input.identifier);
      const password = cleanPassword(input.password);
      if (!identifier || !password) return NextResponse.json({ ok: false, message: "Enter your current email (or username) and password." }, { status: 400 });
      if (!(await allow([{ key: `change-email:id:${identifier}`, limit: 5, windowMs: HOUR }]))) {
        return NextResponse.json({ ok: false, message: "You've tried a few times already. Please wait a while, then try again." }, { status: 429 });
      }
      const found = await (await getUsersCollection()).findOne({ $or: [{ email: identifier }, { username: identifier }] });
      if (!found || !verifyPassword(password, found.passwordSalt, found.passwordHash)) {
        return NextResponse.json({ ok: false, message: "That email/username and password don't match." }, { status: 401 });
      }
      user = found;
    }
    if (!user) return NextResponse.json({ ok: false, message: "We couldn't find your sign-up. It may have expired, so please start again." }, { status: 404 });

    const problem = await changeUnverifiedEmail(user, email, origin);
    if (problem) return NextResponse.json({ ok: false, message: problem }, { status: 409 });
    return NextResponse.json({ ok: true, email, message: `Updated. We sent a new confirmation link to ${email}.` });
  } catch (error) {
    console.error("Change unverified email failed", error);
    return NextResponse.json({ ok: false, message: "That didn't work right now. Please try again in a moment." }, { status: 500 });
  }
}
