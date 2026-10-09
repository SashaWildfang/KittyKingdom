// Punishment appeals (kittykingdom.net/appeals). Anyone can appeal, even if they're banned and can't
// link a website account: they find their account by name, then prove it's theirs by signing in with
// Discord (identify only). Only then do they see their punishments and can appeal one. Admins review
// appeals in Admin → Moderation → Appeals; every step is kept in the appeal's history, and members
// who left an email are told the outcome.

import { randomBytes } from "crypto";
import { Long, ObjectId, type Document } from "mongodb";
import { cookies } from "next/headers";
import type { PanelUser } from "./admin";
import { people } from "./admin-people";
import { getCurrentUser, readSignedPayload, signPayload } from "./auth";
import { DISCORD_API, botToken, guildId, postChannelMessage, searchMembers } from "./discord-member";
import { sendAppealDecisionEmail, sendAppealReceivedEmail } from "./email";
import { getCurrentBans } from "./moderation";
import { getBotCollection, getMongoClient } from "./mongodb";

const STAFF_LOG_CHANNEL_ID = "1360344042705256660";
const IDENTITY_COOKIE = "kk_appeal";
const STATE_COOKIE = "kk_appeal_state";
const IDENTITY_MS = 60 * 60_000;
const REAPPEAL_MS = 30 * 86_400_000;
export const APPEALABLE = ["ban", "kick", "kick_unverified", "tempmute", "mute", "timeout", "warn"];

export class AppealError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

// via: "account" = their signed-in Kitty Kingdom account with Discord linked; "discord" = Discord sign-in on the appeals page
export type AppealIdentity = { discordId: string; username: string; name: string; avatar: string | null; via?: "account" | "discord" };
export type AppealStatus = "pending" | "accepted" | "denied";
export type HistoryEntry = { at: string; action: "submitted" | "accepted" | "denied" | "lifted" | "note"; byName: string | null; note: string | null };

async function appealsCol() {
  const c = (await getMongoClient()).db(process.env.MONGODB_DB ?? "website").collection("appeals");
  await c.createIndex({ discordId: 1, createdAt: -1 }).catch(() => undefined);
  await c.createIndex({ status: 1, createdAt: -1 }).catch(() => undefined);
  return c;
}

// ---------- Finding your account by name ----------
type BanUser = { id: string; username: string; global_name?: string | null; avatar?: string | null };
let banUsers: { at: number; users: BanUser[] } | null = null;

/** Everyone banned (with their names), cached for 10 minutes. */
async function bannedUsers(): Promise<BanUser[]> {
  if (banUsers && Date.now() - banUsers.at < 10 * 60_000) return banUsers.users;
  const token = botToken();
  const guild = await guildId();
  if (!token || !guild) return [];
  const users: BanUser[] = [];
  let after = "0";
  for (let page = 0; page < 20; page += 1) {
    const res = await fetch(`${DISCORD_API}/guilds/${guild}/bans?limit=1000&after=${after}`, { headers: { Authorization: `Bot ${token}` }, cache: "no-store" }).catch(() => null);
    if (!res?.ok) break;
    const bans = (await res.json()) as { user: BanUser }[];
    users.push(...bans.map((b) => b.user));
    if (bans.length < 1000) break;
    after = bans[bans.length - 1].user.id;
  }
  banUsers = { at: Date.now(), users };
  return users;
}

const avatarUrl = (id: string, hash: string | null | undefined) => (hash ? `https://cdn.discordapp.com/avatars/${id}/${hash}.png?size=64` : null);

/** Accounts matching a Discord name: current members and banned members. Shows no punishments. */
export async function searchAppealAccounts(query: string) {
  const q = query.trim().replace(/^@/, "").toLowerCase();
  if (q.length < 2) return [];
  const [members, banned] = await Promise.all([searchMembers(q, 6).catch(() => []), bannedUsers().catch(() => [] as BanUser[])]);
  const out = new Map<string, { id: string; username: string; name: string; avatar: string | null; banned: boolean }>();
  for (const b of banned) {
    if (out.size >= 8) break;
    if (b.username.toLowerCase().includes(q) || (b.global_name ?? "").toLowerCase().includes(q)) {
      out.set(b.id, { id: b.id, username: b.username, name: b.global_name || b.username, avatar: avatarUrl(b.id, b.avatar), banned: true });
    }
  }
  for (const m of members) if (!m.bot && !out.has(m.id)) out.set(m.id, { id: m.id, username: m.username, name: m.displayName, avatar: m.avatar, banned: false });
  return Array.from(out.values()).slice(0, 8);
}

