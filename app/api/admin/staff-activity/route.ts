import { NextResponse } from "next/server";
import { requirePanel } from "../../../../lib/admin";
import { people } from "../../../../lib/admin-people";
import { setReview, staffActivity } from "../../../../lib/staff-activity";

export const dynamic = "force-dynamic";
export const maxDuration = 20;

/** Admins: what each staff member did in the last ?days=7|30|90, time in rank and review flags. */
export async function GET(request: Request) {
  const panel = await requirePanel(request, "admin");
  if (panel instanceof NextResponse) return panel;
  const d = Number(new URL(request.url).searchParams.get("days"));
  const days = [7, 30, 90].includes(d) ? d : 30;
  try {
    const rows = await staffActivity(panel, days);
    return NextResponse.json({ ok: true, days, rows, people: await people(rows.map((r) => r.id)) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Staff activity failed", error);
    return NextResponse.json({ ok: false, error: "Couldn't load staff activity." }, { status: 500 });
  }
}

/** Admins: {discordId, flag: "promote" | "support" | null, note} */
export async function POST(request: Request) {
  const panel = await requirePanel(request, "admin");
  if (panel instanceof NextResponse) return panel;
  const body = (await request.json().catch(() => ({}))) as { discordId?: string; flag?: string | null; note?: string };
  try {
    await setReview(panel, String(body.discordId ?? ""), body.flag ?? null, String(body.note ?? ""));
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "Couldn't save that." }, { status: 400 });
  }
}
