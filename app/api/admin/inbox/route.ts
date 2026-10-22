import { NextResponse } from "next/server";
import { requirePanel } from "../../../../lib/admin";
import { InboxError, inboxAction, inboxCount, inboxItems } from "../../../../lib/inbox";

export const dynamic = "force-dynamic";

/** Staff: everything waiting on someone (?count=1 for just the numbers, for the tab's bubble). */
export async function GET(request: Request) {
  const panel = await requirePanel(request);
  if (panel instanceof NextResponse) return panel;
  try {
    if (new URL(request.url).searchParams.get("count") === "1") return NextResponse.json({ ok: true, ...(await inboxCount(panel)) }, { headers: { "Cache-Control": "no-store" } });
    return NextResponse.json({ ok: true, items: await inboxItems(panel), me: panel.discordId }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Inbox failed", error);
    return NextResponse.json({ ok: false, error: "Couldn't load what needs attention." }, { status: 500 });
  }
}

/** Staff: {key, action: "claim" | "release" | "done" | "undo"} */
export async function POST(request: Request) {
  const panel = await requirePanel(request);
  if (panel instanceof NextResponse) return panel;
  try {
    const body = (await request.json().catch(() => ({}))) as { key?: string; action?: string };
    await inboxAction(panel, String(body.key ?? ""), String(body.action ?? ""));
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof InboxError) return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    console.error("Inbox action failed", error);
    return NextResponse.json({ ok: false, error: "That didn't work. Try again." }, { status: 500 });
  }
}
