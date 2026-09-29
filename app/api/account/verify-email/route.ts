import { NextResponse } from "next/server";
import type { Document, UpdateFilter } from "mongodb";
import { hashToken, setSession } from "../../../../lib/auth";
import { isDatabaseConnectionError } from "../../../../lib/db-errors";
import { activeLinkCode, createLinkCode } from "../../../../lib/link-codes";
import { getUsersCollection } from "../../../../lib/mongodb";
import { setRegistrationCookie } from "../../../../lib/registration";

export const maxDuration = 10;

// A second click within this window (e.g. after an email scanner used the link first) still signs you in
const recentVerificationWindowMs = 1000 * 60 * 60;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  const origin = url.origin;

  try {
    if (!token) {
      return NextResponse.redirect(`${origin}/login?verify=missing-token`, 303);
    }

    const users = await getUsersCollection();
    const tokenHash = hashToken(token);
    const now = new Date();
    const user = await users.findOne({
      $or: [
        { emailVerificationTokens: { $elemMatch: { hash: tokenHash, expiresAt: { $gt: now } } } },
        // Links sent before multi-link support
        { emailVerificationTokenHash: tokenHash, emailVerificationExpiresAt: { $gt: now } },
      ],
    });

    if (!user) {
      return NextResponse.redirect(
        `${origin}/login?verify=invalid-or-expired`,
        303,
      );
    }

    // Sign-up in progress: email confirmed, so on to linking Discord (they can't log in until that's done)
    if (user.registration?.pending) {
      if (!user.emailVerified) {
        await users.updateOne(
          { _id: user._id },
          {
            $set: { emailVerified: true, emailVerifiedAt: now, updatedAt: now },
            $pull: { emailVerificationTokens: { expiresAt: { $lte: now } } } as unknown as UpdateFilter<Document>["$pull"],
          },
        );
      }
      if (!user.discordId && !(await activeLinkCode(user._id))) await createLinkCode(user._id);
      await setRegistrationCookie(user._id);
      return NextResponse.redirect(`${origin}/register?step=link`, 303);
    }

    // Email security scanners often open links before the person does. The link stays valid,
    // so the person's own click still works: shortly after verification it signs them in,
    // later it just tells them they're already verified.
    if (user.emailVerified) {
      const verifiedAt = user.emailVerifiedAt instanceof Date ? user.emailVerifiedAt.getTime() : 0;
      if (now.getTime() - verifiedAt < recentVerificationWindowMs) {
        await setSession(user._id);
        return NextResponse.redirect(`${origin}/account?verify=success`, 303);
      }
      return NextResponse.redirect(`${origin}/login?verify=already-verified`, 303);
    }

    await users.updateOne(
      { _id: user._id },
      {
        $set: { emailVerified: true, emailVerifiedAt: now, updatedAt: now },
        $pull: { emailVerificationTokens: { expiresAt: { $lte: now } } } as unknown as UpdateFilter<Document>["$pull"],
        $unset: {
          emailVerificationTokenHash: "",
          emailVerificationExpiresAt: "",
        },
      },
    );

    await setSession(user._id);
    return NextResponse.redirect(`${origin}/account?verify=success`, 303);
  } catch (error) {
    console.error("Email verification failed", error);
    const status = isDatabaseConnectionError(error)
      ? "database-unreachable"
      : "service-unavailable";
    return NextResponse.redirect(`${origin}/login?verify=${status}`, 303);
  }
}
