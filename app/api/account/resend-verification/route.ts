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
  const wantsJson = url.searchParams.get("ajax") === "1";

  function done(status: string, message: string) {
    if (wantsJson) return NextResponse.json({ status, message });
    return NextResponse.redirect(
      `${origin}/login?login=${status}&identifier=${encodeURIComponent(identifier)}`,
      303,
    );
  }

  try {
    if (!identifier) {
      return done(
        "missing-identifier",
        "Enter your email or username before requesting a new verification email.",
      );
    }

    const users = await getUsersCollection();
    const user = await users.findOne({
      $or: [{ email: identifier }, { username: identifier }],
    });

    if (!user) {
      return done("verification-sent", "Verification email resent. Check your inbox.");
    }

    if (user.emailVerified) {
      return done("already-verified", "Your email is already verified. You can log in now.");
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
    return emailResult.sent
      ? done("verification-sent", "Verification email resent. Check your inbox.")
      : done("email-provider-needed", "The verification email could not be sent. Please contact staff.");
  } catch (error) {
    console.error("Verification resend failed", error);
    const status = isDatabaseConnectionError(error)
      ? "database-unreachable"
      : "service-unavailable";
    return done(
      status,
      status === "database-unreachable"
        ? "The account database is not reachable right now."
        : "Verification resend is temporarily unavailable.",
    );
  }
}
