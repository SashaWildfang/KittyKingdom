import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { getCurrentUser } from "./auth";
import { getMemberRoleIds } from "./discord-member";

// Admin or higher can open the Admin tab
export const ADMIN_ROLE_IDS = [
  "1358472511133585564", // Admin
  "1358473248534167663", // Owner
];

const ROLE_CACHE_MS = 60_000;
const roleCache = new Map<string, { admin: boolean; at: number }>();

/** Whether this Discord member currently has an admin role (checked with Discord, cached for a minute). */
export async function isDiscordAdmin(discordId: string): Promise<boolean> {
  const cached = roleCache.get(discordId);
  if (cached && Date.now() - cached.at < ROLE_CACHE_MS) return cached.admin;
  const roles = await getMemberRoleIds(discordId);
  const admin = Boolean(roles?.some((id) => ADMIN_ROLE_IDS.includes(id)));
  // Don't cache a failed lookup as "not admin"
  if (roles) roleCache.set(discordId, { admin, at: Date.now() });
  return admin;
}

export type AdminUser = { discordId: string; name: string };

/** The signed-in admin, or null. */
export async function getAdminUser(): Promise<AdminUser | null> {
  const user = await getCurrentUser();
  const discordId = user?.discordId ? String(user.discordId) : null;
  if (!user || !discordId) return null;
  if (!(await isDiscordAdmin(discordId))) return null;
  const name = String(user.displayName ?? user.username ?? user.discord?.username ?? "Admin");
  return { discordId, name };
}

/** For admin API routes: the admin, or an error response to return. */
export async function requireAdmin(request: Request): Promise<AdminUser | NextResponse> {
  if (request.method !== "GET") {
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin) {
      return NextResponse.json({ ok: false, error: "Invalid request origin." }, { status: 403 });
    }
  }
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Please log in." }, { status: 401 });
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ ok: false, error: "Admins only." }, { status: 403 });
  return admin;
}

// ==========================================
// Transcript links
// ==========================================
// Transcript pages load their CSS and images from inside a sandboxed frame, which doesn't send
// the login cookie. So each transcript gets a short-lived signed link instead.
const TRANSCRIPT_LINK_MS = 2 * 60 * 60 * 1000;

function secret() {
  const value = process.env.AUTH_SECRET;
  if (!value) throw new Error("AUTH_SECRET is not set");
  return value;
}

function sign(messageId: string, expires: number) {
  return createHmac("sha256", secret()).update(`transcript:${messageId}:${expires}`).digest("hex").slice(0, 40);
}

export function transcriptToken(messageId: string) {
  const expires = Date.now() + TRANSCRIPT_LINK_MS;
  return `${expires}.${sign(messageId, expires)}`;
}

export function verifyTranscriptToken(messageId: string, token: string) {
  const [expiresText, signature] = token.split(".");
  const expires = Number(expiresText);
  if (!Number.isFinite(expires) || expires < Date.now() || !signature) return false;
  const expected = Buffer.from(sign(messageId, expires));
  const actual = Buffer.from(signature);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
