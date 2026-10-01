// The step between "password was right" and "logged in" for accounts with two-factor on.
import { createHash } from "crypto";
import { ObjectId, type Document } from "mongodb";
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

// ---------- "Remember this device" ----------
// After a successful code, the browser can skip the code for 30 days. The cookie is signed and tied
// to the account and its current two-factor secret, so resetting or turning off 2FA ends it.
const TRUST_COOKIE = "kk_2fa_trust";
const TRUST_MS = 30 * 86_400_000;

function secretPrint(user: Document) {
  const secret = String(user.twoFactor?.secret ?? "");
  return createHash("sha256").update(secret).digest("hex").slice(0, 16);
}

export async function rememberDevice(user: Document) {
  const exp = Date.now() + TRUST_MS;
  (await cookies()).set(TRUST_COOKIE, signPayload(`${String(user._id)}:${exp}:${secretPrint(user)}`), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: Math.floor(TRUST_MS / 1000),
  });
}

/** Whether this browser was trusted for this account (and its current 2FA) in the last 30 days. */
export async function isTrustedDevice(user: Document) {
  const value = readSignedPayload((await cookies()).get(TRUST_COOKIE)?.value);
  if (!value) return false;
  const [id, exp, print] = value.split(":");
  return id === String(user._id) && Number(exp) > Date.now() && print === secretPrint(user);
}
