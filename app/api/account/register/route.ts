import { NextResponse } from "next/server";
import { createVerificationToken, hashPassword } from "../../../../lib/auth";
import { sendVerificationEmail } from "../../../../lib/email";
import { getUsersCollection } from "../../../../lib/mongodb";

export async function POST(request: Request) {
  const form = await request.formData();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const confirmEmail = String(form.get("confirmEmail") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const origin = new URL(request.url).origin;

  if (!email || !confirmEmail || email !== confirmEmail) {
    return NextResponse.redirect(`${origin}/?register=email-mismatch#register`, 303);
  }

  if (password.length < 8) {
    return NextResponse.redirect(`${origin}/?register=password-too-short#register`, 303);
  }

  const users = await getUsersCollection();
  const existing = await users.findOne({ email });
  if (existing) {
    return NextResponse.redirect(`${origin}/?register=email-exists#register`, 303);
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
    discord: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const emailResult = await sendVerificationEmail(email, verifyUrl);
  const status = emailResult.sent ? "check-email" : "email-provider-needed";
  return NextResponse.redirect(`${origin}/?register=${status}#register`, 303);
}
