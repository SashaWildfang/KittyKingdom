import { NextResponse } from "next/server";
import { setSession, verifyPassword } from "../../../../lib/auth";
import { isDatabaseConnectionError } from "../../../../lib/db-errors";
import { getUsersCollection } from "../../../../lib/mongodb";

export const maxDuration = 10;

export async function POST(request: Request) {
  const origin = new URL(request.url).origin;

  try {
    const form = await request.formData();
    const identifier = String(form.get("identifier") ?? "")
      .trim()
      .toLowerCase();
    const password = String(form.get("password") ?? "");

    const users = await getUsersCollection();
    const user = await users.findOne({
      $or: [{ email: identifier }, { username: identifier }],
    });

    if (!user || !verifyPassword(password, user.passwordSalt, user.passwordHash)) {
      return NextResponse.redirect(
        `${origin}/login?login=invalid&identifier=${encodeURIComponent(identifier)}`,
        303,
      );
    }

    if (!user.emailVerified) {
      return NextResponse.redirect(
        `${origin}/login?login=unverified&identifier=${encodeURIComponent(identifier)}`,
        303,
      );
    }

    await setSession(user._id);
    return NextResponse.redirect(
      user.username
        ? `${origin}/home?login=success`
        : `${origin}/account?login=success`,
      303,
    );
  } catch (error) {
    console.error("Login failed", error);
    const status = isDatabaseConnectionError(error)
      ? "database-unreachable"
      : "service-unavailable";
    return NextResponse.redirect(`${origin}/login?login=${status}`, 303);
  }
}
