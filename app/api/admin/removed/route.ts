import { NextResponse } from "next/server";
import { requirePanel } from "../../../../lib/admin";
import { listArchives } from "../../../../lib/removed-messages";

export const dynamic = "force-dynamic";

/** Admins: archives of removed messages (?search=&reason=&page=). */
export async function GET(request: Request) {
  const panel = await requirePanel(request, "admin");
  if (panel instanceof NextResponse) return panel;
  const u = new URL(request.url);
  try {
    const data = await listArchives({ search: u.searchParams.get("search") ?? "", reason: u.searchParams.get("reason") ?? "", page: Number(u.searchParams.get("page") ?? 1) });
    return NextResponse.json({ ok: true, ...data }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Removed messages list failed", error);
    return NextResponse.json({ ok: false, error: "Couldn't load the archives." }, { status: 500 });
  }
}
