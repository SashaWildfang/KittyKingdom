import { NextResponse } from "next/server";
import { getSessionUserId } from "../../../../lib/auth";
import { getUsersCollection } from "../../../../lib/mongodb";

export const maxDuration = 10;

export async function POST(request: Request) {
  const origin = new URL(request.url).origin;

  try {
    const userId = await getSessionUserId();
    if (!userId) {
      return NextResponse.redirect(`${origin}/login?account=login-required`, 303);
    }

    const form = await request.formData();
    const username = String(form.get("username") ?? "").trim().toLowerCase();

    if (!/^[a-z0-9_]{3,20}$/.test(username)) {
      return NextResponse.redirect(`${origin}/account?account=invalid-username`, 303);
    }

    const users = await getUsersCollection();
    const existing = await users.findOne({ username, _id: { $ne: userId } });
    if (existing) {
      return NextResponse.redirect(`${origin}/account?account=username-taken`, 303);
    }

    await users.updateOne({ _id: userId }, { $set: { username, updatedAt: new Date() } });
    return NextResponse.redirect(`${origin}/account?account=username-saved`, 303);
  } catch (error) {
    console.error("Username update failed", error);
    return NextResponse.redirect(`${origin}/account?account=service-unavailable`, 303);
  }
}
