import { NextResponse } from "next/server";
import { requireGiveawayManager } from "../../../../../lib/giveaway-access";
import { requestRun } from "../../../../../lib/chat-events/store";
import { chatEventFail as fail } from "../../../../../lib/chat-events/http";

export const dynamic = "force-dynamic";

/** Admins and Community Managers: start an event now ({eventId | "random", channelId, ping}). The bot picks it up in a few seconds. */
export async function POST(request: Request) {
  const panel = await requireGiveawayManager(request);
  if (panel instanceof NextResponse) return panel;
  try {
    const body = await request.json().catch(() => ({}));
    return NextResponse.json({ ok: true, ...(await requestRun(String(body?.eventId ?? "random"), String(body?.channelId ?? ""), Boolean(body?.ping), panel)) });
  } catch (error) {
    return fail(error);
  }
}
