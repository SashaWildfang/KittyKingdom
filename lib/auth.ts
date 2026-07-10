import { ObjectId } from "mongodb";
import { cookies } from "next/headers";
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "crypto";

const sessionCookie = "kk_session";

function getSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET is not configured. Add a long random value in Vercel Project Settings > Environment Variables.");
  }
  return secret;
}

export function hashPassword(password: string, salt = randomBytes(16).toString("hex")) {
  const hash = scryptSync(password, salt, 64).toString("hex");
  return { salt, hash };
}

export function verifyPassword(password: string, salt: string, expectedHash: string) {
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

function sign(value: string) {
  return createHmac("sha256", getSecret()).update(value).digest("hex");
}

export async function setSession(userId: ObjectId | string) {
  const value = String(userId);
  const signature = sign(value);
  const cookieStore = await cookies();
  cookieStore.set(sessionCookie, `${value}.${signature}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function getSessionUserId() {
  const cookieStore = await cookies();
  const session = cookieStore.get(sessionCookie)?.value;
  if (!session) return null;

  const [userId, signature] = session.split(".");
  if (!userId || !signature || sign(userId) !== signature) return null;
  return ObjectId.isValid(userId) ? new ObjectId(userId) : null;
}
