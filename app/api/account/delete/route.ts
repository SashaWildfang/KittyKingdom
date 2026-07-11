import { NextResponse } from "next/server";
import { clearSession, getSessionUserId, verifyPassword } from "../../../../lib/auth";
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
    const confirmation = String(form.get("deleteConfirmation") ?? "").trim();
    const password = String(form.get("deletePassword") ?? "");

    if (confirmation !== "DELETE MY ACCOUNT") {
      return NextResponse.redirect(
        `${origin}/account?account=delete-confirmation-invalid`,
        303,
      );
    }

    const users = await getUsersCollection();
    const user = await users.findOne({ _id: userId });
    if (!user || !verifyPassword(password, user.passwordSalt, user.passwordHash)) {
      return NextResponse.redirect(
        `${origin}/account?account=delete-password-invalid`,
        303,
      );
    }

    await users.deleteOne({ _id: userId });
    await clearSession();
    return NextResponse.redirect(`${origin}/home?account=deleted`, 303);
  } catch (error) {
    console.error("Account deletion failed", error);
    return NextResponse.redirect(
      `${origin}/account?account=service-unavailable`,
      303,
    );
  }
}
