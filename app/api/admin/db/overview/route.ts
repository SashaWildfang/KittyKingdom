import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../../lib/admin";
import { NO_STORE, dbFail } from "../../../../../lib/db-manager/guard";
import { overview } from "../../../../../lib/db-manager/server";
import { OWNER_DISCORD_ID } from "../../../../../lib/ticket-delete";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Sizes and growth (admins). Browsing, cleanup and backups are the owner's. */
export async function GET(request: Request) {
  const admin = await requireAdmin(request);
  if (admin instanceof NextResponse) return admin;
  try {
    return NextResponse.json({ ok: true, isOwner: admin.discordId === OWNER_DISCORD_ID, ...(await overview()) }, NO_STORE);
  } catch (error) {
    return dbFail(error);
  }
}
