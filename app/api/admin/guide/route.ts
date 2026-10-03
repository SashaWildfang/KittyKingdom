import { NextResponse } from "next/server";
import { requireAdmin, requirePanel } from "../../../../lib/admin";
import { getNotes, saveNotes, staffRank } from "../../../../lib/staff-guide";

export const dynamic = "force-dynamic";
const NO_STORE = { "Cache-Control": "no-store" };

/** The Staff Guide: your rank (from your Discord roles), your panel level and the team notes. */
export async function GET(request: Request) {
  const panel = await requirePanel(request);
  if (panel instanceof NextResponse) return panel;
  const [rank, notes] = await Promise.all([staffRank(panel.discordId), getNotes()]);
  // Admins on the panel are at least Admin, even if Discord is slow to answer
  return NextResponse.json({ ok: true, rank: rank ?? (panel.level === "admin" ? "Admin" : "Helper"), level: panel.level, notes }, { headers: NO_STORE });
}

/** Admins: { notes } replaces the team notes shown to everyone on the guide. */
export async function PUT(request: Request) {
  const panel = await requireAdmin(request);
  if (panel instanceof NextResponse) return panel;
  const body = (await request.json().catch(() => ({}))) as { notes?: unknown };
  if (typeof body.notes !== "string") return NextResponse.json({ ok: false, error: "Write some notes first." }, { status: 400 });
  return NextResponse.json({ ok: true, notes: await saveNotes(body.notes, panel.name) }, { headers: NO_STORE });
}
