import { NextResponse } from "next/server";
import { requireAdmin, type PanelUser } from "../admin";
import { requireTwoFactorForAction } from "../admin-2fa";
import { OWNER_DISCORD_ID } from "../ticket-delete";
import { DbmError } from "./server";

/** Looking around: the owner only (records include private chats and personal data) */
export async function requireDbOwner(request: Request): Promise<PanelUser | NextResponse> {
  const admin = await requireAdmin(request);
  if (admin instanceof NextResponse) return admin;
  if (admin.discordId !== OWNER_DISCORD_ID) return NextResponse.json({ ok: false, error: "Only the owner can use the database tools." }, { status: 403 });
  return admin;
}

/** Changing anything: the owner, with 2FA on */
export async function requireDbWrite(request: Request): Promise<PanelUser | NextResponse> {
  const owner = await requireDbOwner(request);
  if (owner instanceof NextResponse) return owner;
  const twoFactor = await requireTwoFactorForAction();
  return twoFactor ?? owner;
}

export function dbFail(error: unknown) {
  if (error instanceof DbmError) return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
  console.error("Database manager failed", error);
  const message = error instanceof Error && /time limit|maxTimeMS|exceeded/i.test(error.message) ? "That took too long. Try a narrower filter." : "That didn't work right now. Please try again.";
  return NextResponse.json({ ok: false, error: message }, { status: 500 });
}

export const NO_STORE = { headers: { "Cache-Control": "no-store" } };
