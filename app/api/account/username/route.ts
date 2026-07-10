import { NextResponse } from "next/server";
import { getSessionUserId } from "../../../../lib/auth";
import { getUsersCollection } from "../../../../lib/mongodb";

export async function POST(request: Request) {
  const userId = await getSessionUserId();
  const origin = new URL(request.url).origin;

  if (!userId) {
    return NextResponse.redirect(`${origin}/?account=login-required#login`, 303);
  }

  const form = await request.formData();
  const username = String(form.get("username") ?? "").trim().toLowerCase();

  if (!/^[a-z0-9_]{3,20}$/.test(username)) {
    return NextResponse.redirect(`${origin}/?account=invalid-username#account`, 303);
  }

  const users = await getUsersCollection();
  const existing = await users.findOne({ username, _id: { $ne: userId } });
  if (existing) {
    return NextResponse.redirect(`${origin}/?account=username-taken#account`, 303);
  }

  await users.updateOne({ _id: userId }, { $set: { username, updatedAt: new Date() } });
  return NextResponse.redirect(`${origin}/?account=username-saved#account`, 303);
}
