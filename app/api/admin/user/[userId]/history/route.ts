import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../../../lib/admin";
import { purchaseHistory } from "../../../../../../lib/purchase-history";

export const dynamic = "force-dynamic";

/** A member's purchase history, for their profile (admins only, like their inventory). */
export async function GET(request: Request, props: { params: Promise<{ userId: string }> }) {
  const params = await props.params;
  const admin = await requireAdmin(request);
  if (admin instanceof NextResponse) return admin;
  if (!/^\d{15,21}$/.test(params.userId)) return NextResponse.json({ ok: false, error: "Unknown member." }, { status: 404 });
  try {
    const p = new URL(request.url).searchParams;
    const result = await purchaseHistory(params.userId, { search: p.get("search") ?? undefined, kind: p.get("kind") ?? undefined, page: Number(p.get("page") ?? 1) });
    return NextResponse.json({ ok: true, ...result }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Purchase history failed", error);
    return NextResponse.json({ ok: false, error: "Couldn't load their purchase history." }, { status: 500 });
  }
}
