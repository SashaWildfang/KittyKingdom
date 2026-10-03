// Members banned from the Discord server lose their website account: it's deleted and they're emailed the
// ban reason (and how to appeal, if they can). Ban appeals don't need a website account (they sign in with
// Discord on the appeals page), so closing the account never stops someone appealing.
//
// It runs as a sweep: at most once every few minutes, whoever's heartbeat comes in first (see
// app/api/presence) compares the server's ban list with linked accounts. A database lock makes sure only one
// request does it at a time, and each account is claimed with a single delete so nobody is emailed twice.

import { Long, type Document } from "mongodb";
import { removeAccountData } from "./account-removal";
import { sendBanAccountClosedEmail } from "./email";
import { getCurrentBans } from "./moderation";
import { getBotCollection, getMongoClient, getUsersCollection } from "./mongodb";

const EVERY_MS = 5 * 60_000;
const MAX_PER_RUN = 25;

async function websiteDb() {
  return (await getMongoClient()).db(process.env.MONGODB_DB ?? "website");
}

let lastTry = 0;

/** Only one sweep every few minutes, across every server instance. */
async function claimTurn() {
  // Each server instance only asks the database for the lock once a minute
  if (Date.now() - lastTry < 60_000) return false;
  lastTry = Date.now();
  const meta = (await websiteDb()).collection<{ _id: string; at: Date }>("site_meta");
  const now = new Date();
  try {
    const doc = await meta.findOneAndUpdate(
      { _id: "banned_account_sweep", $or: [{ at: { $lt: new Date(now.getTime() - EVERY_MS) } }, { at: { $exists: false } }] },
      { $set: { at: now } },
      { upsert: true, returnDocument: "after" },
    );
    return Boolean(doc);
  } catch {
    return false; // someone else has it (the upsert hit the existing lock)
  }
}

/** The most recent ban on record for a member: reason, case ID and whether it can be appealed. */
async function latestBan(discordId: string) {
  const punishments = await getBotCollection("punishments");
  const ids = [Long.fromString(discordId), discordId];
  const doc = (await punishments
    .find({ action: { $in: ["ban", "tempban"] }, $or: [{ user_discord_id: { $in: ids } }, { discordId: { $in: ids } }] } as Document)
    .sort({ timestamp: -1 })
    .limit(1)
    .next()) as Document | null;
  return {
    reason: String(doc?.reason ?? "").trim() || "No reason was given.",
    caseId: doc?._id ? String(doc._id) : null,
    appealable: doc?.appealable !== false,
    bannedAt: doc?.timestamp instanceof Date ? doc.timestamp : null,
  };
}

/** Close the website accounts of members who are banned from the server. Returns how many were closed. */
export async function sweepBannedAccounts(): Promise<number> {
  if (!(await claimTurn())) return 0;
  const bans = await getCurrentBans();
  if (!bans || !bans.size) return 0;
  const users = await getUsersCollection();
  const linked = await users
    .find({ discordId: { $in: Array.from(bans) } } as Document, { projection: { _id: 1, discordId: 1, email: 1, emailVerified: 1, username: 1, displayName: 1 } })
    .limit(MAX_PER_RUN)
    .toArray();
  let closed = 0;
  for (const u of linked) {
    const discordId = String(u.discordId);
    // Claim it: only the request that actually deletes the account goes on to email
    const gone = await users.findOneAndDelete({ _id: u._id, discordId: u.discordId } as Document);
    if (!gone) continue;
    closed += 1;
    await removeAccountData(u._id, discordId).catch(() => undefined);
    const ban = await latestBan(discordId).catch(() => ({ reason: "No reason was given.", caseId: null, appealable: true, bannedAt: null }));
    const name = String(u.displayName ?? u.username ?? "").trim() || null;
    const mail = u.email && u.emailVerified !== false ? await sendBanAccountClosedEmail(String(u.email), { name, ...ban }).catch(() => ({ sent: false })) : { sent: false };
    // A record for the admins (no email address kept)
    await (await websiteDb())
      .collection("admin_audit")
      .insertOne({ at: new Date(), action: "account-closed-banned", discordId, username: u.username ?? null, reason: ban.reason, caseId: ban.caseId, appealable: ban.appealable, emailed: Boolean(mail.sent), adminDiscordId: null, adminName: "Automatic (banned from Discord)" })
      .catch(() => undefined);
  }
  return closed;
}