// ---------- Proving it's you (Discord sign-in, identify only) ----------
function siteOrigin(request: Request) {
  const url = new URL(request.url);
  return url.hostname === "www.kittykingdom.net" ? "https://kittykingdom.net" : url.origin;
}

/** Where to send them to sign in with Discord (null when Discord sign-in isn't set up). */
export async function appealSignInUrl(request: Request) {
  const clientId = process.env.DISCORD_CLIENT_ID;
  if (!clientId) return null;
  const nonce = randomBytes(16).toString("hex");
  (await cookies()).set(STATE_COOKIE, signPayload(nonce), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 600 });
  const params = new URLSearchParams({
    client_id: clientId,
    // The app's registered callback; it hands "appeal." states over to the appeals callback
    redirect_uri: `${siteOrigin(request)}/api/auth/callback/discord`,
    response_type: "code",
    scope: "identify",
    prompt: "consent",
    state: `appeal.${nonce}`,
  });
  return `https://discord.com/api/oauth2/authorize?${params.toString()}`;
}

/** Finishes the Discord sign-in: checks the state, asks Discord who they are, remembers them for an hour. */
export async function finishAppealSignIn(request: Request, code: string, state: string): Promise<AppealIdentity> {
  const jar = await cookies();
  const expected = readSignedPayload(jar.get(STATE_COOKIE)?.value);
  jar.delete(STATE_COOKIE);
  if (!expected || state !== `appeal.${expected}`) throw new AppealError("That sign-in expired. Please try again.");
  const clientId = process.env.DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new AppealError("Discord sign-in isn't set up yet.", 501);
  const token = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, grant_type: "authorization_code", code, redirect_uri: `${siteOrigin(request)}/api/auth/callback/discord` }),
  });
  if (!token.ok) throw new AppealError("Discord didn't confirm the sign-in. Please try again.");
  const { access_token } = (await token.json()) as { access_token: string };
  const me = await fetch("https://discord.com/api/users/@me", { headers: { Authorization: `Bearer ${access_token}` } });
  if (!me.ok) throw new AppealError("Discord didn't confirm the sign-in. Please try again.");
  const u = (await me.json()) as { id: string; username: string; global_name?: string | null; avatar?: string | null };
  const identity: AppealIdentity = { discordId: u.id, username: u.username, name: u.global_name || u.username, avatar: avatarUrl(u.id, u.avatar) };
  jar.set(IDENTITY_COOKIE, signPayload(`${Date.now() + IDENTITY_MS}|${JSON.stringify(identity)}`), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: IDENTITY_MS / 1000,
  });
  return identity;
}

/** Who has proven they're appealing for themselves: a signed-in account with Discord linked, or a Discord sign-in here. */
export async function appealIdentity(): Promise<AppealIdentity | null> {
  const user = await getCurrentUser().catch(() => null);
  if (user?.discordId && user.emailVerified !== false) {
    const discordId = String(user.discordId);
    const who = (await people([discordId]).catch(() => ({}) as Awaited<ReturnType<typeof people>>))[discordId];
    return { discordId, username: who?.username ?? String(user.username ?? discordId), name: who?.name ?? String(user.username ?? "You"), avatar: who?.avatar ?? null, via: "account" };
  }
  const value = readSignedPayload((await cookies()).get(IDENTITY_COOKIE)?.value);
  if (!value) return null;
  const i = value.indexOf("|");
  if (i < 0 || Number(value.slice(0, i)) < Date.now()) return null;
  try {
    const parsed = JSON.parse(value.slice(i + 1)) as AppealIdentity;
    return /^\d{15,21}$/.test(parsed.discordId) ? { ...parsed, via: "discord" } : null;
  } catch {
    return null;
  }
}

export async function clearAppealIdentity() {
  (await cookies()).delete(IDENTITY_COOKIE);
}

