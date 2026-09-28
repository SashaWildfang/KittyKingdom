import { NextResponse } from "next/server";
import { requirePanel } from "../../../../../lib/admin";
import { people } from "../../../../../lib/admin-people";
import { listReports, resolveReport } from "../../../../../lib/dating/reports";
import { getMongoClient } from "../../../../../lib/mongodb";

export const dynamic = "force-dynamic";

/** Dating reports for staff (only what members reported). ?status=open|closed|all */
export async function GET(request: Request) {
  const panel = await requirePanel(request);
  if (panel instanceof NextResponse) return panel;
  const s = new URL(request.url).searchParams.get("status");
  const reports = await listReports(s === "closed" || s === "all" ? s : "open");
  const who = await people(reports.flatMap((r) => [r.reporter, r.reported])).catch(() => ({}));
  return NextResponse.json({ ok: true, reports, people: who }, { headers: { "Cache-Control": "no-store" } });
}

/** { id, action: dismiss|remove-photo|pause-profile } */
export async function POST(request: Request) {
  const panel = await requirePanel(request);
  if (panel instanceof NextResponse) return panel;
  const body = (await request.json().catch(() => null)) as { id?: string; action?: string } | null;
  const action = (["dismiss", "remove-photo", "pause-profile"] as const).find((a) => a === body?.action);
  if (!body?.id || !action) return NextResponse.json({ ok: false, error: "Invalid action." }, { status: 400 });
  const err = await resolveReport(body.id, action, panel.name);
  if (err) return NextResponse.json({ ok: false, error: err }, { status: 400 });
  await (await getMongoClient()).db(process.env.MONGODB_DB ?? "website").collection("admin_audit").insertOne({ at: new Date(), action: `dating-report-${action}`, reportId: body.id, adminDiscordId: panel.discordId, adminName: panel.name });
  return NextResponse.json({ ok: true });
}
