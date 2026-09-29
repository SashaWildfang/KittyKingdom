// Signing up needs a confirmed email and a verified member of the Discord server: the account is
// created "unfinished" and the confirmation email goes out straight away. Once the email is
// confirmed the person gets a code and runs /link CODE in the server (the bot links it,
// main_bot/cmds/link.py), and that finishes the account. Email comes first so a mistyped address
// is caught before a Discord account gets tied to it. Unfinished accounts can't log in.

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
  | { state: "verify-email"; email: string }
  | { state: "waiting"; code: string | null; expiresAt: string | null; email: string }
  | { state: "not-member"; code: string | null; expiresAt: string | null; email: string }
  | { state: "done"; discordName: string; email: string; signedIn: boolean }
  | { state: "gone" };

/** Emails a confirmation link to an unfinished (or unverified) account. */
export async function sendSignupVerification(user: Document, origin: string) {
  const { token, entry } = createVerificationTokenEntry();
  await (await getUsersCollection()).updateOne({ _id: user._id }, { $set: { emailVerificationTokens: [entry], updatedAt: new Date() } });
  const sent = await sendVerificationEmail(String(user.email), `${origin}/api/account/verify-email?token=${token}`, { newAccount: true }).catch(() => ({ sent: false }));
  return Boolean(sent.sent);
}

/**
 * Finishes an account once its email is confirmed and its Discord is linked (and that Discord is a
 * verified member): clears the "unfinished" flag. `finished` is true only for the call that did it.
 * Safe to call more than once.
 */
export async function finishRegistration(user: Document) {
  const users = await getUsersCollection();
  const discordName = String(user.discord?.globalName ?? user.discord?.username ?? user.discordId);
  if (!user.registration?.pending) return { ok: true, discordName, finished: false };
  // Older sign-ups linked Discord first; they still have to confirm their email
  if (user.emailVerified !== true) return { ok: false as const, needsEmail: true };

  if (!(await isVerifiedMember(String(user.discordId)))) {
    // Linked by someone who isn't (or is no longer) a verified member: undo it
    await users.updateOne({ _id: user._id }, { $set: { discordId: null, discord: null, "registration.rejectedDiscordId": String(user.discordId) } });
    return { ok: false as const, needsEmail: false };
  }

  const claimed = await users.updateOne(
    { _id: user._id, "registration.pending": true },
    { $set: { "registration.pending": false, "registration.completedAt": new Date(), updatedAt: new Date() } },
  );
  return { ok: true, discordName, finished: claimed.modifiedCount > 0 }; // false: another request finished it first
}

/**
 * Where this browser's sign-up stands (the register page polls this every couple of seconds).
 * `finished` is true on the one call that completed the account, so the caller can sign them in.
 */
export async function registrationState(origin: string): Promise<RegistrationState & { finished?: boolean; userId?: ObjectId }> {
  const user = await pendingRegistration();
  if (!user) return { state: "gone" };
  const email = String(user.email);
  if (user.emailVerified !== true) {
    // Sign-ups started before email came first never got a link: send one now
    if (user.registration?.pending && !(user.emailVerificationTokens ?? []).length) await sendSignupVerification(user, origin).catch(() => false);
    return { state: "verify-email", email };
  }
  if (user.discordId) {
    const done = await finishRegistration(user);
    if (done.ok) return { state: "done", discordName: done.discordName, email, signedIn: done.finished, finished: done.finished, userId: user._id };
  } else if (!user.registration?.pending) {
    return { state: "done", discordName: String(user.discord?.username ?? ""), email, signedIn: false };
  }
  const fresh = await (await getUsersCollection()).findOne({ _id: user._id });
  const active = await activeLinkCode(user._id);
  const rejected = Boolean(fresh?.registration?.rejectedDiscordId);
  return { state: rejected ? "not-member" : "waiting", code: active ? formatCode(active._id) : null, expiresAt: active?.expiresAt.toISOString() ?? null, email };
}

/** A new /link code for this browser's sign-up. */
export async function newRegistrationCode() {
  const user = await pendingRegistration();
  if (!user || user.discordId || !user.registration?.pending || user.emailVerified !== true) return null;
  await (await getUsersCollection()).updateOne({ _id: user._id }, { $unset: { "registration.rejectedDiscordId": "" } });
  const { code, expiresAt } = await createLinkCode(user._id);
  return { code: formatCode(code), expiresAt: expiresAt.toISOString() };
}

/**
 * Fixes a mistyped email on an account that hasn't confirmed it yet, and sends a new link to the
 * new address. Returns an error message, or null when it worked.
 */
export async function changeUnverifiedEmail(user: Document, email: string, origin: string): Promise<string | null> {
  if (user.emailVerified === true) return "That account's email is already confirmed.";
  if (email === user.email) return "That's the address we already have. Check your spam folder, or send a new link.";
  const users = await getUsersCollection();
  const taken = await users.findOne({ email, _id: { $ne: user._id } }, { projection: { registration: 1, discordId: 1 } });
  if (taken?.registration?.pending && !taken.discordId && !taken.emailVerified) {
    // Someone else's abandoned sign-up with that address: it can go
    await users.deleteOne({ _id: taken._id, "registration.pending": true });
  } else if (taken) {
    return "An account already uses that email.";
  }
  try {
    await users.updateOne({ _id: user._id, emailVerified: { $ne: true } }, { $set: { email, updatedAt: new Date() } });
  } catch (error) {
    if ((error as { code?: number })?.code === 11000) return "An account already uses that email.";
    throw error;
  }
  await sendSignupVerification({ ...user, email }, origin);
  return null;
}
