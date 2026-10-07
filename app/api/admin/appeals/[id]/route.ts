import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../../lib/admin";
import { requireTwoFactorForAction } from "../../../../../lib/admin-2fa";
import { AppealError, decideAppeal } from "../../../../../lib/appeals";

export const dynamic = "force-dynamic";

/** Admins only (with 2FA): { decision: "accept" | "deny", response?, liftBan? }. */
export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const admin = await requireAdmin(request);
  if (admin instanceof NextResponse) return admin;
  const twoFactor = await requireTwoFactorForAction();
  if (twoFactor) return twoFactor;
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    return NextResponse.json({ ok: true, ...(await decideAppeal(params.id, admin, body)) });
  } catch (error) {
    if (error instanceof AppealError) return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    console.error("Appeal decision failed", error);
    return NextResponse.json({ ok: false, error: "That didn't save. Please try again." }, { status: 500 });
  }
}
