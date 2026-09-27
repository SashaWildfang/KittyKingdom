// The step between "password was right" and "logged in" for accounts with two-factor on.
import { ObjectId } from "mongodb";
import { cookies } from "next/headers";
import { readSignedPayload, signPayload } from "./auth";
import { getUsersCollection } from "./mongodb";

export const TWO_FACTOR_COOKIE = "kk_2fa";
const WINDOW_MS = 5 * 60_000;

/** Remembers (for 5 minutes) whose password was just accepted. */
export async function startTwoFactorLogin(userId: ObjectId) {
  const expires = Date.now() + WINDOW_MS;
  (await cookies()).set(TWO_FACTOR_COOKIE, signPayload(`${String(userId)}:${expires}`), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: WINDOW_MS / 1000,
  });
}

/** The account waiting for its code, if the 5 minutes haven't run out. */
export async function pendingTwoFactorUser() {
  const value = readSignedPayload((await cookies()).get(TWO_FACTOR_COOKIE)?.value);
  if (!value) return null;
  const [id, expires] = value.split(":");
  if (!ObjectId.isValid(id) || Number(expires) < Date.now()) return null;
  const user = await (await getUsersCollection()).findOne({ _id: new ObjectId(id) });
  return user?.twoFactor?.enabled ? user : null;
}

export async function clearTwoFactorLogin() {
  (await cookies()).delete(TWO_FACTOR_COOKIE);
}
