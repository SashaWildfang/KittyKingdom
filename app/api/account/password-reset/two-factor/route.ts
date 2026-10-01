import { NextResponse } from "next/server";
import { hashPassword, setSession } from "../../../../../lib/auth";
import { getUsersCollection } from "../../../../../lib/mongodb";
import { HOUR, allow, clientIp } from "../../../../../lib/rate-limit";
import { revokeAllSessions } from "../../../../../lib/sessions";
import { TwoFactorError, checkSecondFactor } from "../../../../../lib/two-factor-account";
import { cleanIdentifier, cleanPassword, isFormPost } from "../../../../../lib/validate";

export const maxDuration = 10;

/**
 * Reset a password without email, for accounts with two-factor on: email/username + a code from the
 * authenticator app (or a backup code) + the new password. Every failure gives the same answer, so it
 * can't be used to find out which accounts have two-factor.
 */
export async function POST(request: Request) {
  const origin = new URL(request.url).origin;
  const back = (status: string) => NextResponse.redirect(`${origin}/forgot-password?with=code&status=${status}`, 303);
  if (!isFormPost(request)) return back("failed");
  const form = await request.formData();
  const identifier = cleanIdentifier(form.get("identifier"));
  const code = String(form.get("code") ?? "").replace(/\s+/g, "").slice(0, 20);
  const password = cleanPassword(form.get("newPassword")) ?? "";
  const confirm = String(form.get("confirmPassword") ?? "").slice(0, 200);
  if (!identifier || !code) return back("failed");

  const allowed = await allow([
    { key: `reset-2fa:ip:${await clientIp()}`, limit: 10, windowMs: HOUR },
    { key: `reset-2fa:id:${identifier}`, limit: 5, windowMs: HOUR },
  ]);
  if (!allowed) return back("too-many");
  if (!/^(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/.test(password)) return back("requirements");
  if (password !== confirm) return back("mismatch");

  const users = await getUsersCollection();
  const user = await users.findOne({ $or: [{ email: identifier }, { username: identifier }] });
  if (!user?.twoFactor?.enabled || user.registration?.pending) return back("failed");
  let how: "app" | "backup" | null = null;
  try {
    how = await checkSecondFactor(user, code);
  } catch (error) {
    if (error instanceof TwoFactorError) return back("too-many");
    throw error;
  }
  if (!how) return back("failed");

  // New password, every other session signed out, and signed in here
  const { salt, hash } = hashPassword(password);
  const updated = await users.findOneAndUpdate(
    { _id: user._id },
    {
      $set: { passwordSalt: salt, passwordHash: hash, updatedAt: new Date(), passwordChangedAt: new Date(), lastLoginAt: new Date() },
      $unset: { passwordReset: "", mustChangePassword: "" },
      $inc: { sessionVersion: 1 },
    },
    { returnDocument: "after" },
  );
  if (!updated) return back("failed");
  await revokeAllSessions(updated._id, "password-reset");
  await setSession(updated._id, typeof updated.sessionVersion === "number" ? updated.sessionVersion : 0);
  return NextResponse.redirect(`${origin}/account?account=password-reset${how === "backup" ? "&login=backup-used#security" : ""}`, 303);
}
