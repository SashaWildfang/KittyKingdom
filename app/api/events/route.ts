import { NextResponse } from "next/server";
import { getCurrentUser } from "../../../lib/auth";
import { listEvents } from "../../../lib/events";

export const dynamic = "force-dynamic";

/** Public: events from ?from= (ISO, default now) for ?days= (default 62), plus which ones you asked to be reminded about. */
export async function GET(request: Request) {
  const u = new URL(request.url);
  const fromRaw = u.searchParams.get("from");
  const from = fromRaw ? new Date(fromRaw) : undefined;
  const days = Math.min(93, Math.max(1, Number(u.searchParams.get("days") ?? 62) || 62));
  try {
    const user = await getCurrentUser().catch(() => null);
    const data = await listEvents({ discordId: user?.discordId ? String(user.discordId) : null, from: from && !Number.isNaN(from.getTime()) ? from : undefined, days, includePast: !fromRaw });
    return NextResponse.json({ ok: true, ...data, signedIn: Boolean(user), linked: Boolean(user?.discordId) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Events failed", error);
    return NextResponse.json({ ok: false, error: "Couldn't load events." }, { status: 500 });
  }
}
