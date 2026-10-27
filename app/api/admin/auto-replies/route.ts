import { NextResponse } from "next/server";
import { requirePanel } from "../../../../lib/admin";
import { announceChannels } from "../../../../lib/announcements";
import { AutoReplyError, deleteAutoReply, listAutoReplies, saveAutoReply, toggleAutoReply } from "../../../../lib/auto-replies";

export const dynamic = "force-dynamic";

/** Admins: auto-replies and custom commands. */
export async function GET(request: Request) {
  const panel = await requirePanel(request, "admin");
  if (panel instanceof NextResponse) return panel;
  const [items, channels] = await Promise.all([listAutoReplies(), announceChannels().catch(() => [])]);
  return NextResponse.json({ ok: true, items, channels }, { headers: { "Cache-Control": "no-store" } });
}

/** Admins: {op: "save", …} · {op: "delete", id} · {op: "toggle", id, enabled} */
export async function POST(request: Request) {
  const panel = await requirePanel(request, "admin");
  if (panel instanceof NextResponse) return panel;
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    if (body.op === "save") return NextResponse.json({ ok: true, item: await saveAutoReply(panel, body) });
    if (body.op === "delete") await deleteAutoReply(String(body.id ?? ""));
    else if (body.op === "toggle") await toggleAutoReply(String(body.id ?? ""), Boolean(body.enabled));
    else return NextResponse.json({ ok: false, error: "Nothing to change." }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AutoReplyError) return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    console.error("Auto-reply change failed", error);
    return NextResponse.json({ ok: false, error: "That didn't work. Try again." }, { status: 500 });
  }
}
