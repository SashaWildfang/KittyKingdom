import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../../lib/admin";
import { requireTwoFactorForAction } from "../../../../../lib/admin-2fa";
import { BulkRoleError, bulkRoleBatch, bulkRoleSummary } from "../../../../../lib/members-manager";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Bulk role changes: { roleId, add, ids: [≤25] } changes one batch; { roleId, add, finish: true, done, failed }
 * posts the summary to the bot logs. Admins with two-factor on.
 */
export async function POST(request: Request) {
  const admin = await requireAdmin(request);
  if (admin instanceof NextResponse) return admin;
  const twoFactor = await requireTwoFactorForAction();
  if (twoFactor) return twoFactor;
  const body = (await request.json().catch(() => null)) as { roleId?: unknown; add?: unknown; ids?: unknown; finish?: unknown; done?: unknown; failed?: unknown } | null;
  const roleId = String(body?.roleId ?? "");
  if (!/^\d{15,21}$/.test(roleId)) return NextResponse.json({ ok: false, error: "Pick a role." }, { status: 400 });
  const add = body?.add === true;
  try {
    if (body?.finish === true) {
      await bulkRoleSummary(admin, roleId, add, Math.max(0, Number(body.done) || 0), Math.max(0, Number(body.failed) || 0));
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ ok: true, ...(await bulkRoleBatch(admin, roleId, add, body?.ids)) });
  } catch (error) {
    if (error instanceof BulkRoleError) return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    console.error("Bulk role change failed", error);
    return NextResponse.json({ ok: false, error: "That didn't work. Try again." }, { status: 500 });
  }
}
