import { NextResponse } from "next/server";
import { hashToken, setSession } from "../../../../lib/auth";
import { getUsersCollection } from "../../../../lib/mongodb";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  const origin = url.origin;

  if (!token) {
    return NextResponse.redirect(`${origin}/?verify=missing-token#login`, 303);
  }

  const users = await getUsersCollection();
  const user = await users.findOne({
    emailVerificationTokenHash: hashToken(token),
    emailVerificationExpiresAt: { $gt: new Date() },
  });

  if (!user) {
    return NextResponse.redirect(`${origin}/?verify=invalid-or-expired#login`, 303);
  }

  await users.updateOne(
    { _id: user._id },
    {
      $set: { emailVerified: true, updatedAt: new Date() },
      $unset: { emailVerificationTokenHash: "", emailVerificationExpiresAt: "" },
    },
  );

  await setSession(user._id);
  return NextResponse.redirect(`${origin}/?verify=success#account`, 303);
}
