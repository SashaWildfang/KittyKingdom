import { NextResponse } from "next/server";
import { conversations } from "../../../../lib/dating/messages";
import { requireDating } from "../../../../lib/dating/route-helpers";

export const dynamic = "force-dynamic";

/** Unread messages + message requests, for the Messages tab in the top bar (polled). */
export async function GET() {
  const me = await requireDating();
  if (me instanceof NextResponse) return NextResponse.json({ ok: true, unread: 0 });
  const convs = await conversations(me.discordId);
  return NextResponse.json({ ok: true, unread: convs.unread + convs.requestCount }, { headers: { "Cache-Control": "no-store" } });
}
