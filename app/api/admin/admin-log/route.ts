import { NextResponse } from "next/server";
import { requirePanel } from "../../../../lib/admin";
import { people } from "../../../../lib/admin-people";
import { UndoError, listAdminLog, undoEntry } from "../../../../lib/admin-log";

export const dynamic = "force-dynamic";

/** Admins: the panel's change log (?admin=&action=&target=&before=<id> to page back). */
export async function GET(request: Request) {
  const panel = await requirePanel(request, "admin");
  if (panel instanceof NextResponse) return panel;
  const q = new URL(request.url).searchParams;
  const data = await listAdminLog({ admin: q.get("admin") ?? undefined, action: q.get("action") ?? undefined, target: q.get("target") ?? undefined, before: q.get("before") ?? undefined });
  return NextResponse.json({ ok: true, ...data, people: await people(data.entries.flatMap((e) => [e.target, e.adminDiscordId])) }, { headers: { "Cache-Control": "no-store" } });
}

/** Admins: {id} undoes one change. */
export async function POST(request: Request) {
  const panel = await requirePanel(request, "admin");
  if (panel instanceof NextResponse) return panel;
  try {
    const body = (await request.json().catch(() => ({}))) as { id?: string };
    await undoEntry(panel, String(body.id ?? ""));
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof UndoError) return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    console.error("Undo failed", error);
    return NextResponse.json({ ok: false, error: "Undo didn't work." }, { status: 500 });
  }
}
