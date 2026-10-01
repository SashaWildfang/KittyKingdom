import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../lib/admin";
import { listAppeals, type AppealStatus } from "../../../../lib/appeals";

export const dynamic = "force-dynamic";

const STATUSES = ["pending", "accepted", "denied", "all"];

/** Admins only: appeals by status (pending first, oldest first). */
export async function GET(request: Request) {
  const admin = await requireAdmin(request);
  if (admin instanceof NextResponse) return admin;
  const params = new URL(request.url).searchParams;
  const status = (STATUSES.includes(params.get("status") ?? "") ? params.get("status") : "pending") as AppealStatus | "all";
  const page = Math.max(1, Math.min(500, Number(params.get("page")) || 1));
  try {
    return NextResponse.json({ ok: true, ...(await listAppeals(status, page)) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Appeals list failed", error);
    return NextResponse.json({ ok: false, error: "Couldn't load appeals." }, { status: 500 });
  }
}
