import { NextResponse } from "next/server";
import { getCurrentUser } from "../../../lib/auth";
import { clearNotifications, listNotifications, markRead } from "../../../lib/notifications";
import { getViewAs } from "../../../lib/auth";

export const dynamic = "force-dynamic";

/** Your notifications (the bell). ?count=1 returns just the unread count; ?before=<time> pages back (the Notifications page). */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user?.discordId) return NextResponse.json({ ok: true, unread: 0, items: [] });
  const params = new URL(request.url).searchParams;
  const beforeRaw = params.get("before");
  const before = beforeRaw && !Number.isNaN(Date.parse(beforeRaw)) ? new Date(beforeRaw) : null;
  const data = await listNotifications(String(user.discordId), params.get("count") ? 0 : 30, before);
  return NextResponse.json({ ok: true, ...data }, { headers: { "Cache-Control": "no-store" } });
}

/** { ids } or { all: true }: marks notifications read. */
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return NextResponse.json({ ok: false }, { status: 403 });
  const user = await getCurrentUser();
  if (!user?.discordId || (await getViewAs())) return NextResponse.json({ ok: false }, { status: 403 });
  const body = (await request.json().catch(() => null)) as { ids?: unknown; all?: unknown } | null;
  await markRead(String(user.discordId), body?.all === true ? "all" : Array.isArray(body?.ids) ? body!.ids.map(String).slice(0, 100) : []);
  return NextResponse.json({ ok: true });
}

/** Clears all of your notifications. */
export async function DELETE(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) return NextResponse.json({ ok: false }, { status: 403 });
  const user = await getCurrentUser();
  if (!user?.discordId || (await getViewAs())) return NextResponse.json({ ok: false }, { status: 403 });
  await clearNotifications(String(user.discordId));
  return NextResponse.json({ ok: true });
}
