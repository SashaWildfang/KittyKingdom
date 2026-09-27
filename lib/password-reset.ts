import { randomBytes } from "crypto";
import type { ObjectId } from "mongodb";
import { hashToken } from "./auth";
import { sendPasswordResetEmail } from "./email";
import { getUsersCollection } from "./mongodb";

const RESET_TTL_MS = 60 * 60 * 1000;
const RESEND_GAP_MS = 2 * 60 * 1000;

/** Creates a one-time reset link for this account and emails it. */
export async function startPasswordReset(userId: ObjectId, origin: string, requestedByStaff: boolean) {
  const users = await getUsersCollection();
  const user = await users.findOne({ _id: userId }, { projection: { email: 1, passwordReset: 1 } });
  if (!user?.email) return { sent: false, reason: "Account has no email." };

  // One email every couple of minutes per account, so the form can't be used to spam someone
  const sentAt = user.passwordReset?.sentAt instanceof Date ? user.passwordReset.sentAt.getTime() : 0;
  if (!requestedByStaff && Date.now() - sentAt < RESEND_GAP_MS) return { sent: true, throttled: true };

  const token = randomBytes(32).toString("hex");
  await users.updateOne(
    { _id: userId },
    { $set: { passwordReset: { hash: hashToken(token), expiresAt: new Date(Date.now() + RESET_TTL_MS), sentAt: new Date(), byStaff: requestedByStaff } } },
  );
  return sendPasswordResetEmail(String(user.email), `${origin}/reset-password?token=${token}`, requestedByStaff);
}

/** The account a reset link belongs to, if the link is still valid. */
export async function findResetUser(token: string) {
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  const users = await getUsersCollection();
  return users.findOne({ "passwordReset.hash": hashToken(token), "passwordReset.expiresAt": { $gt: new Date() } });
}
