import { NextResponse } from "next/server";
import { requirePanel } from "../../../../../lib/admin";
import { botVersions } from "../../../../../lib/bot-versions";

export const dynamic = "force-dynamic";

/** Admins: which bot files on each server aren't the latest version. */
export async function GET(request: Request) {
  const panel = await requirePanel(request, "admin");
  if (panel instanceof NextResponse) return panel;
  return NextResponse.json({ ok: true, bots: await botVersions() }, { headers: { "Cache-Control": "no-store" } });
}
