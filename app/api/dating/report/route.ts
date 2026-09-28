import { NextResponse } from "next/server";
import { fileReport } from "../../../../lib/dating/reports";
import { requireDating, sameOrigin } from "../../../../lib/dating/route-helpers";
import { HOUR, allow } from "../../../../lib/rate-limit";

export const dynamic = "force-dynamic";

/** { type: profile|photo|message, target, reason, details?, photoId?, messageId? } */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ ok: false, error: "Invalid request origin." }, { status: 403 });
  const me = await requireDating();
  if (me instanceof NextResponse) return me;
  if (!(await allow([{ key: `dating-report:${me.discordId}`, limit: 20, windowMs: HOUR }]))) return NextResponse.json({ ok: false, error: "You've sent a lot of reports. Please open a ticket instead." }, { status: 429 });
  const body = (await request.json().catch(() => null)) as Record<string, string> | null;
  if (!body) return NextResponse.json({ ok: false, error: "Invalid report." }, { status: 400 });
  const err = await fileReport(me.discordId, { type: body.type, target: body.target, reason: body.reason, details: body.details, photoId: body.photoId, messageId: body.messageId });
  if (err) return NextResponse.json({ ok: false, error: err }, { status: 400 });
  return NextResponse.json({ ok: true, message: "Thanks. Staff will review it. Only what you reported is shared with them." });
}
