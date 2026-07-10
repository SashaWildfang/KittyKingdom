import { NextResponse } from "next/server";
import { createVerificationToken, hashPassword } from "../../../../lib/auth";
import { isDatabaseConnectionError } from "../../../../lib/db-errors";
import { sendVerificationEmail } from "../../../../lib/email";
import { getUsersCollection } from "../../../../lib/mongodb";

export const maxDuration = 10;

export async function POST(request: Request) {
  const origin = new URL(request.url).origin;

  try {
    const form = await request.formData();
    const email = String(form.get("email") ?? "")
      .trim()
      .toLowerCase();
    const password = String(form.get("password") ?? "");
    const acceptedPolicies = form.get("acceptedPolicies") === "yes";

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
    const { token, tokenHash } = createVerificationToken();
    const verifyUrl = `${origin}/api/account/verify-email?token=${token}`;

    await users.insertOne({
      email,
      username: null,
      passwordSalt: salt,
      passwordHash: hash,
      emailVerified: false,
      emailVerificationTokenHash: tokenHash,
      emailVerificationExpiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
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
    const status = isDatabaseConnectionError(error)
      ? "database-unreachable"
      : "service-unavailable";
    return NextResponse.redirect(`${origin}/home?register=${status}`, 303);
  }
}
