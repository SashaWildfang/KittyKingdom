import { NextResponse } from "next/server";
import { createVerificationTokenEntry, hashPassword } from "../../../../lib/auth";
import { isDatabaseConnectionError } from "../../../../lib/db-errors";
import { sendVerificationEmail } from "../../../../lib/email";
import { getUsersCollection } from "../../../../lib/mongodb";
import { HOUR, allow, clientIp } from "../../../../lib/rate-limit";
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
    const existing = await users.findOne({ email });
    if (existing) {
      return NextResponse.redirect(
        `${origin}/register?register=email-exists`,
        303,
      );
    }

    const { salt, hash } = hashPassword(password);
    const { token, entry } = createVerificationTokenEntry();
    const verifyUrl = `${origin}/api/account/verify-email?token=${token}`;

    await users.insertOne({
      email,
      // No username field until one is chosen: the unique username index skips missing
      // fields but not nulls, so storing null here blocked every signup after the first.
      passwordSalt: salt,
      passwordHash: hash,
      emailVerified: false,
      emailVerificationTokens: [entry],
      acceptedPoliciesAt: new Date(),
      discord: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const emailResult = await sendVerificationEmail(email, verifyUrl);
    const status = emailResult.sent ? "check-email" : "email-provider-needed";
    return NextResponse.redirect(`${origin}/home?register=${status}`, 303);
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
