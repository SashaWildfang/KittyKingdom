import { NextResponse } from "next/server";
import { getSessionUserId } from "../../../../../lib/auth";
import { getUsersCollection } from "../../../../../lib/mongodb";

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

    const users = await getUsersCollection();
    await users.updateOne(
      { _id: userId },
      {
        $unset: {
          discord: "",
          discordId: "",
          age: "",
          dateOfBirth: "",
        },
        $set: { updatedAt: new Date() },
      },
    );

    return NextResponse.redirect(`${origin}/account?discord=unlinked`, 303);
  } catch (error) {
    console.error("Discord unlink failed", error);
    return NextResponse.redirect(
      `${origin}/account?discord=service-unavailable`,
      303,
    );
  }
}
