import { NextResponse } from "next/server";
import { requirePanel } from "../../../../../lib/admin";
import { AppealError, appealAlertPreview } from "../../../../../lib/appeals";

export const dynamic = "force-dynamic";

/** Admins: the admin-general alert for an appeal (?id= or ?name=), exactly as it would be posted, without posting it. */
export async function GET(request: Request) {
  const panel = await requirePanel(request, "admin");
  if (panel instanceof NextResponse) return panel;
  const q = new URL(request.url).searchParams;
  try {
    return NextResponse.json({ ok: true, ...(await appealAlertPreview({ id: q.get("id"), name: q.get("name") })) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof AppealError) return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    console.error("Appeal alert preview failed", error);
    return NextResponse.json({ ok: false, error: "Couldn't build the preview." }, { status: 500 });
  }
}
