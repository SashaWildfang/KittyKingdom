import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../../lib/admin";
import { autoCleanupStatus } from "../../../../../lib/ticket-autoclean";

export const dynamic = "force-dynamic";

/** Admins: is the automatic clean-up of leavers' tickets on, and what has it deleted. */
export async function GET(request: Request) {
  const admin = await requireAdmin(request);
  if (admin instanceof NextResponse) return admin;
  return NextResponse.json({ ok: true, status: await autoCleanupStatus() });
}
