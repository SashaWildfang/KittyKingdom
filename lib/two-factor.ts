// Two-factor authentication: authenticator-app codes (TOTP, RFC 6238: 6 digits, 30 seconds,
// SHA-1, the kind Google Authenticator / Authy / 1Password use) plus one-time backup codes.
// The shared secret is stored encrypted; backup codes are stored only as hashes.

import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "crypto";
import QRCode from "qrcode";

const ISSUER = "Kitty Kingdom";
const STEP_SECONDS = 30;
const DIGITS = 6;
const BACKUP_COUNT = 10;
const BACKUP_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export type StoredTwoFactor = {
  enabled: boolean;
  secret?: string; // encrypted
  enabledAt?: Date;
  lastStep?: number;
  backupCodes?: { hash: string; usedAt: Date | null }[];
  pending?: { secret: string; createdAt: Date };
};

function base32Encode(buf: Buffer) {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of Array.from(buf)) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

function base32Decode(text: string) {
  const clean = text.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    value = (value << 5) | B32.indexOf(ch);
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

function key() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");
  return createHash("sha256").update(`two-factor:${secret}`).digest();
}

/** AES-256-GCM so the authenticator secret isn't readable from the database alone. */
export function encryptSecret(plain: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((b) => b.toString("base64url")).join(".");
}

export function decryptSecret(stored: string) {
  const [iv, tag, data] = stored.split(".").map((p) => Buffer.from(p, "base64url"));
  const decipher = createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

export function newSecret() {
  return base32Encode(randomBytes(20));
}

function codeAt(secret: string, step: number) {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const hmac = createHmac("sha1", base32Decode(secret)).update(counter).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const n = ((hmac[offset] & 0x7f) << 24) | (hmac[offset + 1] << 16) | (hmac[offset + 2] << 8) | hmac[offset + 3];
  return String(n % 10 ** DIGITS).padStart(DIGITS, "0");
}

const sameString = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/**
 * Checks a 6-digit code (allowing one step of clock drift either way). Returns the time step it
 * matched so it can't be used twice, or null.
 */
export function verifyTotp(secret: string, input: string, lastStep = 0) {
  const code = input.replace(/\D/g, "");
  if (code.length !== DIGITS) return null;
  const now = Math.floor(Date.now() / 1000 / STEP_SECONDS);
  for (const step of [now, now - 1, now + 1]) {
    if (step <= lastStep) continue;
    if (sameString(codeAt(secret, step), code)) return step;
  }
  return null;
}

export function formatSecret(secret: string) {
  return secret.replace(/(.{4})/g, "$1 ").trim();
}

export function otpauthUrl(secret: string, account: string) {
  const label = encodeURIComponent(`${ISSUER}:${account}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(ISSUER)}&algorithm=SHA1&digits=${DIGITS}&period=${STEP_SECONDS}`;
}

export async function qrSvg(url: string) {
  return QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#1d0b05", light: "#ffffff" } });
}

// ---------- backup codes ----------
const hashBackup = (code: string) => createHash("sha256").update(`${process.env.AUTH_SECRET ?? ""}:backup:${code.toUpperCase().replace(/[^A-Z0-9]/g, "")}`).digest("hex");

/** Ten fresh one-time codes like "K7QD-M2PX": shown once, stored as hashes. */
export function newBackupCodes() {
  const codes = Array.from({ length: BACKUP_COUNT }, () => {
    const raw = Array.from({ length: 8 }, () => BACKUP_ALPHABET[randomInt(BACKUP_ALPHABET.length)]).join("");
    return `${raw.slice(0, 4)}-${raw.slice(4)}`;
  });
  return { codes, stored: codes.map((c) => ({ hash: hashBackup(c), usedAt: null as Date | null })) };
}

/** Index of the unused backup code that matches, or -1. */
export function matchBackupCode(stored: { hash: string; usedAt: Date | null }[] | undefined, input: string) {
  const clean = input.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (clean.length !== 8) return -1;
  const h = hashBackup(clean);
  return (stored ?? []).findIndex((c) => !c.usedAt && sameString(c.hash, h));
}

export const backupRemaining = (stored: { usedAt: Date | null }[] | undefined) => (stored ?? []).filter((c) => !c.usedAt).length;

/** For tests: the current code for a secret. */
export function currentCode(secret: string) {
  return codeAt(secret, Math.floor(Date.now() / 1000 / STEP_SECONDS));
}
