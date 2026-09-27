// Two-factor settings for a website account (My Account -> Security) and checking a code at login.
import type { Document, ObjectId } from "mongodb";
import { verifyPassword } from "./auth";
import { sendSecurityNoticeEmail } from "./email";
import { getUsersCollection } from "./mongodb";
import { MINUTE, hit } from "./rate-limit";
import {
  backupRemaining,
  decryptSecret,
  encryptSecret,
  formatSecret,
  matchBackupCode,
  newBackupCodes,
  newSecret,
  otpauthUrl,
  qrSvg,
  verifyTotp,
  type StoredTwoFactor,
} from "./two-factor";

export class TwoFactorError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

const tf = (user: Document) => (user.twoFactor ?? { enabled: false }) as StoredTwoFactor;

export function twoFactorStatus(user: Document) {
  const t = tf(user);
  return {
    enabled: Boolean(t.enabled),
    enabledAt: t.enabledAt instanceof Date ? t.enabledAt.toISOString() : null,
    backupRemaining: t.enabled ? backupRemaining(t.backupCodes) : 0,
  };
}

/** Too many wrong codes in a row locks code checks for a while (per account). */
async function limitAttempts(userId: ObjectId) {
  const r = await hit(`2fa:${String(userId)}`, 8, 15 * MINUTE);
  if (!r.ok) throw new TwoFactorError(`Too many attempts. Try again in ${Math.ceil(r.retryAfterMs / MINUTE)} minutes.`, 429);
}

/**
 * Checks an authenticator code or a backup code for an account with 2FA on. Marks backup codes
 * used and remembers the time step so a code can't be replayed. Returns how it was verified.
 */
export async function checkSecondFactor(user: Document, input: string): Promise<"app" | "backup" | null> {
  const t = tf(user);
  if (!t.enabled || !t.secret) return null;
  await limitAttempts(user._id);
  const users = await getUsersCollection();
  const step = verifyTotp(decryptSecret(t.secret), input, t.lastStep ?? 0);
  if (step !== null) {
    // Only the first use of this step wins (two requests at once can't both pass)
    const res = await users.updateOne({ _id: user._id, $or: [{ "twoFactor.lastStep": { $lt: step } }, { "twoFactor.lastStep": { $exists: false } }] }, { $set: { "twoFactor.lastStep": step } });
    return res.modifiedCount ? "app" : null;
  }
  const i = matchBackupCode(t.backupCodes, input);
  if (i >= 0) {
    const res = await users.updateOne({ _id: user._id, [`twoFactor.backupCodes.${i}.usedAt`]: null }, { $set: { [`twoFactor.backupCodes.${i}.usedAt`]: new Date() } });
    return res.modifiedCount ? "backup" : null;
  }
  return null;
}

/** Step 1: a new secret (QR code + manual key) waiting to be confirmed. */
export async function startSetup(user: Document) {
  if (tf(user).enabled) throw new TwoFactorError("Two-factor authentication is already on.", 409);
  const secret = newSecret();
  await (await getUsersCollection()).updateOne({ _id: user._id }, { $set: { "twoFactor.pending": { secret: encryptSecret(secret), createdAt: new Date() } } });
  const url = otpauthUrl(secret, String(user.email ?? user.username ?? "account"));
  return { qr: await qrSvg(url), secret: formatSecret(secret), otpauth: url };
}

/** Step 2: the first code from the app turns 2FA on and returns the backup codes (shown once). */
export async function confirmSetup(user: Document, code: string) {
  const t = tf(user);
  if (t.enabled) throw new TwoFactorError("Two-factor authentication is already on.", 409);
  if (!t.pending?.secret || Date.now() - new Date(t.pending.createdAt).getTime() > 30 * MINUTE) {
    throw new TwoFactorError("Setup timed out. Start again to get a new QR code.", 410);
  }
  await limitAttempts(user._id);
  const secret = decryptSecret(t.pending.secret);
  const step = verifyTotp(secret, code);
  if (step === null) throw new TwoFactorError("That code didn't match. Check the time on your phone and try the newest code.");
  const backup = newBackupCodes();
  await (await getUsersCollection()).updateOne(
    { _id: user._id },
    { $set: { twoFactor: { enabled: true, secret: t.pending.secret, enabledAt: new Date(), lastStep: step, backupCodes: backup.stored } } },
  );
  await sendSecurityNoticeEmail(String(user.email), "Two-factor authentication turned on", "Two-factor authentication is now on for your Kitty Kingdom account. You'll be asked for a code from your authenticator app when you log in.").catch(() => undefined);
  return { codes: backup.codes };
}

/** New backup codes (the old ones stop working); needs a current code. */
export async function regenerateBackupCodes(user: Document, code: string) {
  if (!tf(user).enabled) throw new TwoFactorError("Two-factor authentication is off.", 409);
  if (!(await checkSecondFactor(user, code))) throw new TwoFactorError("That code didn't match.");
  const backup = newBackupCodes();
  await (await getUsersCollection()).updateOne({ _id: user._id }, { $set: { "twoFactor.backupCodes": backup.stored } });
  return { codes: backup.codes };
}

/** Turning it off needs both the password and a code (or backup code). */
export async function disableTwoFactor(user: Document, password: string, code: string) {
  if (!tf(user).enabled) throw new TwoFactorError("Two-factor authentication is already off.", 409);
  if (!verifyPassword(password, user.passwordSalt, user.passwordHash)) {
    await limitAttempts(user._id);
    throw new TwoFactorError("That password isn't right.");
  }
  if (!(await checkSecondFactor(user, code))) throw new TwoFactorError("That code didn't match.");
  await (await getUsersCollection()).updateOne({ _id: user._id }, { $set: { twoFactor: { enabled: false } } });
  await sendSecurityNoticeEmail(String(user.email), "Two-factor authentication turned off", "Two-factor authentication was turned off for your Kitty Kingdom account. If this wasn't you, change your password right away and contact staff.").catch(() => undefined);
}
