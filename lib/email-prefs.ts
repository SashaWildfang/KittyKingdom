// Email notification choices, saved on the website account as users.emailPrefs { news: true, … }.
// Only verified email addresses get these, and every email has a one-click unsubscribe link.

import { createHmac, timingSafeEqual } from "crypto";
import { ObjectId, type Document } from "mongodb";
import { getUsersCollection } from "./mongodb";
import { EMAIL_PREF_LABELS, isEmailPrefKey, readEmailPrefs, type EmailPrefKey, type EmailPrefs } from "./email-prefs-shared";

const SITE = "https://bear-nation.net";

export type Recipient = { id: string; email: string; discordId: string | null; name: string | null };

function secret() {
  const value = process.env.AUTH_SECRET;
  if (!value) throw new Error("AUTH_SECRET is not set");
  return value;
}

const sign = (userId: string, kind: string) => createHmac("sha256", secret()).update(`unsubscribe:${userId}:${kind}`).digest("hex").slice(0, 32);

/** A link that turns one kind of email off (or "all") without logging in. */
export function unsubscribeUrl(userId: string, kind: EmailPrefKey | "all") {
  return `${SITE}/unsubscribe?u=${userId}&k=${kind}&s=${sign(userId, kind)}`;
}

export function checkUnsubscribe(userId: string, kind: string, signature: string) {
  if (!ObjectId.isValid(userId) || !(kind === "all" || isEmailPrefKey(kind)) || !signature) return false;
  const a = Buffer.from(sign(userId, kind));
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function getEmailPrefs(userId: string): Promise<EmailPrefs> {
  const user = await (await getUsersCollection()).findOne({ _id: new ObjectId(userId) }, { projection: { emailPrefs: 1 } });
  return readEmailPrefs(user?.emailPrefs);
}

export async function setEmailPrefs(userId: string, patch: Partial<Record<EmailPrefKey, boolean>>): Promise<EmailPrefs> {
  const $set: Document = { emailPrefsUpdatedAt: new Date() };
  for (const [k, v] of Object.entries(patch)) if (isEmailPrefKey(k) && typeof v === "boolean") $set[`emailPrefs.${k}`] = v;
  await (await getUsersCollection()).updateOne({ _id: new ObjectId(userId) }, { $set });
  return getEmailPrefs(userId);
}

/** Turns one kind (or every kind) off. Used by unsubscribe links. */
export async function unsubscribe(userId: string, kind: EmailPrefKey | "all") {
  const keys = kind === "all" ? (Object.keys(EMAIL_PREF_LABELS) as EmailPrefKey[]) : [kind];
  return setEmailPrefs(userId, Object.fromEntries(keys.map((k) => [k, false])));
}

const toRecipient = (u: Document): Recipient => ({
  id: String(u._id),
  email: String(u.email),
  discordId: u.discordId ? String(u.discordId) : null,
  name: (u.displayName ?? u.username ?? null) as string | null,
});

/** Verified accounts with this email turned on, in _id order after `after` (for sending in batches). */
export async function recipientsPage(kind: EmailPrefKey, after: string | null, limit: number, discordIds?: string[]): Promise<Recipient[]> {
  const filter: Document = { [`emailPrefs.${kind}`]: true, emailVerified: true, email: { $type: "string" } };
  if (after && ObjectId.isValid(after)) filter._id = { $gt: new ObjectId(after) };
  if (discordIds) filter.discordId = { $in: discordIds };
  const users = await (await getUsersCollection())
    .find(filter, { projection: { email: 1, discordId: 1, displayName: 1, username: 1 } })
    .sort({ _id: 1 })
    .limit(limit)
    .toArray();
  return users.map(toRecipient);
}

/** The one account linked to a Discord id, if it has this email turned on. */
export async function recipientByDiscordId(discordId: string, kind: EmailPrefKey): Promise<Recipient | null> {
  const [r] = await recipientsPage(kind, null, 1, [discordId]);
  return r ?? null;
}

/** How many members have each email turned on (for admins). */
export async function emailPrefCounts() {
  const users = await getUsersCollection();
  const keys = Object.keys(EMAIL_PREF_LABELS) as EmailPrefKey[];
  const counts = await Promise.all(keys.map((k) => users.countDocuments({ [`emailPrefs.${k}`]: true, emailVerified: true })));
  return Object.fromEntries(keys.map((k, i) => [k, counts[i]])) as Record<EmailPrefKey, number>;
}
