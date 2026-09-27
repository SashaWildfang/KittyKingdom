// One record per signed-in device, so admins can see who's online and disconnect a single device.
// Holds the browser/OS, IP and rough location (from Vercel's own geo headers — no third-party lookups).

import { randomBytes } from "crypto";
import { ObjectId } from "mongodb";
import { headers } from "next/headers";
import { getMongoClient } from "./mongodb";

export const ONLINE_WINDOW_MS = 3 * 60_000;
const TOUCH_EVERY_MS = 60_000;

export type SessionRecord = {
  _id: string;
  userId: ObjectId;
  createdAt: Date;
  lastSeenAt: Date;
  ip: string | null;
  userAgent: string | null;
  device: { browser: string; os: string; type: "mobile" | "tablet" | "desktop" };
  location: { city: string | null; region: string | null; country: string | null };
  revokedAt?: Date;
  revokedBy?: string;
};

export async function sessionsCollection() {
  const client = await getMongoClient();
  return client.db(process.env.MONGODB_DB ?? "website").collection<SessionRecord>("sessions");
}

/** Friendly browser / OS / device from a user agent string. */
export function parseUserAgent(ua: string | null): SessionRecord["device"] {
  const s = ua ?? "";
  const browser = /Discord/i.test(s)
    ? "Discord app"
    : /Edg\//.test(s)
      ? "Edge"
      : /OPR\/|Opera/.test(s)
        ? "Opera"
        : /SamsungBrowser/.test(s)
          ? "Samsung Internet"
          : /Firefox\//.test(s)
            ? "Firefox"
            : /CriOS|Chrome\//.test(s)
              ? "Chrome"
              : /Safari\//.test(s)
                ? "Safari"
                : s
                  ? "Browser"
                  : "Unknown";
  const os = /iPhone|iPod/.test(s)
    ? "iPhone"
    : /iPad/.test(s)
      ? "iPad"
      : /Android/.test(s)
        ? "Android"
        : /Windows/.test(s)
          ? "Windows"
          : /Mac OS X|Macintosh/.test(s)
            ? "macOS"
            : /CrOS/.test(s)
              ? "ChromeOS"
              : /Linux/.test(s)
                ? "Linux"
                : "Unknown";
  const type = /iPad|Tablet/.test(s) ? "tablet" : /Mobi|iPhone|Android/.test(s) ? "mobile" : "desktop";
  return { browser, os, type };
}

/** The visitor's IP, user agent and location from the request headers. */
async function requestInfo() {
  const h = await headers();
  const ip = (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "").trim() || null;
  const decode = (v: string | null) => {
    if (!v) return null;
    try {
      return decodeURIComponent(v);
    } catch {
      return v;
    }
  };
  return {
    ip,
    userAgent: h.get("user-agent")?.slice(0, 400) ?? null,
    location: {
      city: decode(h.get("x-vercel-ip-city")),
      region: decode(h.get("x-vercel-ip-country-region")),
      country: decode(h.get("x-vercel-ip-country")),
    },
  };
}

export async function createSessionRecord(userId: ObjectId) {
  const info = await requestInfo();
  const now = new Date();
  const record: SessionRecord = {
    _id: randomBytes(12).toString("hex"),
    userId,
    createdAt: now,
    lastSeenAt: now,
    ip: info.ip,
    userAgent: info.userAgent,
    device: parseUserAgent(info.userAgent),
    location: info.location,
  };
  await (await sessionsCollection()).insertOne(record);
  return record._id;
}

/** Records that a session is still in use (at most once a minute) and notes IP changes. */
export async function touchSession(record: SessionRecord) {
  if (Date.now() - record.lastSeenAt.getTime() < TOUCH_EVERY_MS) return;
  const info = await requestInfo();
  const set: Partial<SessionRecord> = { lastSeenAt: new Date() };
  if (info.ip && info.ip !== record.ip) {
    set.ip = info.ip;
    set.location = info.location;
  }
  await (await sessionsCollection()).updateOne({ _id: record._id }, { $set: set });
}

export async function revokeSession(sessionId: string, by: string) {
  await (await sessionsCollection()).updateOne({ _id: sessionId, revokedAt: { $exists: false } }, { $set: { revokedAt: new Date(), revokedBy: by } });
}

/** Marks every session of an account as ended (used when its session version changes). */
export async function revokeAllSessions(userId: ObjectId, by: string) {
  await (await sessionsCollection()).updateMany({ userId, revokedAt: { $exists: false } }, { $set: { revokedAt: new Date(), revokedBy: by } });
}
