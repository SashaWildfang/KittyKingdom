import { NextResponse } from "next/server";
import { runEmailJobs } from "../../../../lib/email-jobs";
import { pingDatabase } from "../../../../lib/status";

export const dynamic = "force-dynamic";
export const maxDuration = 20;

/**
 * For the Main Bot's minute check (and anyone curious): is the website up, and can it reach its database?
 * The bot's check also drives the opt-in notification emails (scheduled news, events, giveaways, reminders).
 */
export async function GET(request: Request) {
  const db = await pingDatabase();
  if (db.ok && request.headers.get("user-agent")?.includes("BearNation-StatusCheck")) await runEmailJobs(3_000).catch(() => undefined);
  return NextResponse.json({ ok: true, db: db.ok, dbMs: db.ms }, { headers: { "Cache-Control": "no-store" } });
}
