import { NextResponse } from "next/server";
import { isSnowflake } from "../../../../../lib/dating/db";
import { deleteMessage, hideConversation, respondToRequest, send, thread } from "../../../../../lib/dating/messages";
import { getProfile } from "../../../../../lib/dating/profiles";
import { requireDating, sameOrigin } from "../../../../../lib/dating/route-helpers";
import { touchActive } from "../../../../../lib/dating/social";
import { MINUTE, allow } from "../../../../../lib/rate-limit";

export const dynamic = "force-dynamic";

/** The conversation with member [id] (?before= for older messages). Opening it marks it read. */
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const me = await requireDating();
  if (me instanceof NextResponse) return me;
  if (!isSnowflake(params.id)) return NextResponse.json({ ok: false, error: "Unknown member." }, { status: 404 });
  const t = await thread(me.discordId, params.id, new URL(request.url).searchParams.get("before") ?? undefined, { readOnly: me.readOnly });
  if (!t) return NextResponse.json({ ok: false, error: "You can't message this member." }, { status: 403 });
  return NextResponse.json({ ok: true, me: me.discordId, ...t }, { headers: { "Cache-Control": "no-store" } });
}

/** { text } sends a message · { request: "accept"|"decline" } answers a request · { hide: true } · { unsend: messageId } */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  if (!sameOrigin(request)) return NextResponse.json({ ok: false, error: "Invalid request origin." }, { status: 403 });
  const me = await requireDating();
  if (me instanceof NextResponse) return me;
  if (!isSnowflake(params.id)) return NextResponse.json({ ok: false, error: "Unknown member." }, { status: 404 });
  const body = (await request.json().catch(() => null)) as { text?: unknown; request?: unknown; hide?: unknown; unsend?: unknown } | null;
  if (!body) return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  await touchActive(me.discordId).catch(() => undefined);
  if (body.request === "accept" || body.request === "decline") {
    const err = await respondToRequest(me.discordId, params.id, body.request === "accept");
    return err ? NextResponse.json({ ok: false, error: err }, { status: 400 }) : NextResponse.json({ ok: true });
  }
  if (body.hide === true) {
    await hideConversation(me.discordId, params.id);
    return NextResponse.json({ ok: true });
  }
  if (typeof body.unsend === "string") {
    await deleteMessage(me.discordId, body.unsend);
    return NextResponse.json({ ok: true });
  }
  if (typeof body.text !== "string") return NextResponse.json({ ok: false, error: "Write a message first." }, { status: 400 });
  if (!(await allow([{ key: `dating-msg:${me.discordId}`, limit: 30, windowMs: MINUTE }]))) return NextResponse.json({ ok: false, error: "You're sending messages very fast. Take a breath!" }, { status: 429 });
  const mine = await getProfile(me.discordId);
  const res = await send(me.discordId, params.id, body.text, String(mine?.name ?? me.name));
  if (typeof res === "string") return NextResponse.json({ ok: false, error: res }, { status: 400 });
  return NextResponse.json({ ok: true, id: res.id });
}