// ---------- Their punishments and appeals ----------
const idForms = (id: string) => [id, Long.fromString(id)];

export type MyPunishment = { id: string; action: string; reason: string; at: string | null; expiresAt: string | null; durationSeconds: number | null; active: boolean; appealable: boolean; appeal: { id: string; status: AppealStatus; at: string; canAppealAgainAt: string | null } | null };

export async function myPunishments(discordId: string): Promise<MyPunishment[]> {
  const rows = await (await getBotCollection("punishments"))
    // Staff bans, kicks and warnings store user_discord_id; tempmutes and muzzles store discordId
    // (AutoMod's own records, which also use discordId, stay on the staff side)
    .find({
      $or: [
        { user_discord_id: { $in: idForms(discordId) }, action: { $in: APPEALABLE } },
        { discordId: { $in: idForms(discordId) }, action: { $in: ["tempmute", "muzzle"] }, extraInfo: { $exists: false } },
      ],
    } as Document)
    .sort({ timestamp: -1 })
    .limit(50)
    .toArray();
  const bans = await getCurrentBans().catch(() => null);
  const appeals = await (await appealsCol()).find({ discordId }).sort({ createdAt: -1 }).toArray();
  const latest = new Map<string, Document>();
  for (const a of appeals) if (!latest.has(String(a.punishmentId))) latest.set(String(a.punishmentId), a);
  return rows.map((r) => {
    const id = String(r._id);
    const action = String(r.action ?? "");
    // The bot stamps every punishment with an expiry; only mutes really end (from their duration when it's there)
    const muteLike = action === "tempmute" || action === "mute" || action === "timeout" || action === "muzzle";
    const length = Number(r.duration_seconds ?? r.durationSeconds) || 0;
    const fromDuration = r.timestamp instanceof Date && length > 0 ? new Date(r.timestamp.getTime() + length * 1000) : null;
    const stored = r.expires_at instanceof Date ? r.expires_at : r.expiresAt instanceof Date ? r.expiresAt : null;
    const expires = muteLike ? fromDuration ?? stored : null;
    const durationSeconds = muteLike ? length || (expires && r.timestamp instanceof Date ? Math.round((expires.getTime() - r.timestamp.getTime()) / 1000) : 0) || null : null;
    const active = action === "ban" ? Boolean(bans?.has(discordId)) : muteLike ? Boolean(expires && expires.getTime() > Date.now()) : false;
    const a = latest.get(id);
    const decided = a && a.decidedAt instanceof Date ? a.decidedAt.getTime() : null;
    return {
      id,
      action,
      reason: String(r.reason ?? "No reason given"),
      at: r.timestamp instanceof Date ? r.timestamp.toISOString() : null,
      expiresAt: expires ? expires.toISOString() : null,
      durationSeconds,
      active,
      // Staff can mark a punishment as not appealable (e.g. /ban appealable:No)
      appealable: action !== "muzzle" && r.appealable !== false && r.extra_info?.appealable !== false,
      appeal: a
        ? {
            id: String(a._id),
            status: a.status as AppealStatus,
            at: (a.createdAt as Date).toISOString(),
            canAppealAgainAt: a.status === "denied" && decided ? new Date(decided + REAPPEAL_MS).toISOString() : null,
          }
        : null,
    };
  });
}

export async function myAppeals(discordId: string) {
  const rows = await (await appealsCol()).find({ discordId }).sort({ createdAt: -1 }).limit(20).toArray();
  return rows.map((a) => ({
    id: String(a._id),
    reference: reference(a._id as ObjectId),
    action: String(a.punishment?.action ?? ""),
    status: a.status as AppealStatus,
    createdAt: (a.createdAt as Date).toISOString(),
    decidedAt: a.decidedAt instanceof Date ? a.decidedAt.toISOString() : null,
    response: a.response ? String(a.response) : null,
  }));
}

const reference = (id: ObjectId) => `KK-${String(id).slice(-8).toUpperCase()}`;
const cleanEmail = (v: unknown) => {
  const e = typeof v === "string" ? v.trim().toLowerCase() : "";
  return e && e.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) ? e : null;
};

