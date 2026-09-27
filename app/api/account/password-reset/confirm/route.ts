import { NextResponse } from "next/server";
import { hashPassword, setSession } from "../../../../../lib/auth";
import { getUsersCollection } from "../../../../../lib/mongodb";
import { findResetUser } from "../../../../../lib/password-reset";
import { revokeAllSessions } from "../../../../../lib/sessions";

export const maxDuration = 10;

export async function POST(request: Request) {
  const origin = new URL(request.url).origin;
  const form = await request.formData();
  const token = String(form.get("token") ?? "");
  const password = String(form.get("newPassword") ?? "");
  const confirm = String(form.get("confirmPassword") ?? "");
  const back = (status: string) => NextResponse.redirect(`${origin}/reset-password?token=${encodeURIComponent(token)}&status=${status}`, 303);

  if (!/^(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/.test(password)) return back("requirements");
  if (password !== confirm) return back("mismatch");

  const user = await findResetUser(token);
  if (!user) return NextResponse.redirect(`${origin}/reset-password?status=expired`, 303);

  // The link was one-time: clear it, set the password, sign out every other session.
  // Opening a link from their inbox also proves they own the email.
  const { salt, hash } = hashPassword(password);
  const users = await getUsersCollection();
  const updated = await users.findOneAndUpdate(
    { _id: user._id, "passwordReset.hash": user.passwordReset.hash },
    {
      $set: { passwordSalt: salt, passwordHash: hash, emailVerified: true, updatedAt: new Date(), passwordChangedAt: new Date(), lastLoginAt: new Date() },
      $unset: { passwordReset: "", mustChangePassword: "" },
      $inc: { sessionVersion: 1 },
    },
    { returnDocument: "after" },
  );
  if (!updated) return NextResponse.redirect(`${origin}/reset-password?status=expired`, 303);

  await revokeAllSessions(updated._id, "password-reset");
  await setSession(updated._id, typeof updated.sessionVersion === "number" ? updated.sessionVersion : 0);
  return NextResponse.redirect(`${origin}/account?account=password-reset`, 303);
}
