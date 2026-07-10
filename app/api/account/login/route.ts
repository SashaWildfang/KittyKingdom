import { NextResponse } from "next/server";
import { setSession, verifyPassword } from "../../../../lib/auth";
import { getUsersCollection } from "../../../../lib/mongodb";

export async function POST(request: Request) {
  const form = await request.formData();
  const identifier = String(form.get("identifier") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const origin = new URL(request.url).origin;

  const users = await getUsersCollection();
  const user = await users.findOne({
    $or: [{ email: identifier }, { username: identifier }],
  });

  if (!user || !user.emailVerified || !verifyPassword(password, user.passwordSalt, user.passwordHash)) {
    return NextResponse.redirect(`${origin}/?login=invalid#login`, 303);
  }

  await setSession(user._id);
  return NextResponse.redirect(`${origin}/?login=success#account`, 303);
}