/** Files an appeal for one of their punishments. */
export async function submitAppeal(identity: AppealIdentity, input: { punishmentId?: unknown; message?: unknown; email?: unknown }) {
  const punishmentId = String(input.punishmentId ?? "");
  if (!ObjectId.isValid(punishmentId)) throw new AppealError("Pick the punishment you're appealing.");
  const message = typeof input.message === "string" ? input.message.trim() : "";
  if (message.length < 30) throw new AppealError("Tell us a bit more (at least a couple of sentences).");
  if (message.length > 3000) throw new AppealError("Please keep it under 3,000 characters.");
  const rawEmail = typeof input.email === "string" ? input.email.trim() : "";
  const email = rawEmail ? cleanEmail(rawEmail) : null;
  if (rawEmail && !email) throw new AppealError("That email address doesn't look right.");

  const punishment = await (await getBotCollection("punishments")).findOne({ _id: new ObjectId(punishmentId), $or: [{ user_discord_id: { $in: idForms(identity.discordId) } }, { discordId: { $in: idForms(identity.discordId) } }] } as Document);
  if (!punishment || !APPEALABLE.includes(String(punishment.action))) throw new AppealError("That punishment couldn't be found on your account.", 404);
  if (punishment.appealable === false || punishment.extra_info?.appealable === false) throw new AppealError("This punishment can't be appealed.", 403);

  const col = await appealsCol();
  const last = await col.findOne({ discordId: identity.discordId, punishmentId }, { sort: { createdAt: -1 } });
  if (last?.status === "pending") throw new AppealError("You already have an appeal waiting for this one.", 409);
  if (last?.status === "accepted") throw new AppealError("Your appeal for this one was already accepted.", 409);
  if (last?.status === "denied" && last.decidedAt instanceof Date && Date.now() - last.decidedAt.getTime() < REAPPEAL_MS) {
    throw new AppealError(`You can appeal this one again after ${new Date(last.decidedAt.getTime() + REAPPEAL_MS).toDateString()}.`, 409);
  }

  const now = new Date();
  const snapshot = {
    action: String(punishment.action),
    reason: String(punishment.reason ?? ""),
    at: punishment.timestamp instanceof Date ? punishment.timestamp : null,
    expiresAt: punishment.expires_at instanceof Date ? punishment.expires_at : punishment.expiresAt instanceof Date ? punishment.expiresAt : null,
    issuerId: punishment.issuer_discord_id ?? punishment.issuerId ? String(punishment.issuer_discord_id ?? punishment.issuerId) : null,
  };
  const doc = {
    discordId: identity.discordId,
    username: identity.username,
    name: identity.name,
    avatar: identity.avatar,
    punishmentId,
    punishment: snapshot,
    message,
    email,
    status: "pending" as AppealStatus,
    createdAt: now,
    history: [{ at: now, action: "submitted", byName: null, note: null }],
  };
  const res = await col.insertOne(doc);
  const ref = reference(res.insertedId);
  if (email) await sendAppealReceivedEmail(email, { username: identity.username, action: snapshot.action, punishedAt: snapshot.at?.toISOString() ?? null, reference: ref }).catch(() => undefined);
  await postChannelMessage(STAFF_LOG_CHANNEL_ID, {
    embeds: [
      {
        title: "📨 New punishment appeal",
        color: 0x5865f2,
        description: `<@${identity.discordId}> (\`${identity.username}\`) appealed a **${snapshot.action}**. Review it in Admin → Moderation → Appeals.`,
        fields: [
          { name: "Original reason", value: snapshot.reason.slice(0, 500) || "None", inline: false },
          { name: "Reference", value: ref, inline: true },
        ],
        timestamp: now.toISOString(),
      },
    ],
  }).catch(() => false);
  return { id: String(res.insertedId), reference: ref };
}

// ---------- Admin ----------
export type AdminAppeal = {
  id: string;
  reference: string;
  discordId: string;
  username: string;
  name: string;
  avatar: string | null;
  punishment: { action: string; reason: string; at: string | null; expiresAt: string | null; issuerId: string | null };
  message: string;
  hasEmail: boolean;
  status: AppealStatus;
  createdAt: string;
  decidedAt: string | null;
  decidedBy: string | null;
  response: string | null;
  history: HistoryEntry[];
  stillBanned: boolean;
  otherAppeals: number;
};

