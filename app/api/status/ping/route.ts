import { NextResponse } from "next/server";
import { runEmailJobs } from "../../../../lib/email-jobs";
import { observeStaffRanks } from "../../../../lib/staff-activity";
import { runDueAnnouncements } from "../../../../lib/announcements";
import { pingDatabase } from "../../../../lib/status";
import { runTicketAutoCleanup } from "../../../../lib/ticket-autoclean";
import { refreshOutdatedNsfw } from "../../../../lib/ticket-summary";

export const dynamic = "force-dynamic";
export const maxDuration = 20;

/**
 * For the Main Bot's minute check (and anyone curious): is the website up, and can it reach its database?
 * The bot's check also drives the opt-in notification emails (scheduled news, events, giveaways, reminders)
 * the automatic deletion of tickets from members who left, and rebuilding outdated 18+ ticket descriptions.
 */
export async function GET(request: Request) {
  const db = await pingDatabase();
  if (db.ok && request.headers.get("user-agent")?.includes("BearNation-StatusCheck")) {
    await runEmailJobs(3_000).catch(() => undefined);
    await observeStaffRanks().catch(() => undefined);
    await runDueAnnouncements().catch(() => undefined);
    await runTicketAutoCleanup(8_000).catch(() => undefined);
    await refreshOutdatedNsfw(4_000).catch(() => 0);
  }
  return NextResponse.json({ ok: true, db: db.ok, dbMs: db.ms }, { headers: { "Cache-Control": "no-store" } });
}
