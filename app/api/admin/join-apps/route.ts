import { NextResponse } from "next/server";
import { requirePanel } from "../../../../lib/admin";
import { listJoinApps } from "../../../../lib/join-apps";

export const dynamic = "force-dynamic";

/** Join applications for Admin -> Join Apps (staff and admins). */
export async function GET(request: Request) {
  const panel = await requirePanel(request);
  if (panel instanceof NextResponse) return panel;
  try {
    const p = new URL(request.url).searchParams;
    const result = await listJoinApps({ status: p.get("status") ?? "pending", search: p.get("search") ?? undefined, page: Number(p.get("page") ?? 1) });
    return NextResponse.json({ ok: true, ...result }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Join apps failed", error);
    return NextResponse.json({ ok: false, error: "Couldn't load join applications." }, { status: 500 });
  }
}
