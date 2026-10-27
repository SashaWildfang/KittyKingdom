import { NextResponse } from "next/server";
import { requirePanel } from "../../../../../../lib/admin";
import { people } from "../../../../../../lib/admin-people";
import { TicketWorkError, addTicketNote, assignTicket, assignableStaff, assignmentStatus, deleteTicketNote, listTicketNotes } from "../../../../../../lib/ticket-work";

export const dynamic = "force-dynamic";

const fail = (error: unknown) => {
  if (error instanceof TicketWorkError) return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
  console.error("Ticket work request failed", error);
  return NextResponse.json({ ok: false, error: "That didn't work. Try again." }, { status: 500 });
};

/** A ticket's private staff notes, who it's assigned to, and who it can be assigned to (?adult=1 for 18+). */
export async function GET(request: Request, { params }: { params: { key: string } }) {
  const panel = await requirePanel(request);
  if (panel instanceof NextResponse) return panel;
  try {
    const adult = new URL(request.url).searchParams.get("adult") === "1";
    const [notes, assignment, staff] = await Promise.all([listTicketNotes(panel, params.key), assignmentStatus(params.key), assignableStaff(adult).catch(() => [])]);
    return NextResponse.json({ ok: true, notes, assignment, staff, people: await people(notes.map((n) => n.by)), me: panel.discordId, isAdmin: panel.level === "admin" }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return fail(error);
  }
}

/** {op: "note", text} · {op: "delete-note", id} · {op: "assign", to} */
export async function POST(request: Request, { params }: { params: { key: string } }) {
  const panel = await requirePanel(request);
  if (panel instanceof NextResponse) return panel;
  try {
    const body = (await request.json().catch(() => ({}))) as { op?: string; text?: string; id?: string; to?: string };
    if (body.op === "note") {
      await addTicketNote(panel, params.key, String(body.text ?? ""));
      return NextResponse.json({ ok: true });
    }
    if (body.op === "delete-note") {
      await deleteTicketNote(panel, String(body.id ?? ""));
      return NextResponse.json({ ok: true });
    }
    if (body.op === "assign") return NextResponse.json({ ok: true, ...(await assignTicket(panel, params.key, String(body.to ?? ""))) });
    return NextResponse.json({ ok: false, error: "Nothing to change." }, { status: 400 });
  } catch (error) {
    return fail(error);
  }
}
