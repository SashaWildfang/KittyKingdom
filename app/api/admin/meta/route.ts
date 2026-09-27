import { NextResponse } from "next/server";
import { requirePanel } from "../../../../lib/admin";
import { punishmentActions } from "../../../../lib/moderation";
import { ticketTypes } from "../../../../lib/tickets";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const panel = await requirePanel(request);
  if (panel instanceof NextResponse) return panel;
  const [actions, types] = await Promise.all([
    punishmentActions().catch(() => []),
    panel.level === "admin" ? ticketTypes().catch(() => []) : Promise.resolve([]),
  ]);
  return NextResponse.json({ ok: true, level: panel.level, actions, ticketTypes: types });
}
