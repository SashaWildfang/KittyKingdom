import { NextResponse } from "next/server";
import { getAdminUser, getPanelUser, requirePanel } from "../../../lib/admin";
import { getMaintenance, setMaintenance } from "../../../lib/maintenance";
import { audit } from "../../../lib/news-admin";

export const dynamic = "force-dynamic";

/** Anyone: is the site in maintenance, and does it apply to you? (Staff and admins are let through.) */
export async function GET() {
  const m = await getMaintenance();
  const exempt = m.on ? Boolean(await getPanelUser().catch(() => null)) : false;
  return NextResponse.json({ ok: true, on: m.on, message: m.message, until: m.until, exempt, admin: m.on || exempt ? Boolean(await getAdminUser().catch(() => null)) : false }, { headers: { "Cache-Control": "no-store" } });
}

/** Admins: {on, message, until} */
export async function POST(request: Request) {
  const panel = await requirePanel(request, "admin");
  if (panel instanceof NextResponse) return panel;
  try {
    const body = (await request.json().catch(() => ({}))) as { on?: boolean; message?: string; until?: string | null };
    const m = await setMaintenance(panel, body);
    await audit(m.on ? "maintenance-on" : "maintenance-off", { message: m.message, until: m.until }, panel).catch(() => undefined);
    return NextResponse.json({ ok: true, ...m });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Couldn't save that." }, { status: 400 });
  }
}
