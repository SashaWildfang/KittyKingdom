import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../../lib/admin";
import { resetChatEvent, saveChatEvent } from "../../../../../lib/chat-events/store";
import { chatEventFail as fail } from "../../../../../lib/chat-events/http";

export const dynamic = "force-dynamic";

/** Admins: save one event. */
export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const panel = await requireAdmin(request);
  if (panel instanceof NextResponse) return panel;
  try {
    const body = await request.json().catch(() => ({}));
    return NextResponse.json({ ok: true, event: await saveChatEvent(params.id, body?.event ?? {}, panel) });
  } catch (error) {
    return fail(error);
  }
}

/** Admins: put a built-in event back to how it ships, or delete a custom one. */
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const panel = await requireAdmin(request);
  if (panel instanceof NextResponse) return panel;
  try {
    return NextResponse.json({ ok: true, ...(await resetChatEvent(params.id, panel)) });
  } catch (error) {
    return fail(error);
  }
}
