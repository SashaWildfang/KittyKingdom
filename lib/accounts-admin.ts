// Website accounts for the admin panel. Password hashes and token hashes never leave this file.

import { deleteBadgeHistory } from "./badge-history";
import { randomBytes, randomInt } from "crypto";
import { ObjectId, type Document } from "mongodb";
import { isStaffDiscordId, type PanelUser } from "./admin";
import { createVerificationTokenEntry, hashPassword, maxActiveVerificationTokens } from "./auth";
import { sendDiscordLinkReminderEmail, sendVerificationReminderEmail } from "./email";
import { getMongoClient, getUsersCollection } from "./mongodb";
import { formatDateOfBirth } from "./dates";
import { applicationBirthday, getJoinApplication } from "./join-application";
import { startPasswordReset } from "./password-reset";
import { ONLINE_WINDOW_MS, revokeAllSessions, sessionsCollection } from "./sessions";
import { userTimeZone } from "./timezone";
import { accountName } from "./names";

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export type AccountRow = {
  id: string;
  email: string;
  username: string | null;
  displayName: string | null;
  /** What to call them: display name, else Discord nickname, else Discord username. */
  name: string;
  emailVerified: boolean;
  discordId: string | null;
  discordName: string | null;
  createdAt: string | null;
  lastLoginAt: string | null;
  mustChangePassword: boolean;
  /** Their Discord profile picture when Discord is linked */
  avatar: string | null;
  lastActiveAt: string | null;
  online: boolean;
};

const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : null);

function toRow(doc: Document): AccountRow {
  return {
    id: String(doc._id),
    email: String(doc.email ?? ""),
    username: doc.username ? String(doc.username) : null,
    displayName: doc.displayName ? String(doc.displayName) : null,
    name: accountName(doc),
    emailVerified: Boolean(doc.emailVerified),
    discordId: doc.discordId ? String(doc.discordId) : null,
    discordName: doc.discord?.username ? String(doc.discord.username) : null,
    createdAt: iso(doc.createdAt),
    lastLoginAt: iso(doc.lastLoginAt),
    mustChangePassword: Boolean(doc.mustChangePassword),
    avatar: null,
    lastActiveAt: doc.lastActiveAt instanceof Date && doc.lastActiveAt.getTime() > 0 ? doc.lastActiveAt.toISOString() : null,
    online: doc.lastActiveAt instanceof Date && Date.now() - doc.lastActiveAt.getTime() < ONLINE_WINDOW_MS,
  };
}

/** Fills in Discord names and profile pictures from the member directory. */
async function withDiscordProfiles(rows: AccountRow[]) {
  const ids = rows.map((r) => r.discordId).filter((x): x is string => Boolean(x));
  if (!ids.length) return rows;
  const client = await getMongoClient();
  const docs = await client
    .db(process.env.MONGODB_DB ?? "website")
    .collection("member_directory")
    .find({ _id: { $in: ids } } as never, { projection: { username: 1, displayName: 1, nick: 1, avatar: 1 } })
    .toArray();
  const byId = new Map(docs.map((d) => [String(d._id), d]));
  for (const row of rows) {
    if (!row.discordId) continue;
    const d = byId.get(row.discordId);
    row.discordName = row.discordName ?? (d ? String(d.displayName ?? d.username ?? "") || null : null);
    if (!row.displayName && d) row.name = accountName({ username: row.username, email: row.email }, { nick: (d.nick as string | null) ?? null, username: (d.username as string | null) ?? null });
    // Directory avatar when known, otherwise the site's avatar proxy (which falls back to Discord's default)
    row.avatar = (d?.avatar as string | null | undefined) ?? `/api/discord/avatar/${row.discordId}`;
  }
  return rows;
}

// Never send these to the browser
const SAFE_PROJECTION = {
  passwordHash: 0,
  passwordSalt: 0,
  emailVerificationTokenHash: 0,
  emailVerificationTokens: 0,
  passwordReset: 0,
  session: 0,
  // Two-factor secrets and backup code hashes never leave the server
  "twoFactor.secret": 0,
  "twoFactor.backupCodes": 0,
  "twoFactor.pending": 0,
};