export async function listAppeals(status: AppealStatus | "all", page = 1) {
  const col = await appealsCol();
  const q: Document = status === "all" ? {} : { status };
  const [rows, total, counts, bans] = await Promise.all([
    col.find(q).sort({ status: 1, createdAt: status === "pending" ? 1 : -1 }).skip((page - 1) * 20).limit(20).toArray(),
    col.countDocuments(q),
    col.aggregate([{ $group: { _id: "$status", n: { $sum: 1 } } }]).toArray(),
    getCurrentBans().catch(() => null),
  ]);
  const others = await col.aggregate([{ $match: { discordId: { $in: rows.map((r) => r.discordId) } } }, { $group: { _id: "$discordId", n: { $sum: 1 } } }]).toArray();
  const otherCount = new Map(others.map((o) => [String(o._id), Number(o.n)]));
  const iso = (d: unknown) => (d instanceof Date ? d.toISOString() : null);
  return {
    total,
    page,
    counts: Object.fromEntries(counts.map((c) => [String(c._id), Number(c.n)])) as Record<string, number>,
    rows: rows.map(
      (a): AdminAppeal => ({
        id: String(a._id),
        reference: reference(a._id as ObjectId),
        discordId: String(a.discordId),
        username: String(a.username ?? ""),
        name: String(a.name ?? a.username ?? ""),
        avatar: a.avatar ? String(a.avatar) : null,
        punishment: { action: String(a.punishment?.action ?? ""), reason: String(a.punishment?.reason ?? ""), at: iso(a.punishment?.at), expiresAt: iso(a.punishment?.expiresAt), issuerId: a.punishment?.issuerId ?? null },
        message: String(a.message ?? ""),
        hasEmail: Boolean(a.email),
        status: a.status as AppealStatus,
        createdAt: iso(a.createdAt) ?? "",
        decidedAt: iso(a.decidedAt),
        decidedBy: a.decidedBy ? String(a.decidedBy) : null,
        response: a.response ? String(a.response) : null,
        history: ((a.history ?? []) as Document[]).map((h) => ({ at: iso(h.at) ?? "", action: h.action, byName: h.byName ?? null, note: h.note ?? null })),
        stillBanned: Boolean(bans?.has(String(a.discordId))),
        otherAppeals: Math.max(0, (otherCount.get(String(a.discordId)) ?? 1) - 1),
      }),
    ),
  };
}

export async function pendingAppealCount() {
  return (await appealsCol()).countDocuments({ status: "pending" });
}

async function liftBan(discordId: string, actor: PanelUser) {
  const token = botToken();
  const guild = await guildId();
  if (!token || !guild) return false;
  const res = await fetch(`${DISCORD_API}/guilds/${guild}/bans/${discordId}`, {
    method: "DELETE",
    headers: { Authorization: `Bot ${token}`, "X-Audit-Log-Reason": encodeURIComponent(`Appeal accepted on the website by ${actor.name}`) },
  }).catch(() => null);
  banUsers = null;
  return Boolean(res && (res.ok || res.status === 404));
}

/** Records an accepted appeal's unban like the bot records one, so it shows on the Overview, in Punishments and on the member's record. */
async function logAppealUnban(appeal: Document, byId: string, at: Date) {
  const id = String(appeal.discordId);
  await (await getBotCollection("punishments")).insertOne({
    user_discord_id: /^\d{15,25}$/.test(id) ? Long.fromString(id) : id,
    issuer_discord_id: /^\d{15,25}$/.test(byId) ? Long.fromString(byId) : byId,
    action: "unban",
    reason: `Appeal accepted (${reference(appeal._id as ObjectId)})`,
    duration_seconds: null,
    timestamp: at,
    expires_at: new Date(at.getTime() + 86_400_000),
    extra_info: "Unbanned via appeal on the website",
    appealable: false,
  });
  await (await appealsCol()).updateOne({ _id: appeal._id }, { $set: { unbanLogged: true } });
}

