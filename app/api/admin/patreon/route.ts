import { NextResponse } from "next/server";
import { requirePanel } from "../../../../lib/admin";
import { PatreonAdminError, grantTier, patreonOverview, removeCustomRole, requestSync, revokeTier } from "../../../../lib/patreon-admin";

export const dynamic = "force-dynamic";
const NO_STORE = { "Cache-Control": "no-store" };

function fail(error: unknown) {
  if (error instanceof PatreonAdminError) return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
  console.error("Admin Patreon failed", error);
  return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500 });
}

/** Admins: Patreon patrons, sync status and manual grants. */
export async function GET(request: Request) {
  const panel = await requirePanel(request, "admin");
  if (panel instanceof NextResponse) return panel;
  try {
    return NextResponse.json({ ok: true, ...(await patreonOverview()) }, { headers: NO_STORE });
  } catch (error) {
    return fail(error);
  }
}

/** Admins: { action: "sync" | "grant" | "revoke" | "remove-role", discordId?, tier? } */
export async function POST(request: Request) {
  const panel = await requirePanel(request, "admin");
  if (panel instanceof NextResponse) return panel;
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const id = String(body.discordId ?? "").trim();
    if (body.action === "sync") await requestSync();
    else if (body.action === "grant") await grantTier(id, String(body.tier ?? ""), panel.discordId);
    else if (body.action === "revoke") await revokeTier(id);
    else if (body.action === "remove-role") await removeCustomRole(id);
    else throw new PatreonAdminError("Unknown action.");
    return NextResponse.json({ ok: true, ...(await patreonOverview()) }, { headers: NO_STORE });
  } catch (error) {
    return fail(error);
  }
}
