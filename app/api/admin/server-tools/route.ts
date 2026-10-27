import { NextResponse } from "next/server";
import { requirePanel } from "../../../../lib/admin";
import { getGuildRoles } from "../../../../lib/discord-member";
import { PERMISSIONS, channelActivity, permissionCheck } from "../../../../lib/server-tools";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Admins:
 *   ?tool=perms&perm=send&member=<id> | &role=<id>   who can do what where (with why)
 *   ?tool=channels[&fresh=1]                          channel activity (dead channels)
 *   ?tool=meta                                        permissions and roles to pick from
 */
export async function GET(request: Request) {
  const panel = await requirePanel(request, "admin");
  if (panel instanceof NextResponse) return panel;
  const q = new URL(request.url).searchParams;
  try {
    if (q.get("tool") === "perms") {
      return NextResponse.json({ ok: true, ...(await permissionCheck({ memberId: q.get("member"), roleId: q.get("role"), perm: q.get("perm") ?? "view" })) }, { headers: { "Cache-Control": "no-store" } });
    }
    if (q.get("tool") === "channels") return NextResponse.json({ ok: true, rows: await channelActivity(q.get("fresh") === "1") }, { headers: { "Cache-Control": "no-store" } });
    const roles = await getGuildRoles().catch(() => new Map());
    return NextResponse.json({
      ok: true,
      perms: PERMISSIONS.map((p) => ({ key: p.key, label: p.label })),
      roles: Array.from(roles.values()).sort((a, b) => b.position - a.position).map((r) => ({ id: r.id, name: r.name })),
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "That didn't work." }, { status: 400 });
  }
}