let backfilled = false;
/** Appeals accepted before unbans were recorded: add their unban records once. */
export async function backfillAppealUnbans() {
  if (backfilled) return;
  backfilled = true;
  try {
    const missing = await (await appealsCol()).find({ status: "accepted", lifted: true, unbanLogged: { $ne: true } }).limit(200).toArray();
    for (const a of missing) await logAppealUnban(a, String(a.decidedById ?? ""), a.decidedAt instanceof Date ? a.decidedAt : new Date());
  } catch (error) {
    backfilled = false;
    console.error("Appeal unban backfill failed", error);
  }
}

/** Accept or deny an appeal, with an optional reply (emailed if they left an address). */
export async function decideAppeal(id: string, actor: PanelUser, input: { decision?: unknown; response?: unknown; liftBan?: unknown }) {
  if (!ObjectId.isValid(id)) throw new AppealError("Unknown appeal.", 404);
  const decision = input.decision === "accept" ? "accepted" : input.decision === "deny" ? "denied" : null;
  if (!decision) throw new AppealError("Pick accept or deny.");
  const response = typeof input.response === "string" ? input.response.trim().slice(0, 2000) : "";
  const col = await appealsCol();
  const appeal = await col.findOne({ _id: new ObjectId(id) });
  if (!appeal) throw new AppealError("Unknown appeal.", 404);
  if (appeal.status !== "pending") throw new AppealError("This appeal was already decided.", 409);

  const now = new Date();
  const history: Document[] = [{ at: now, action: decision, byName: actor.name, byId: actor.discordId, note: response || null }];
  let lifted = false;
  if (decision === "accepted" && input.liftBan === true && appeal.punishment?.action === "ban") {
    lifted = await liftBan(String(appeal.discordId), actor);
    history.push({ at: new Date(), action: "lifted", byName: actor.name, byId: actor.discordId, note: lifted ? "Ban lifted in Discord" : "Couldn't lift the ban in Discord" });
  }
  const res = await col.updateOne(
    { _id: appeal._id, status: "pending" },
    { $set: { status: decision, decidedAt: now, decidedBy: actor.name, decidedById: actor.discordId, response: response || null, lifted }, $push: { history: { $each: history } } } as Document,
  );
  if (!res.modifiedCount) throw new AppealError("This appeal was already decided.", 409);
  if (lifted) await logAppealUnban(appeal, actor.discordId, now).catch((e) => console.error("Couldn't record the appeal unban", e));

  const ref = reference(appeal._id as ObjectId);
  if (appeal.email) {
    const sent = await sendAppealDecisionEmail(String(appeal.email), { username: String(appeal.username), action: String(appeal.punishment?.action ?? ""), accepted: decision === "accepted", response, reference: ref, lifted }).catch(() => null);
    if (sent?.sent) await col.updateOne({ _id: appeal._id }, { $set: { emailedAt: new Date() } }).catch(() => undefined);
  }
  await (await getMongoClient())
    .db(process.env.MONGODB_DB ?? "website")
    .collection("admin_audit")
    .insertOne({ at: now, action: `appeal-${decision}`, appealId: id, targetDiscordId: String(appeal.discordId), lifted, adminDiscordId: actor.discordId, adminName: actor.name })
    .catch(() => undefined);
  await postChannelMessage(STAFF_LOG_CHANNEL_ID, {
    embeds: [
      {
        title: decision === "accepted" ? "✅ Appeal accepted" : "❌ Appeal denied",
        color: decision === "accepted" ? 0x46a758 : 0xe5484d,
        fields: [
          { name: "Member", value: `<@${appeal.discordId}>\n\`${appeal.username}\``, inline: true },
          { name: "Punishment", value: String(appeal.punishment?.action ?? "?"), inline: true },
          { name: "By", value: `<@${actor.discordId}>`, inline: true },
          ...(lifted ? [{ name: "Discord", value: "Ban lifted", inline: true }] : []),
          ...(response ? [{ name: "Reply", value: response.slice(0, 1000), inline: false }] : []),
          { name: "Reference", value: ref, inline: true },
        ],
        timestamp: now.toISOString(),
      },
    ],
  }).catch(() => false);
  return { message: decision === "accepted" ? `Appeal accepted${lifted ? " and the ban was lifted" : ""}.` : "Appeal denied.", lifted };
}
