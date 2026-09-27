import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { getCurrentUser } from "./auth";
import { getMemberRoleIds } from "./discord-member";
import { getStaffCollection } from "./mongodb";

// Admin or higher see everything in the panel
export const ADMIN_ROLE_IDS = [
  "1358472511133585564", // Admin
  "1358473248534167663", // Owner
];
// The rest of the staff team see the overview and punishments (no tickets, transcripts or accounts)
export const STAFF_TEAM_ROLE_ID = "1358470109965979859";

export type PanelLevel = "admin" | "staff";

const ROLE_CACHE_MS = 60_000;
const roleCache = new Map<string, { level: PanelLevel | null; at: number }>();

/** The member's panel access (checked with Discord, cached for a minute). */
export async function panelLevel(discordId: string): Promise<PanelLevel | null> {
  const cached = roleCache.get(discordId);
  if (cached && Date.now() - cached.at < ROLE_CACHE_MS) return cached.level;
  const roles = await getMemberRoleIds(discordId);
  const level: PanelLevel | null = roles?.some((id) => ADMIN_ROLE_IDS.includes(id))
    ? "admin"
    : roles?.includes(STAFF_TEAM_ROLE_ID)
      ? "staff"
      : null;
  // Don't cache a failed lookup as "no access"
  if (roles) roleCache.set(discordId, { level, at: Date.now() });
  return level;
}

export type PanelUser = { discordId: string; name: string; level: PanelLevel; websiteUserId: string };
/** Kept for older imports: an admin is a panel user with the admin level. */
export type AdminUser = PanelUser;

/** The signed-in staff member or admin, or null. */
export async function getPanelUser(): Promise<PanelUser | null> {
  const user = await getCurrentUser();
  const discordId = user?.discordId ? String(user.discordId) : null;
  if (!user || !discordId) return null;
  const level = await panelLevel(discordId);
  if (!level) return null;
  const name = String(user.displayName ?? user.username ?? user.discord?.username ?? "Staff");
  return { discordId, name, level, websiteUserId: String(user._id) };
}

/** The signed-in admin (Admin / Owner), or null. */
export async function getAdminUser(): Promise<PanelUser | null> {
  const panel = await getPanelUser();
  return panel?.level === "admin" ? panel : null;
}

/** For panel API routes: the staff member / admin, or an error response to return. */
export async function requirePanel(request: Request, needed: PanelLevel = "staff"): Promise<PanelUser | NextResponse> {
  if (request.method !== "GET") {
    const origin = request.headers.get("origin");
    if (!origin || origin !== new URL(request.url).origin) {
      return NextResponse.json({ ok: false, error: "Invalid request origin." }, { status: 403 });
    }
  }
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Please log in." }, { status: 401 });
  const panel = await getPanelUser();
  if (!panel || (needed === "admin" && panel.level !== "admin")) {
    return NextResponse.json({ ok: false, error: needed === "admin" ? "Admins only." : "Staff only." }, { status: 403 });
  }
  return panel;
}

/** Admin-only API routes. */
export function requireAdmin(request: Request) {
  return requirePanel(request, "admin");
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

/**
 * Whether a Discord account belongs to staff: the Staff Team / Admin / Owner role in Discord,
 * or listed on the bot-synced staff page. Staff website accounts can't be deleted.
 */
export async function isStaffDiscordId(discordId: unknown) {
  if (!discordId) return false;
  const id = String(discordId);
  const [roles, listed] = await Promise.all([
    getMemberRoleIds(id).catch(() => null),
    getStaffCollection()
      .then((col) => col.findOne({ $or: [{ _id: id as never }, { discord_id: id }] }, { projection: { _id: 1 } }))
      .catch(() => null),
  ]);
  return Boolean(listed) || Boolean(roles?.some((r) => r === STAFF_TEAM_ROLE_ID || ADMIN_ROLE_IDS.includes(r)));
}
