import { NextResponse } from "next/server";
import { requirePanel } from "../../../../lib/admin";
import { people } from "../../../../lib/admin-people";
import { ReportError, listReports, openReportCount, reportsAbout, resolveReport, type ReportStatus } from "../../../../lib/reports";

export const dynamic = "force-dynamic";

/** Staff: ?status=open|handled|dismissed|all&page=1 · ?about=<memberId>&except=<reportId> for past reports */
export async function GET(request: Request) {
  const panel = await requirePanel(request);
  if (panel instanceof NextResponse) return panel;
  const q = new URL(request.url).searchParams;
  try {
    if (q.get("count") === "1") {
      return NextResponse.json({ ok: true, open: await openReportCount() }, { headers: { "Cache-Control": "no-store" } });
    }
    const about = q.get("about");
    if (about && /^\d{15,21}$/.test(about)) return NextResponse.json({ ok: true, reports: await reportsAbout(about, q.get("except") ?? undefined) }, { headers: { "Cache-Control": "no-store" } });
    const status = (["open", "handled", "dismissed", "all"].includes(String(q.get("status"))) ? q.get("status") : "open") as ReportStatus | "all";
    const data = await listReports(status, Number(q.get("page") ?? 1) || 1);
    const who = await people(data.reports.flatMap((r) => [r.authorId, ...r.reporters.map((x) => x.id), r.outcome?.by]));
    return NextResponse.json({ ok: true, ...data, people: who }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Reports failed", error);
    return NextResponse.json({ ok: false, error: "Couldn't load reports." }, { status: 500 });
  }
}

/** Staff: {id, status: "handled" | "dismissed" | "open", note?, deleteMessage?} */
export async function POST(request: Request) {
  const panel = await requirePanel(request);
  if (panel instanceof NextResponse) return panel;
  try {
    const body = (await request.json().catch(() => ({}))) as { id?: string; status?: string; note?: string; deleteMessage?: boolean };
    await resolveReport(panel, String(body.id ?? ""), body);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof ReportError) return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    console.error("Report update failed", error);
    return NextResponse.json({ ok: false, error: "That didn't work. Try again." }, { status: 500 });
  }
}
