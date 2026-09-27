import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../lib/admin";
import { assignableRoles } from "../../../../lib/admin-roles";

export const dynamic = "force-dynamic";

/** Roles the signed-in admin can give or take away. */
export async function GET(request: Request) {
  const admin = await requireAdmin(request);
  if (admin instanceof NextResponse) return admin;
  const roles = await assignableRoles(admin.discordId);
  return NextResponse.json({ ok: true, roles: roles.map((r) => ({ id: r.id, name: r.name, colors: r.colors })) });
}
