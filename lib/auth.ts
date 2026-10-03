import { cache } from "react";
import { ObjectId } from "mongodb";
import { cookies } from "next/headers";
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { getUsersCollection } from "./mongodb";
import { createSessionRecord, sessionsCollection, touchSession, revokeSession } from "./sessions";

const sessionCookie = "kk_session";
const sessionMaxAge = 60 * 60 * 8;
// "Remember me" on the login page keeps you signed in on this browser for 30 days
const rememberMaxAge = 60 * 60 * 24 * 30;

function getSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error(
      "AUTH_SECRET is not configured. Add a long random value in Vercel Project Settings > Environment Variables.",
    );
  }
  return secret;
}

export function hashPassword(
  password: string,
  salt = randomBytes(16).toString("hex"),
) {
  const hash = scryptSync(password, salt, 64).toString("hex");
  return { salt, hash };
}

export function verifyPassword(
  password: string,
  salt: string,
  expectedHash: string,
) {
  const actual = Buffer.from(hashPassword(password, salt).hash, "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function hashToken(token: string) {
  return createHmac("sha256", getSecret()).update(token).digest("hex");
}

export function createVerificationToken() {
  const token = randomBytes(32).toString("hex");
  return { token, tokenHash: hashToken(token) };
}

// Verification links stay valid for 3 days, and the last few links all keep working so
// requesting a resend doesn't break an email the user already has open.
export const verificationTokenTtlMs = 1000 * 60 * 60 * 72;
export const maxActiveVerificationTokens = 5;

export function createVerificationTokenEntry() {
  const { token, tokenHash } = createVerificationToken();
  return {
    token,
    entry: { hash: tokenHash, expiresAt: new Date(Date.now() + verificationTokenTtlMs) },
  };
}

function sign(value: string) {
  return createHmac("sha256", getSecret()).update(value).digest("hex");
}

/**
 * Sessions are "<userId>.<version>.<sessionId>.<signature>". The sessionId points at a record of
 * the device (see sessions.ts) so one device can be disconnected on its own.
 * Cookies from before devices were tracked are "<userId>.<version>.<signature>". Bumping a user's sessionVersion (password reset,
 * "sign out everywhere") makes every older session stop working. Sessions from before versions
 * existed ("<userId>.<signature>") count as version 0.
 */
export async function setSession(userId: ObjectId | string, version?: number, remember = false) {
  const id = String(userId);
  let v = version;
  if (v === undefined) {
    const users = await getUsersCollection();
    const user = await users.findOne({ _id: new ObjectId(id) }, { projection: { sessionVersion: 1 } });
    v = typeof user?.sessionVersion === "number" ? user.sessionVersion : 0;
  }
  const sid = await createSessionRecord(new ObjectId(id));
  const cookieStore = await cookies();
  cookieStore.set(sessionCookie, `${id}.${v}.${sid}.${sign(`${id}:${v}:${sid}`)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: remember ? rememberMaxAge : sessionMaxAge,
  });
}

export async function clearSession() {
  // Logging out ends this device's session record too
  const session = await readSessionCookie().catch(() => null);
  if (session?.sessionId) await revokeSession(session.sessionId, "logout").catch(() => undefined);
  const cookieStore = await cookies();
  cookieStore.set(sessionCookie, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  cookieStore.set("kk_view_as", "", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 0 });
}

function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** The signed session cookie's user id and version, without checking the database. */
async function readSessionCookie(): Promise<{ userId: ObjectId; version: number; sessionId: string | null } | null> {
  const cookieStore = await cookies();
  const session = cookieStore.get(sessionCookie)?.value;
  if (!session) return null;

  const parts = session.split(".");
  let id: string;
  let version: number;
  let sessionId: string | null = null;
  if (parts.length === 4) {
    [id] = parts;
    version = Number(parts[1]);
    sessionId = parts[2];
    if (!Number.isInteger(version) || !/^[a-f0-9]{24}$/.test(sessionId) || !safeEqual(sign(`${id}:${version}:${sessionId}`), parts[3])) return null;
  } else if (parts.length === 3) {
    [id] = parts;
    version = Number(parts[1]);
    if (!Number.isInteger(version) || !safeEqual(sign(`${id}:${version}`), parts[2])) return null;
  } else if (parts.length === 2) {
    [id] = parts;
    version = 0;
    if (!safeEqual(sign(id), parts[1])) return null;
  } else {
    return null;
  }
  return ObjectId.isValid(id) ? { userId: new ObjectId(id), version, sessionId } : null;
}

/** The signed-in user's document, or null if the session is missing, forged or signed out. */
export const getRealUser = cache(async () => {
  const session = await readSessionCookie();
  if (!session) return null;
  const [users, sessions] = await Promise.all([getUsersCollection(), sessionsCollection()]);
  const [user, record] = await Promise.all([
    users.findOne({ _id: session.userId }),
    session.sessionId ? sessions.findOne({ _id: session.sessionId }) : Promise.resolve(null),
  ]);
  if (!user) return null;
  const current = typeof user.sessionVersion === "number" ? user.sessionVersion : 0;
  if (current !== session.version) return null;
  if (session.sessionId) {
    // A disconnected device (or a record from another account) no longer counts as signed in
    if (!record || record.revokedAt || !record.userId.equals(session.userId)) return null;
    await touchSession(record).catch(() => undefined);
  }
  return user;
});

/** The id of the device session this request is using (null for older cookies). */
export async function getCurrentSessionId() {
  return (await readSessionCookie())?.sessionId ?? null;
}

/**
 * The signed-in user's id, for account changes. Null while an admin is viewing the site as
 * someone else, so nothing can be changed on either account in that mode.
 */
export async function getSessionUserId() {
  if (await getViewAs()) return null;
  const user = await getRealUser();
  return user ? (user._id as ObjectId) : null;
}

// ==========================================
// Admin "view as": an admin sees the site exactly as one member does (read only)
// ==========================================
export const VIEW_AS_COOKIE = "kk_view_as";
export const VIEW_AS_MS = 60 * 60 * 1000;

/** Only members who linked Discord and verified their email can be viewed as. */
export function viewAsEligible(user: Record<string, unknown> | null | undefined) {
  return Boolean(user && user.discordId && user.emailVerified === true);
}

/** Cookie value for viewing as `targetId`, tied to this admin and expiring after an hour. */
export function viewAsCookieValue(adminId: string, targetId: string) {
  return signPayload(`${adminId}:${targetId}:${Date.now() + VIEW_AS_MS}`);
}

/**
 * The member an admin is viewing the site as, or null. Checked on every request: the cookie must
 * be signed for this admin, not expired, the admin must still be an admin, and the member eligible.
 */
export const getViewAs = cache(async () => {
  let raw: string | undefined;
  try {
    raw = (await cookies()).get(VIEW_AS_COOKIE)?.value;
  } catch {
    return null;
  }
  const value = readSignedPayload(raw);
  if (!value) return null;
  const [adminId, targetId, exp] = value.split(":");
  if (!ObjectId.isValid(targetId) || !(Number(exp) > Date.now())) return null;
  const real = await getRealUser();
  if (!real || String(real._id) !== adminId || !real.discordId || adminId === targetId) return null;
  const { panelLevel } = await import("./admin");
  if ((await panelLevel(String(real.discordId)).catch(() => null)) !== "admin") return null;
  const target = await (await getUsersCollection()).findOne({ _id: new ObjectId(targetId) });
  if (!target || !viewAsEligible(target)) return null;
  return { admin: real, target, expiresAt: Number(exp) };
});

// Memoized per request, so the page and the nav can both ask without a second database lookup.
// While an admin is viewing as a member, this is that member.
export const getCurrentUser = cache(async () => (await getViewAs())?.target ?? (await getRealUser()));

/** The Staff page is only for signed-in members with a verified email and a linked Discord account. */
export function canViewStaffPage(user: Record<string, unknown> | null | undefined) {
  return Boolean(user && user.emailVerified !== false && user.discordId);
}

/** "<value>.<signature>" so a cookie's value can be trusted when it comes back. */
export function signPayload(value: string) {
  return `${value}.${sign(value)}`;
}

/** The value from signPayload(), or null if it was tampered with. */
export function readSignedPayload(raw: string | undefined | null) {
  if (!raw) return null;
  const dot = raw.lastIndexOf(".");
  if (dot <= 0) return null;
  const value = raw.slice(0, dot);
  const given = Buffer.from(raw.slice(dot + 1), "hex");
  const expected = Buffer.from(sign(value), "hex");
  return given.length === expected.length && timingSafeEqual(given, expected) ? value : null;
}
