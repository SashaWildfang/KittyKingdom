import { NextResponse } from "next/server";
import { requirePanel } from "../../../../../lib/admin";
import { allStatuses, consoleConfigured } from "../../../../../lib/bot-console";
import { botHealth } from "../../../../../lib/bot-health";

export const dynamic = "force-dynamic";

/** Admins: each bot's memory/CPU/delay history and advice on how much to give it. */
export async function GET(request: Request) {
  const panel = await requirePanel(request, "admin");
  if (panel instanceof NextResponse) return panel;
  const range = new URL(request.url).searchParams.get("range") === "7d" ? "7d" : "24h";
  const statuses = consoleConfigured() ? await allStatuses().catch(() => []) : [];
  return NextResponse.json({ ok: true, range, ...(await botHealth(range, statuses)) }, { headers: { "Cache-Control": "no-store" } });
}
