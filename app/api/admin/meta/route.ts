import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../lib/admin";
import { punishmentActions } from "../../../../lib/moderation";
import { ticketTypes } from "../../../../lib/tickets";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const admin = await requireAdmin(request);
  if (admin instanceof NextResponse) return admin;
  const [actions, types] = await Promise.all([punishmentActions().catch(() => []), ticketTypes().catch(() => [])]);
  return NextResponse.json({ ok: true, actions, ticketTypes: types });
}
