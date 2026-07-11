import { NextResponse } from "next/server";
import { getSessionUserId } from "../../../../lib/auth";
import { getUsersCollection } from "../../../../lib/mongodb";

export const maxDuration = 10;

export async function POST(request: Request) {
  const origin = new URL(request.url).origin;

  try {
    const userId = await getSessionUserId();
    if (!userId) {
      return NextResponse.redirect(
        `${origin}/login?account=login-required`,
        303,
      );
    }

    const form = await request.formData();
    const displayName = String(form.get("displayName") ?? "")
      .trim()
      .replace(/\s+/g, " ");

    if (!/^[A-Za-z0-9 ]{3,12}$/.test(displayName)) {
      return NextResponse.redirect(`${origin}/account?account=invalid-name`, 303);
    }

    const users = await getUsersCollection();
    await users.updateOne(
      { _id: userId },
      { $set: { displayName, updatedAt: new Date() } },
    );

    return NextResponse.redirect(`${origin}/account?account=name-saved`, 303);
  } catch (error) {
    console.error("Display name update failed", error);
    return NextResponse.redirect(
      `${origin}/account?account=service-unavailable`,
      303,
    );
  }
}
