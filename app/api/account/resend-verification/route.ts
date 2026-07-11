import { NextResponse } from "next/server";
import { createVerificationToken } from "../../../../lib/auth";
import { isDatabaseConnectionError } from "../../../../lib/db-errors";
import { sendVerificationEmail } from "../../../../lib/email";
import { getUsersCollection } from "../../../../lib/mongodb";

export const maxDuration = 10;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = url.origin;
  const identifier = String(url.searchParams.get("identifier") ?? "")
    .trim()
    .toLowerCase();

  try {
    if (!identifier) {
      return NextResponse.redirect(`${origin}/login?login=missing-identifier`, 303);
    }

    const users = await getUsersCollection();
    const user = await users.findOne({
      $or: [{ email: identifier }, { username: identifier }],
    });

    if (!user) {
      return NextResponse.redirect(`${origin}/login?login=verification-sent`, 303);
    }

    if (user.emailVerified) {
      return NextResponse.redirect(
        `${origin}/login?login=already-verified&identifier=${encodeURIComponent(identifier)}`,
        303,
      );
    }

    const { token, tokenHash } = createVerificationToken();
    const verifyUrl = `${origin}/api/account/verify-email?token=${token}`;

    await users.updateOne(
      { _id: user._id },
      {
        $set: {
          emailVerificationTokenHash: tokenHash,
          emailVerificationExpiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
          updatedAt: new Date(),
        },
      },
    );

    const emailResult = await sendVerificationEmail(user.email, verifyUrl);
    const status = emailResult.sent ? "verification-sent" : "email-provider-needed";
    return NextResponse.redirect(
      `${origin}/login?login=${status}&identifier=${encodeURIComponent(identifier)}`,
      303,
    );
  } catch (error) {
    console.error("Verification resend failed", error);
    const status = isDatabaseConnectionError(error)
      ? "database-unreachable"
      : "service-unavailable";
    return NextResponse.redirect(`${origin}/login?login=${status}`, 303);
  }
}
