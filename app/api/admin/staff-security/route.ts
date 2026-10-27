import { NextResponse } from "next/server";
import { requirePanel } from "../../../../lib/admin";
import { signOutEverywhere, staffSecurity } from "../../../../lib/staff-security";

export const dynamic = "force-dynamic";

/** Admins: staff accounts, two-factor and signed-in devices. */
export async function GET(request: Request) {
  const panel = await requirePanel(request, "admin");
  if (panel instanceof NextResponse) return panel;
  return NextResponse.json({ ok: true, staff: await staffSecurity() }, { headers: { "Cache-Control": "no-store" } });
}

/** Admins: {discordId} signs that staff member out of every device. */
export async function POST(request: Request) {
  const panel = await requirePanel(request, "admin");
  if (panel instanceof NextResponse) return panel;
  const body = (await request.json().catch(() => ({}))) as { discordId?: string };
  if (!/^\d{15,21}$/.test(String(body.discordId ?? ""))) return NextResponse.json({ ok: false, error: "Pick a staff member." }, { status: 400 });
  try {
    return NextResponse.json({ ok: true, signedOut: await signOutEverywhere(panel, String(body.discordId)) });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Couldn't do that." }, { status: 400 });
  }
}
