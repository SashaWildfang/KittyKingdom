import { NextResponse } from "next/server";
import { getCurrentUser, getViewAs } from "../../../../lib/auth";
import { getEventReads, markEventsRead } from "../../../../lib/event-reads";

export const dynamic = "force-dynamic";

/** The events and polls you've opened (signed in). Signed-out visitors keep them in the browser instead. */
export async function GET() {
  const user = await getCurrentUser().catch(() => null);
  if (!user) return NextResponse.json({ ok: true, signedIn: false, ids: [] });
  return NextResponse.json({ ok: true, signedIn: true, ...(await getEventReads(String(user._id))) }, { headers: { "Cache-Control": "no-store" } });
}

/** { ids: ["e:…", "p:…"] } marks them read. */
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return NextResponse.json({ ok: false }, { status: 403 });
  const user = await getCurrentUser().catch(() => null);
  if (!user || (await getViewAs())) return NextResponse.json({ ok: false }, { status: 403 });
  const body = (await request.json().catch(() => null)) as { ids?: unknown } | null;
  if (Array.isArray(body?.ids)) await markEventsRead(String(user._id), body!.ids.map(String));
  return NextResponse.json({ ok: true });
}
