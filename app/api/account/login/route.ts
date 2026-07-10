import { NextResponse } from "next/server";
import { setSession, verifyPassword } from "../../../../lib/auth";
import { getUsersCollection } from "../../../../lib/mongodb";

export const maxDuration = 10;

export async function POST(request: Request) {
  const origin = new URL(request.url).origin;

  try {
    const form = await request.formData();
    const identifier = String(form.get("identifier") ?? "").trim().toLowerCase();
    const password = String(form.get("password") ?? "");

    const users = await getUsersCollection();
    const user = await users.findOne({
      $or: [{ email: identifier }, { username: identifier }],
    });

    if (!user || !user.emailVerified || !verifyPassword(password, user.passwordSalt, user.passwordHash)) {
      return NextResponse.redirect(`${origin}/login?login=invalid`, 303);
    }

    await setSession(user._id);
    return NextResponse.redirect(`${origin}/account?login=success`, 303);
  } catch (error) {
    console.error("Login failed", error);
    return NextResponse.redirect(`${origin}/login?login=service-unavailable`, 303);
  }
}
