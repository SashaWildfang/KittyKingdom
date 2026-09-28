import { NextResponse } from "next/server";
import { invalidatePool } from "../../../../lib/dating/pool";
import { requireDating, sameOrigin } from "../../../../lib/dating/route-helpers";
import { NOTIFY_TYPES, getSettings, saveSettings } from "../../../../lib/dating/settings";

export const dynamic = "force-dynamic";

/** Your Dating settings (notifications, privacy, Discover defaults). */
export async function GET() {
  const me = await requireDating();
  if (me instanceof NextResponse) return me;
  return NextResponse.json({ ok: true, settings: await getSettings(me.discordId), types: NOTIFY_TYPES }, { headers: { "Cache-Control": "no-store" } });
}

/** Saves a partial settings change. */
export async function PUT(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ ok: false, error: "Invalid request origin." }, { status: 403 });
  const me = await requireDating();
  if (me instanceof NextResponse) return me;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ ok: false, error: "Invalid settings." }, { status: 400 });
  const settings = await saveSettings(me.discordId, body);
  invalidatePool();
  return NextResponse.json({ ok: true, settings });
}
