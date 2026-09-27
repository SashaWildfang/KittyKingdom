// Website accounts for the admin panel. Password hashes and token hashes never leave this file.

import { randomBytes, randomInt } from "crypto";
import { ObjectId, type Document } from "mongodb";
import type { PanelUser } from "./admin";
import { hashPassword } from "./auth";
import { getMongoClient, getUsersCollection } from "./mongodb";
import { startPasswordReset } from "./password-reset";
import { revokeAllSessions } from "./sessions";

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export type AccountRow = {
  id: string;
  email: string;
  username: string | null;
  displayName: string | null;
  emailVerified: boolean;
  discordId: string | null;
  discordName: string | null;
  createdAt: string | null;
  lastLoginAt: string | null;
  mustChangePassword: boolean;
};

const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : null);

function toRow(doc: Document): AccountRow {
  return {
    id: String(doc._id),
    email: String(doc.email ?? ""),
    username: doc.username ? String(doc.username) : null,
    displayName: doc.displayName ? String(doc.displayName) : null,
    emailVerified: Boolean(doc.emailVerified),
    discordId: doc.discordId ? String(doc.discordId) : null,
    discordName: doc.discord?.username ? String(doc.discord.username) : null,
    createdAt: iso(doc.createdAt),
    lastLoginAt: iso(doc.lastLoginAt),
    mustChangePassword: Boolean(doc.mustChangePassword),
  };
}

// Never send these to the browser
const SAFE_PROJECTION = {
  passwordHash: 0,
  passwordSalt: 0,
  emailVerificationTokenHash: 0,
  emailVerificationTokens: 0,
  passwordReset: 0,
  session: 0,
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

  const sortField = { created: "createdAt", email: "email", username: "username", lastLogin: "lastLoginAt" }[q.sort ?? "created"] ?? "createdAt";
  const pageSize = Math.min(100, Math.max(10, q.pageSize ?? 25));
  const page = Math.max(1, q.page ?? 1);
  const filter = and.length ? { $and: and } : {};
  const [docs, total, totals] = await Promise.all([
    users
      .find(filter, { projection: SAFE_PROJECTION })
      .sort({ [sortField]: q.order === "asc" ? 1 : -1, _id: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
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
  // Show Discord names from the member directory when the account didn't store one
  const rows = docs.map(toRow);
  const missing = rows.filter((r) => r.discordId && !r.discordName).map((r) => r.discordId!);
  if (missing.length) {
    const client = await getMongoClient();
    const names = await client
      .db(process.env.MONGODB_DB ?? "website")
      .collection("member_directory")
      .find({ _id: { $in: missing } } as never, { projection: { username: 1, displayName: 1 } })
      .toArray();
    const byId = new Map(names.map((n) => [String(n._id), String(n.displayName ?? n.username ?? "")]));
    for (const row of rows) if (row.discordId && !row.discordName) row.discordName = byId.get(row.discordId) || null;
  }
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
  const audit = await (await auditCollection()).find({ targetUserId: id }).sort({ at: -1 }).limit(20).toArray();
  return {
    ...toRow(doc),
    phone: typeof doc.phone === "string" ? doc.phone : null,
    socials: (doc.socials ?? {}) as Record<string, { handle: string; url: string }>,
    dateOfBirth: doc.dateOfBirth ? String(doc.dateOfBirth) : null,
    age: doc.age ? String(doc.age) : null,
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

export type AccountAction = "send-reset" | "temp-password" | "sign-out" | "verify-email";

export async function accountAction(id: string, action: AccountAction, admin: PanelUser, origin: string) {
  if (!ObjectId.isValid(id)) throw new Error("Unknown account.");
  const _id = new ObjectId(id);
  const users = await getUsersCollection();
  const target = await users.findOne({ _id }, { projection: { email: 1 } });
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
