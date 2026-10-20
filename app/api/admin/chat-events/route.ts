import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../lib/admin";
import { requireGiveawayManager } from "../../../../lib/giveaway-access";
import { createChatEvent, getChatEvents, saveChatEventSettings } from "../../../../lib/chat-events/store";
import { chatEventFail as fail } from "../../../../lib/chat-events/http";
import { type EventSeason, type EventType } from "../../../../lib/chat-events/types";

export const dynamic = "force-dynamic";

/** Admins and Community Managers: every event, the settings, recent runs and stats. */
export async function GET(request: Request) {
  const panel = await requireGiveawayManager(request);
  if (panel instanceof NextResponse) return panel;
  try {
    return NextResponse.json({ ok: true, ...(await getChatEvents()), canEdit: panel.isAdmin }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return fail(error);
  }
}

/** Admins: change the settings that apply to every event. */
export async function PUT(request: Request) {
  const panel = await requireAdmin(request);
  if (panel instanceof NextResponse) return panel;
  try {
    const body = await request.json().catch(() => ({}));
    return NextResponse.json({ ok: true, ...(await saveChatEventSettings(body?.settings ?? {}, panel)) });
  } catch (error) {
    return fail(error);
  }
}

/** Admins: add a custom event ({type, season}); it starts switched off. */
export async function POST(request: Request) {
  const panel = await requireAdmin(request);
  if (panel instanceof NextResponse) return panel;
  try {
    const body = await request.json().catch(() => ({}));
    return NextResponse.json({ ok: true, event: await createChatEvent(body?.type as EventType, (body?.season ?? "any") as EventSeason, panel) });
  } catch (error) {
    return fail(error);
  }
}
