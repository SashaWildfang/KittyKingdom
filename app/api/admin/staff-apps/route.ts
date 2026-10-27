import { NextResponse } from "next/server";
import { requirePanel } from "../../../../lib/admin";
import { people } from "../../../../lib/admin-people";
import { STAGES, listStaffApps, setStage, vote } from "../../../../lib/staff-apps";

export const dynamic = "force-dynamic";

/** Admins: staff applications (staff-application tickets) and where each one is at. */
export async function GET(request: Request) {
  const panel = await requirePanel(request, "admin");
  if (panel instanceof NextResponse) return panel;
  try {
    const apps = await listStaffApps(panel);
    return NextResponse.json({ ok: true, stages: STAGES, apps, people: await people(apps.flatMap((a) => [a.applicant, ...a.votes.yes, ...a.votes.no])) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Staff apps failed", error);
    return NextResponse.json({ ok: false, error: "Couldn't load applications." }, { status: 500 });
  }
}

/** Admins: {key, stage} or {key, vote: "yes" | "no" | null} */
export async function POST(request: Request) {
  const panel = await requirePanel(request, "admin");
  if (panel instanceof NextResponse) return panel;
  const body = (await request.json().catch(() => ({}))) as { key?: string; stage?: string; vote?: string | null };
  try {
    if (body.stage) await setStage(panel, String(body.key ?? ""), body.stage);
    else await vote(panel, String(body.key ?? ""), body.vote ?? null);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Couldn't save that." }, { status: 400 });
  }
}