export async function listAccounts(q: {
  search?: string;
  filter?: string;
  sort?: string;
  order?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}) {
  const users = await getUsersCollection();
  const and: Document[] = [];
  const search = q.search?.trim().slice(0, 100);
  if (search) {
    const regex = new RegExp(escapeRegex(search), "i");
    and.push({
      $or: [
        { email: regex },
        { username: regex },
        { displayName: regex },
        { "discord.username": regex },
        { discordId: regex },
        ...(ObjectId.isValid(search) ? [{ _id: new ObjectId(search) }] : []),
      ],
    });
  }
  if (q.filter === "verified") and.push({ emailVerified: true });
  if (q.filter === "unverified") and.push({ emailVerified: { $ne: true } });
  if (q.filter === "linked") and.push({ discordId: { $nin: [null, ""] } });
  if (q.filter === "unlinked") and.push({ discordId: { $in: [null, ""] } });
  if (q.filter === "temp") and.push({ mustChangePassword: true });

  const sortField = { created: "createdAt", email: "email", username: "username", lastLogin: "lastLoginAt", online: "lastActiveAt" }[q.sort ?? "created"] ?? "createdAt";
  const pageSize = Math.min(100, Math.max(10, q.pageSize ?? 25));
  const page = Math.max(1, q.page ?? 1);
  const filter = and.length ? { $and: and } : {};
  const [docs, total, totals] = await Promise.all([
    // Each account's most recent device activity decides "online" (and the online sort)
    users
      .aggregate([
        { $match: filter },
        {
          $lookup: {
            from: "sessions",
            let: { uid: "$_id" },
            pipeline: [
              { $match: { $expr: { $eq: ["$userId", "$$uid"] }, revokedAt: { $exists: false } } },
              { $group: { _id: null, last: { $max: "$lastSeenAt" } } },
            ],
            as: "activity",
          },
        },
        { $addFields: { lastActiveAt: { $ifNull: [{ $first: "$activity.last" }, new Date(0)] } } },
        { $project: { ...SAFE_PROJECTION, activity: 0 } },
        { $sort: { [sortField]: q.order === "asc" ? 1 : -1, _id: -1 } },
        { $skip: (page - 1) * pageSize },
        { $limit: pageSize },
      ])
      .toArray(),
    users.countDocuments(filter),
    users
      .aggregate([
        {
          $group: {
            _id: null,
            all: { $sum: 1 },
            verified: { $sum: { $cond: ["$emailVerified", 1, 0] } },
            linked: { $sum: { $cond: [{ $gt: [{ $strLenCP: { $toString: { $ifNull: ["$discordId", ""] } } }, 0] }, 1, 0] } },
            week: { $sum: { $cond: [{ $gte: ["$createdAt", new Date(Date.now() - 7 * 86_400_000)] }, 1, 0] } },
          },
        },
      ])
      .toArray(),
  ]);
  const t = totals[0] ?? { all: 0, verified: 0, linked: 0, week: 0 };
  const rows = await withDiscordProfiles(docs.map(toRow));
  return {
    rows,
    total,
    page,
    pageSize,
    totals: { all: t.all as number, verified: t.verified as number, linked: t.linked as number, newThisWeek: t.week as number },
  };
}

async function auditCollection() {
  const client = await getMongoClient();
  return client.db(process.env.MONGODB_DB ?? "website").collection("admin_audit");
}

export async function getAccount(id: string) {
  if (!ObjectId.isValid(id)) return null;
  const users = await getUsersCollection();
  const doc = await users.findOne({ _id: new ObjectId(id) }, { projection: SAFE_PROJECTION });
  if (!doc) return null;
  const [audit, application] = await Promise.all([
    (await auditCollection()).find({ targetUserId: id }).sort({ at: -1 }).limit(20).toArray(),
    getJoinApplication(doc.discordId),
  ]);
  // Birthday and age come from their Discord join application (the account itself rarely has them)
  const birthday = applicationBirthday(application, { dateOfBirth: doc.dateOfBirth, age: doc.age });
  const [row] = await withDiscordProfiles([toRow(doc)]);
  return {
    ...row,
    phone: typeof doc.phone === "string" ? doc.phone : null,
    socials: (doc.socials ?? {}) as Record<string, { handle: string; url: string }>,
    dateOfBirth: birthday.birthDate ? formatDateOfBirth(birthday.birthDate) : null,
    age: birthday.age !== null ? String(birthday.age) : null,
    applicationStatus: application?.status ? String(application.status) : null,
    isStaff: await isStaffDiscordId(doc.discordId),
    twoFactor: Boolean(doc.twoFactor?.enabled),
    registrationPending: Boolean(doc.registration?.pending),
    reminders: {
      verify: doc.reminders?.verify?.at ? { at: iso(doc.reminders.verify.at), by: String(doc.reminders.verify.by ?? ""), count: Number(doc.reminders.verify.count ?? 1) } : null,
      link: doc.reminders?.link?.at ? { at: iso(doc.reminders.link.at), by: String(doc.reminders.link.by ?? ""), count: Number(doc.reminders.link.count ?? 1) } : null,
    },
    updatedAt: iso(doc.updatedAt),
    passwordChangedAt: iso(doc.passwordChangedAt),
    acceptedPoliciesAt: iso(doc.acceptedPoliciesAt),
    audit: audit.map((a) => ({ at: iso(a.at), action: String(a.action), adminName: String(a.adminName ?? ""), adminDiscordId: String(a.adminDiscordId ?? "") })),
  };
}

