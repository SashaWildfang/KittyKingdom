import { NextResponse } from "next/server";
import { requirePanel } from "../../../../../../lib/admin";
import { people } from "../../../../../../lib/admin-people";
import { audit } from "../../../../../../lib/news-admin";
import { NoteError, addNote, changeNote, getWatch, listNotes, setWatch } from "../../../../../../lib/staff-notes";

export const dynamic = "force-dynamic";

const fail = (error: unknown) => {
  if (error instanceof NoteError) return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
  console.error("Staff notes request failed", error);
  return NextResponse.json({ ok: false, error: "That didn't work. Try again." }, { status: 500 });
};

/** A member's staff notes and watchlist entry (all staff). */
export async function GET(request: Request, { params }: { params: { userId: string } }) {
  const panel = await requirePanel(request);
  if (panel instanceof NextResponse) return panel;
  try {
    const [notes, watch] = await Promise.all([listNotes(params.userId), getWatch(params.userId)]);
    const who = await people([...notes.map((n) => n.by), watch?.by]);
    return NextResponse.json({ ok: true, notes, watch, people: who, me: panel.discordId, isAdmin: panel.level === "admin" }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return fail(error);
  }
}

/**
 * {op: "add", text} · {op: "edit", id, text} · {op: "pin", id, pinned} · {op: "delete", id}
 * {op: "watch", reason} · {op: "unwatch"}
 */
export async function POST(request: Request, { params }: { params: { userId: string } }) {
  const panel = await requirePanel(request);
  if (panel instanceof NextResponse) return panel;
  try {
    const body = (await request.json().catch(() => ({}))) as { op?: string; id?: string; text?: string; pinned?: boolean; reason?: string };
    const id = String(body.id ?? "");
    switch (body.op) {
      case "add":
        return NextResponse.json({ ok: true, note: await addNote(panel, params.userId, String(body.text ?? "")) });
      case "edit":
        return NextResponse.json({ ok: true, note: await changeNote(panel, id, { text: String(body.text ?? "") }) });
      case "pin":
        return NextResponse.json({ ok: true, note: await changeNote(panel, id, { pinned: Boolean(body.pinned) }) });
      case "delete":
        await changeNote(panel, id, { remove: true });
        await audit("staff-note-delete", { targetDiscordId: params.userId, noteId: id }, panel).catch(() => undefined);
        return NextResponse.json({ ok: true });
      case "watch": {
        const watch = await setWatch(panel, params.userId, true, String(body.reason ?? ""));
        await audit("watchlist-add", { targetDiscordId: params.userId, reason: watch?.reason }, panel).catch(() => undefined);
        return NextResponse.json({ ok: true, watch });
      }
      case "unwatch":
        await setWatch(panel, params.userId, false);
        await audit("watchlist-remove", { targetDiscordId: params.userId }, panel).catch(() => undefined);
        return NextResponse.json({ ok: true, watch: null });
      default:
        return NextResponse.json({ ok: false, error: "Nothing to change." }, { status: 400 });
    }
  } catch (error) {
    return fail(error);
  }
}
