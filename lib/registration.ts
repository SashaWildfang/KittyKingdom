// Signing up needs a verified member of the Discord server: the account is created "unfinished",
// the person runs /link CODE in the server (the bot links it, main_bot/cmds/link.py), and only then
// is the account finished and the email-verification link sent. Unfinished accounts can't log in.

import { ObjectId, type Document } from "mongodb";
import { cookies } from "next/headers";
import { createVerificationTokenEntry, readSignedPayload, signPayload } from "./auth";
import { getMemberRoleIds } from "./discord-member";
import { sendVerificationEmail } from "./email";
import { activeLinkCode, createLinkCode, formatCode } from "./link-codes";
import { getUsersCollection } from "./mongodb";

export const REG_COOKIE = "kk_reg";
const REG_COOKIE_MAX_AGE = 24 * 3600;
const ABANDONED_AFTER_MS = 24 * 3_600_000;
const MEMBER_ROLE_ID = "1358469854725931038";
const UNVERIFIED_ROLE_ID = "1358469817191104716";

/** Remembers which unfinished account this browser is setting up. */
export async function setRegistrationCookie(userId: ObjectId) {
  (await cookies()).set(REG_COOKIE, signPayload(String(userId)), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: REG_COOKIE_MAX_AGE,
  });
}

export async function clearRegistrationCookie() {
  (await cookies()).delete(REG_COOKIE);
}

/** The unfinished account this browser is setting up, if any. */
export async function pendingRegistration() {
  const id = readSignedPayload((await cookies()).get(REG_COOKIE)?.value);
  if (!id || !ObjectId.isValid(id)) return null;
  const user = await (await getUsersCollection()).findOne({ _id: new ObjectId(id) });
  return user ?? null;
}

/** Unfinished sign-ups older than a day are removed so their email can be used again. */
export async function removeAbandonedRegistrations() {
  await (await getUsersCollection()).deleteMany({ "registration.pending": true, discordId: { $in: [null, ""] }, createdAt: { $lt: new Date(Date.now() - ABANDONED_AFTER_MS) } });
}

/** Is this Discord account a verified member of the server (passed the join application)? */
export async function isVerifiedMember(discordId: string) {
  const roles = await getMemberRoleIds(discordId);
  if (!roles) return false;
  return roles.includes(MEMBER_ROLE_ID) && !roles.includes(UNVERIFIED_ROLE_ID);
}

export type RegistrationState =
  | { state: "waiting"; code: string | null; expiresAt: string | null; email: string }
  | { state: "not-member"; code: string | null; expiresAt: string | null; email: string }
  | { state: "done"; discordName: string; email: string; emailSent: boolean }
  | { state: "gone" };

/**
 * Finishes an account once its Discord is linked (and that Discord is a verified member): clears the
 * "unfinished" flag and emails the verification link. Safe to call more than once.
 */
export async function finishRegistration(user: Document, origin: string) {
  const users = await getUsersCollection();
  const discordName = String(user.discord?.globalName ?? user.discord?.username ?? user.discordId);
  if (!user.registration?.pending) return { ok: true, discordName, emailSent: false };

  if (!(await isVerifiedMember(String(user.discordId)))) {
    // Linked by someone who isn't (or is no longer) a verified member: undo it
    await users.updateOne({ _id: user._id }, { $set: { discordId: null, discord: null, "registration.rejectedDiscordId": String(user.discordId) } });
    return { ok: false as const };
  }

  const { token, entry } = createVerificationTokenEntry();
  const claimed = await users.updateOne(
    { _id: user._id, "registration.pending": true },
    { $set: { "registration.pending": false, "registration.completedAt": new Date(), emailVerificationTokens: [entry], updatedAt: new Date() } },
  );
  if (!claimed.modifiedCount) return { ok: true, discordName, emailSent: false }; // another request finished it first
  const sent = await sendVerificationEmail(String(user.email), `${origin}/api/account/verify-email?token=${token}`, { discordName, newAccount: true }).catch(() => ({ sent: false }));
  return { ok: true, discordName, emailSent: Boolean(sent.sent) };
}

/** Where this browser's sign-up stands (the register page polls this every couple of seconds). */
export async function registrationState(origin: string): Promise<RegistrationState> {
  const user = await pendingRegistration();
  if (!user) return { state: "gone" };
  const email = String(user.email);
  if (user.discordId) {
    const done = await finishRegistration(user, origin);
    if (done.ok) return { state: "done", discordName: done.discordName, email, emailSent: done.emailSent };
  } else if (!user.registration?.pending) {
    return { state: "done", discordName: String(user.discord?.username ?? ""), email, emailSent: false };
  }
  const fresh = await (await getUsersCollection()).findOne({ _id: user._id });
  const active = await activeLinkCode(user._id);
  const rejected = Boolean(fresh?.registration?.rejectedDiscordId);
  return { state: rejected ? "not-member" : "waiting", code: active ? formatCode(active._id) : null, expiresAt: active?.expiresAt.toISOString() ?? null, email };
}

/** A new /link code for this browser's sign-up. */
export async function newRegistrationCode() {
  const user = await pendingRegistration();
  if (!user || user.discordId || !user.registration?.pending) return null;
  await (await getUsersCollection()).updateOne({ _id: user._id }, { $unset: { "registration.rejectedDiscordId": "" } });
  const { code, expiresAt } = await createLinkCode(user._id);
  return { code: formatCode(code), expiresAt: expiresAt.toISOString() };
}