/** A temporary password that meets the site's rules and is easy to read out: Maple-Otter-4821! */
function temporaryPassword() {
  const words = ["Maple", "Acorn", "Ember", "Cider", "Otter", "Fox", "Birch", "Pumpkin", "Hazel", "Willow", "Sparrow", "Cocoa", "Juniper", "Clover"];
  const pick = () => words[randomInt(words.length)];
  const symbols = "!#$%&*?";
  return `${pick()}-${pick()}-${randomInt(1000, 10000)}${symbols[randomInt(symbols.length)]}`;
}

export type AccountAction = "send-reset" | "temp-password" | "sign-out" | "verify-email" | "remind-verify" | "remind-link" | "unlink-discord" | "reset-2fa" | "delete";

/** Whether a request's action is one the admin panel supports. */
export function isAccountAction(value: unknown): value is AccountAction {
  switch (value) {
    case "send-reset":
    case "temp-password":
    case "sign-out":
    case "verify-email":
    case "remind-verify":
    case "remind-link":
    case "unlink-discord":
    case "reset-2fa":
    case "delete":
      return true;
    default:
      return false;
  }
}

export async function accountAction(id: string, action: AccountAction, admin: PanelUser, origin: string) {
  if (!ObjectId.isValid(id)) throw new Error("Unknown account.");
  const _id = new ObjectId(id);
  const users = await getUsersCollection();
  const target = await users.findOne({ _id }, { projection: { email: 1, discordId: 1, discord: 1, twoFactor: 1, emailVerified: 1, displayName: 1, username: 1, registration: 1, reminders: 1 } });
  if (!target) throw new Error("Unknown account.");

  let result: { message: string; temporaryPassword?: string };
  if (action === "send-reset") {
    const sent = await startPasswordReset(_id, origin, true);
    if (!sent.sent) throw new Error(`The email couldn't be sent${"reason" in sent && sent.reason ? `: ${sent.reason}` : "."}`);
    result = { message: `Reset link emailed to ${target.email}. It works once for 1 hour.` };
  } else if (action === "temp-password") {
    const password = temporaryPassword();
    const { salt, hash } = hashPassword(password);
    await users.updateOne(
      { _id },
      {
        $set: { passwordSalt: salt, passwordHash: hash, mustChangePassword: true, passwordChangedAt: new Date(), updatedAt: new Date() },
        $unset: { passwordReset: "" },
        $inc: { sessionVersion: 1 },
      },
    );
    await revokeAllSessions(_id, `admin:${admin.discordId}`);
    result = { message: "Temporary password set and all their sessions signed out. They'll be asked to change it.", temporaryPassword: password };
  } else if (action === "sign-out") {
    await users.updateOne({ _id }, { $inc: { sessionVersion: 1 } });
    await revokeAllSessions(_id, `admin:${admin.discordId}`);
    result = { message: "Signed out of the website on every device." };
  } else if (action === "unlink-discord") {
    if (!target.discordId) throw new Error("Their Discord isn't linked.");
    const name = String(target.discord?.globalName ?? target.discord?.username ?? target.discordId);
    await users.updateOne({ _id }, { $set: { discordId: null, discord: null, updatedAt: new Date() } });
    result = { message: `Unlinked their Discord (${name}). They can link again with a new code from My Account.` };
  } else if (action === "reset-2fa") {
    if (!target.twoFactor?.enabled) throw new Error("Two-factor authentication is already off for this account.");
    await users.updateOne({ _id }, { $set: { twoFactor: { enabled: false }, updatedAt: new Date() }, $inc: { sessionVersion: 1 } });
    await revokeAllSessions(_id, `admin:${admin.discordId}`);
    result = { message: "Two-factor authentication turned off and every session signed out. They can log in with just their password and set it up again." };
  } else if (action === "delete") {
    if (id === admin.websiteUserId) throw new Error("You can't delete your own account from here.");
    // Staff accounts are protected, even from the owner
    if (await isStaffDiscordId(target.discordId)) throw new Error("Staff accounts can't be deleted. Remove their staff role in Discord first.");
    const client = await getMongoClient();
    const website = client.db(process.env.MONGODB_DB ?? "website");
    await users.deleteOne({ _id });
    await Promise.all([
      (await sessionsCollection()).deleteMany({ userId: _id }),
      website.collection("link_codes").deleteMany({ userId: _id }),
      deleteBadgeHistory(target.discordId).catch(() => undefined),
    ]);
    result = { message: `Deleted the website account for ${target.email}. Their Discord and bot data are untouched.` };
  } else if (action === "remind-verify" || action === "remind-link") {
    // Reminders: at most one of each per day, so nobody gets spammed
    const kind = action === "remind-verify" ? "verify" : "link";
    const last = target.reminders?.[kind]?.at;
    if (last instanceof Date && Date.now() - last.getTime() < 86_400_000) {
      throw new Error(`A reminder already went out ${Math.max(1, Math.round((Date.now() - last.getTime()) / 3_600_000))}h ago. You can send another tomorrow.`);
    }
    const name = accountName(target as Document);
    if (kind === "verify") {
      if (target.emailVerified) throw new Error("Their email is already verified.");
      if (target.registration?.pending) throw new Error("They haven't finished signing up (Discord step), so there's no email to confirm yet. Send the Discord reminder instead.");
      const { token, entry } = createVerificationTokenEntry();
      await users.updateOne({ _id }, { $push: { emailVerificationTokens: { $each: [entry], $slice: -maxActiveVerificationTokens } } as never, $set: { updatedAt: new Date() } });
      const sent = await sendVerificationReminderEmail(String(target.email), `${origin}/api/account/verify-email?token=${token}`, name);
      if (!sent.sent) throw new Error(`The email couldn't be sent${"reason" in sent && sent.reason ? `: ${sent.reason}` : "."}`);
    } else {
      if (target.discordId) throw new Error("Their Discord is already linked.");
      const sent = await sendDiscordLinkReminderEmail(String(target.email), name);
      if (!sent.sent) throw new Error(`The email couldn't be sent${"reason" in sent && sent.reason ? `: ${sent.reason}` : "."}`);
    }
    const count = (target.reminders?.[kind]?.count ?? 0) + 1;
    await users.updateOne({ _id }, { $set: { [`reminders.${kind}`]: { at: new Date(), by: admin.name, count } } });
    result = { message: `${kind === "verify" ? "Email confirmation" : "Discord linking"} reminder sent to ${target.email}.` };
  } else if (action === "verify-email") {
    await users.updateOne({ _id }, { $set: { emailVerified: true, updatedAt: new Date() }, $unset: { emailVerificationTokens: "", emailVerificationTokenHash: "" } });
    result = { message: "Email marked as verified." };
  } else {
    throw new Error("Unknown action.");
  }

  // Every admin action on an account is recorded (never the temporary password itself)
  await (await auditCollection()).insertOne({
    at: new Date(),
    action,
    targetUserId: id,
    targetEmail: target.email,
    adminDiscordId: admin.discordId,
    adminName: admin.name,
    ref: randomBytes(4).toString("hex"),
  });
  return result;
}

