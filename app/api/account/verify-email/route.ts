import { NextResponse } from "next/server";
import { hashToken, setSession } from "../../../../lib/auth";
import { getUsersCollection } from "../../../../lib/mongodb";

export const maxDuration = 10;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  const origin = url.origin;

  try {
    if (!token) {
      return NextResponse.redirect(`${origin}/login?verify=missing-token`, 303);
    }

    const users = await getUsersCollection();
    const user = await users.findOne({
      emailVerificationTokenHash: hashToken(token),
      emailVerificationExpiresAt: { $gt: new Date() },
    });

    if (!user) {
      return NextResponse.redirect(`${origin}/login?verify=invalid-or-expired`, 303);
    }

    await users.updateOne(
      { _id: user._id },
      {
        $set: { emailVerified: true, updatedAt: new Date() },
        $unset: { emailVerificationTokenHash: "", emailVerificationExpiresAt: "" },
      },
    );

    await setSession(user._id);
    return NextResponse.redirect(`${origin}/account?verify=success`, 303);
  } catch (error) {
    console.error("Email verification failed", error);
    return NextResponse.redirect(`${origin}/login?verify=service-unavailable`, 303);
  }
}
