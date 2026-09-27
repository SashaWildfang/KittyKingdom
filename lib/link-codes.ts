// One-time codes for linking Discord with the bot's /link command (main_bot/cmds/link.py).
import { randomInt } from "crypto";
import type { ObjectId } from "mongodb";
import { getMongoClient } from "./mongodb";

export const LINK_CODE_TTL_MS = 10 * 60_000;
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I to mix up

type LinkCode = { _id: string; userId: ObjectId; createdAt: Date; expiresAt: Date; usedAt?: Date | null; usedBy?: string };

async function codes() {
  const client = await getMongoClient();
  const col = client.db(process.env.MONGODB_DB ?? "website").collection<LinkCode>("link_codes");
  // Codes tidy themselves away a day after expiring
  await col.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 86_400 }).catch(() => undefined);
  return col;
}

/** A fresh code for this account; any older unused code stops working. */
export async function createLinkCode(userId: ObjectId) {
  const col = await codes();
  await col.deleteMany({ userId, usedAt: null });
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = Array.from({ length: 8 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
    const now = new Date();
    try {
      await col.insertOne({ _id: code, userId, createdAt: now, expiresAt: new Date(now.getTime() + LINK_CODE_TTL_MS), usedAt: null });
      return { code, expiresAt: new Date(now.getTime() + LINK_CODE_TTL_MS) };
    } catch {
      // extremely unlikely clash: try another
    }
  }
  throw new Error("Couldn't create a code");
}

/** The account's newest code that's still waiting to be used. */
export async function activeLinkCode(userId: ObjectId) {
  const col = await codes();
  return col.findOne({ userId, usedAt: null, expiresAt: { $gt: new Date() } }, { sort: { createdAt: -1 } });
}

export function formatCode(code: string) {
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}