export type AccountSegment = "all" | "verified" | "linked" | "unverified";

const SEGMENT_FILTERS: Record<AccountSegment, Document> = {
  all: {},
  verified: { emailVerified: true },
  linked: { discordId: { $nin: [null, ""] } },
  unverified: { emailVerified: { $ne: true } },
};

/** The story behind one of the account totals: sign-ups over time, growth and the newest accounts. */
export async function accountSegmentInsights(segment: AccountSegment) {
  const users = await getUsersCollection();
  const filter = SEGMENT_FILTERS[segment] ?? {};
  const weekAgo = new Date(Date.now() - 7 * 86_400_000);
  const monthAgo = new Date(Date.now() - 30 * 86_400_000);
  const [total, all, week, month, timeline, newest] = await Promise.all([
    users.countDocuments(filter),
    users.countDocuments({}),
    users.countDocuments({ ...filter, createdAt: { $gte: weekAgo } }),
    users.countDocuments({ ...filter, createdAt: { $gte: monthAgo } }),
    users
      .aggregate([
        { $match: { ...filter, createdAt: { $type: "date", $gte: new Date(Date.now() - 180 * 86_400_000) } } },
        { $group: { _id: { $dateTrunc: { date: "$createdAt", unit: "week", timezone: userTimeZone() } }, n: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ])
      .toArray(),
    users.find(filter, { projection: SAFE_PROJECTION }).sort({ createdAt: -1 }).limit(25).toArray(),
  ]);
  return {
    segment,
    total,
    percent: all ? Math.round((total / all) * 100) : 0,
    week,
    month,
    timeline: timeline.map((t) => ({ bucket: (t._id as Date).toISOString(), action: segment, count: t.n as number })),
    newest: await withDiscordProfiles(newest.map(toRow)),
  };
}
