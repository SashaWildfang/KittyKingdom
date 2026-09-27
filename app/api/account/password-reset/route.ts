import { NextResponse } from "next/server";
import { getUsersCollection } from "../../../../lib/mongodb";
import { startPasswordReset } from "../../../../lib/password-reset";

export const maxDuration = 10;

/** "Forgot password" form. Always answers the same way so it can't be used to find out who has an account. */
export async function POST(request: Request) {
  const origin = new URL(request.url).origin;
  try {
    const form = await request.formData();
    const identifier = String(form.get("identifier") ?? "").trim().toLowerCase().slice(0, 200);
    if (identifier) {
      const users = await getUsersCollection();
      const user = await users.findOne({ $or: [{ email: identifier }, { username: identifier }] }, { projection: { _id: 1 } });
      if (user) {
        const result = await startPasswordReset(user._id, origin, false);
        if (!result.sent) console.error("Password reset email failed", "reason" in result ? result.reason : "");
      }
    }
  } catch (error) {
    console.error("Password reset request failed", error);
  }
  return NextResponse.redirect(`${origin}/forgot-password?sent=1`, 303);
}
