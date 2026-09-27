// Fixed-window rate limits stored in Mongo, so they hold across every serverless instance.
import { headers } from "next/headers";
import { getMongoClient } from "./mongodb";

let indexed = false;

async function collection() {
  const client = await getMongoClient();
  const col = client.db(process.env.MONGODB_DB ?? "website").collection<{ _id: string; count: number; resetAt: Date }>("rate_limits");
  if (!indexed) {
    indexed = true;
    // Old windows clean themselves up
    await col.createIndex({ resetAt: 1 }, { expireAfterSeconds: 60 }).catch(() => undefined);
  }
  return col;
}

/** Counts one attempt for `key`. `ok` is false once `limit` attempts happen inside `windowMs`. */
export async function hit(key: string, limit: number, windowMs: number): Promise<{ ok: boolean; retryAfterMs: number }> {
  try {
    const col = await collection();
    const now = new Date();
    const expired = { $lt: [{ $ifNull: ["$resetAt", new Date(0)] }, now] };
    const doc = await col.findOneAndUpdate(
      { _id: key.slice(0, 300) },
      [
        {
          $set: {
            count: { $cond: [expired, 1, { $add: [{ $ifNull: ["$count", 0] }, 1] }] },
            resetAt: { $cond: [expired, new Date(now.getTime() + windowMs), "$resetAt"] },
          },
        },
      ],
      { upsert: true, returnDocument: "after" },
    );
    const count = doc?.count ?? 1;
    const retryAfterMs = doc?.resetAt ? Math.max(0, doc.resetAt.getTime() - now.getTime()) : windowMs;
    return { ok: count <= limit, retryAfterMs };
  } catch (error) {
    // Never lock people out because the limiter itself had a problem
    console.error("Rate limit check failed", error);
    return { ok: true, retryAfterMs: 0 };
  }
}

/** The caller's IP (first address Vercel forwards). */
export async function clientIp() {
  const h = await headers();
  return (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "unknown").trim().slice(0, 64);
}

/** Checks several limits at once; returns false if any is over. */
export async function allow(checks: { key: string; limit: number; windowMs: number }[]) {
  const results = await Promise.all(checks.map((c) => hit(c.key, c.limit, c.windowMs)));
  return results.every((r) => r.ok);
}

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
