import { NextResponse } from "next/server";
import { getCurrentUser, getViewAs } from "../../../../lib/auth";
import { getNewsReads, markAllNewsRead, markNewsRead } from "../../../../lib/news-reads";

export const dynamic = "force-dynamic";

/** What you've read (signed in). Signed-out visitors keep their reads in the browser instead. */
export async function GET() {
  const user = await getCurrentUser().catch(() => null);
  if (!user) return NextResponse.json({ ok: true, signedIn: false, ids: [], allBefore: null });
  return NextResponse.json({ ok: true, signedIn: true, ...(await getNewsReads(String(user._id))) }, { headers: { "Cache-Control": "no-store" } });
}

/** { ids: [...] } marks posts read · { all: true } marks everything read. */
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return NextResponse.json({ ok: false }, { status: 403 });
  const user = await getCurrentUser().catch(() => null);
  // "View as" is read-only
  if (!user || (await getViewAs())) return NextResponse.json({ ok: false }, { status: 403 });
  const body = (await request.json().catch(() => null)) as { ids?: unknown; all?: unknown } | null;
  if (body?.all === true) await markAllNewsRead(String(user._id));
  else if (Array.isArray(body?.ids)) await markNewsRead(String(user._id), body!.ids.map(String));
  return NextResponse.json({ ok: true });
}
