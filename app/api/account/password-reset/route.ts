import { NextResponse } from "next/server";
import { getUsersCollection } from "../../../../lib/mongodb";
import { startPasswordReset } from "../../../../lib/password-reset";
import { HOUR, allow, clientIp } from "../../../../lib/rate-limit";
import { cleanIdentifier, isFormPost } from "../../../../lib/validate";

export const maxDuration = 10;

/** "Forgot password" form. Always answers the same way so it can't be used to find out who has an account. */
export async function POST(request: Request) {
  const origin = new URL(request.url).origin;
  try {
    if (!isFormPost(request)) return NextResponse.redirect(`${origin}/forgot-password?sent=1`, 303);
    const form = await request.formData();
    const identifier = cleanIdentifier(form.get("identifier"));
    // Limits stay silent: the page always says the same thing so it can't be used to probe accounts
    const allowed =
      identifier &&
      (await allow([
        { key: `reset:ip:${await clientIp()}`, limit: 5, windowMs: HOUR },
        { key: `reset:id:${identifier}`, limit: 3, windowMs: HOUR },
      ]));
    if (identifier && allowed) {
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
