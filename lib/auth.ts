import { cache } from "react";
import { ObjectId } from "mongodb";
import { cookies } from "next/headers";
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { getUsersCollection } from "./mongodb";
import { createSessionRecord, sessionsCollection, touchSession, revokeSession } from "./sessions";

const sessionCookie = "kk_session";
const sessionMaxAge = 60 * 60 * 8;

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
export async function setSession(userId: ObjectId | string, version?: number) {
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
    maxAge: sessionMaxAge,
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
const getSessionUser = cache(async () => {
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

export async function getSessionUserId() {
  const user = await getSessionUser();
  return user ? (user._id as ObjectId) : null;
}

// Memoized per request, so the page and the nav can both ask without a second database lookup
export const getCurrentUser = getSessionUser;
