import { NextResponse } from "next/server";
import { requirePanel } from "../../../../../../lib/admin";
import { people } from "../../../../../../lib/admin-people";
import { altHints } from "../../../../../../lib/alt-hints";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

/** Accounts that might belong to the same person (leads, not proof). */
export async function GET(request: Request, { params }: { params: { userId: string } }) {
  const panel = await requirePanel(request);
  if (panel instanceof NextResponse) return panel;
  if (!/^\d{15,21}$/.test(params.userId)) return NextResponse.json({ ok: false, error: "Invalid Discord ID." }, { status: 400 });
  try {
    const hints = await altHints(panel, params.userId);
    return NextResponse.json({ ok: true, hints, people: await people(hints.map((h) => h.discordId)), networkChecked: panel.level === "admin" }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Alt hints failed", error);
    return NextResponse.json({ ok: false, error: "Couldn't check for alts." }, { status: 500 });
  }
}
