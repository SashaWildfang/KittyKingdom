import { NextResponse } from "next/server";
import { hashPassword } from "../../../../lib/auth";
import { isDatabaseConnectionError } from "../../../../lib/db-errors";
import { createLinkCode } from "../../../../lib/link-codes";
import { getUsersCollection } from "../../../../lib/mongodb";
import { HOUR, allow, clientIp } from "../../../../lib/rate-limit";
import { removeAbandonedRegistrations, setRegistrationCookie } from "../../../../lib/registration";
import { cleanEmail, cleanPassword, isFormPost } from "../../../../lib/validate";

export const maxDuration = 10;

export async function POST(request: Request) {
  const origin = new URL(request.url).origin;

  try {
    if (!isFormPost(request)) return NextResponse.redirect(`${origin}/register?register=email-required`, 303);
    const form = await request.formData();
    const email = cleanEmail(form.get("email"));
    const password = cleanPassword(form.get("password")) ?? "";
    const acceptedPolicies = form.get("acceptedPolicies") === "yes";

    if (!(await allow([{ key: `register:ip:${await clientIp()}`, limit: 6, windowMs: HOUR }]))) {
      return NextResponse.redirect(`${origin}/register?register=too-many`, 303);
    }

    if (!email) {
      return NextResponse.redirect(
        `${origin}/register?register=email-required`,
        303,
      );
    }

    if (!acceptedPolicies) {
      return NextResponse.redirect(
        `${origin}/register?register=terms-required`,
        303,
      );
    }

    if (!/^(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/.test(password)) {
      return NextResponse.redirect(
        `${origin}/register?register=password-requirements`,
        303,
      );
    }

    const users = await getUsersCollection();
    await removeAbandonedRegistrations().catch(() => undefined);
    const existing = await users.findOne({ email });
    if (existing?.registration?.pending && !existing.discordId) {
      // An earlier sign-up with this email was never finished: start over
      await users.deleteOne({ _id: existing._id });
    } else if (existing) {
      return NextResponse.redirect(
        `${origin}/register?register=email-exists`,
        303,
      );
    }

    const { salt, hash } = hashPassword(password);
    const now = new Date();
    // The account stays unfinished until a verified server member links it with /link;
    // the email-verification link is sent after that (lib/registration.ts)
    const { insertedId } = await users.insertOne({
      email,
      // No username field until one is chosen: the unique username index skips missing
      // fields but not nulls, so storing null here blocked every signup after the first.
      passwordSalt: salt,
      passwordHash: hash,
      emailVerified: false,
      emailVerificationTokens: [],
      acceptedPoliciesAt: now,
      discord: null,
      registration: { pending: true, startedAt: now, source: signupSource(request) },
      createdAt: now,
      updatedAt: now,
    });
    await createLinkCode(insertedId);
    await setRegistrationCookie(insertedId);
    return NextResponse.redirect(`${origin}/register?step=link`, 303);
  } catch (error) {
    console.error("Registration failed", error);
    // Two signups with the same email at the same moment: the unique index catches the second
    if ((error as { code?: number })?.code === 11000 && JSON.stringify((error as { keyPattern?: unknown }).keyPattern ?? {}).includes("email")) {
      return NextResponse.redirect(`${origin}/register?register=email-exists`, 303);
    }
    const status = isDatabaseConnectionError(error)
      ? "database-unreachable"
      : "service-unavailable";
    return NextResponse.redirect(`${origin}/home?register=${status}`, 303);
  }
}

/** Which ad or site sent this sign-up (first ?ref= they arrived with), for the growth stats. */
function signupSource(request: Request) {
  const match = (request.headers.get("cookie") ?? "").match(/(?:^|;\s*)kk_src=([a-z0-9._-]{1,40})/);
  return match ? match[1] : "direct";
}
