import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../../../lib/admin";
import { RoleChangeError, changeMemberRole } from "../../../../../../lib/admin-roles";

export const dynamic = "force-dynamic";

/** { roleId, add } — admins only, logged to the audit log and the staff log channel. */
export async function POST(request: Request, { params }: { params: { userId: string } }) {
  const admin = await requireAdmin(request);
  if (admin instanceof NextResponse) return admin;
  if (!/^\d{15,21}$/.test(params.userId)) return NextResponse.json({ ok: false, error: "Invalid member." }, { status: 400 });
  const body = (await request.json().catch(() => ({}))) as { roleId?: string; add?: boolean };
  if (typeof body.roleId !== "string") return NextResponse.json({ ok: false, error: "Pick a role." }, { status: 400 });
  try {
    const result = await changeMemberRole(admin, params.userId, body.roleId, Boolean(body.add));
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof RoleChangeError) return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    console.error("Role change failed", error);
    return NextResponse.json({ ok: false, error: "Couldn't change that role." }, { status: 500 });
  }
}
