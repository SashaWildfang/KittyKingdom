import { NextResponse } from "next/server";
import {
  getSessionUserId,
  hashPassword,
  verifyPassword,
} from "../../../../lib/auth";
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
    const currentPassword = String(
      form.get("currentAccountPassword") ?? form.get("currentPassword") ?? "",
    );
    const newPassword = String(
      form.get("newAccountPassword") ?? form.get("newPassword") ?? "",
    );

    if (!/^(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/.test(newPassword)) {
      return NextResponse.redirect(
        `${origin}/account?account=password-requirements`,
        303,
      );
    }

    const users = await getUsersCollection();
    const user = await users.findOne({ _id: userId });
    if (
      !user ||
      !verifyPassword(currentPassword, user.passwordSalt, user.passwordHash)
    ) {
      return NextResponse.redirect(
        `${origin}/account?account=password-invalid`,
        303,
      );
    }

    const { salt, hash } = hashPassword(newPassword);
    await users.updateOne(
      { _id: userId },
      {
        $set: { passwordSalt: salt, passwordHash: hash, updatedAt: new Date() },
      },
    );

    return NextResponse.redirect(
      `${origin}/account?account=password-saved`,
      303,
    );
  } catch (error) {
    console.error("Password update failed", error);
    return NextResponse.redirect(
      `${origin}/account?account=service-unavailable`,
      303,
    );
  }
}
