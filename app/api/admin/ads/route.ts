import { NextResponse } from "next/server";
import { requirePanel } from "../../../../lib/admin";
import { adsOverview, saveAdSettings } from "../../../../lib/ads-admin";

export const dynamic = "force-dynamic";
const NO_STORE = { "Cache-Control": "no-store" };

/** Admins: Discord tip settings, stats and the latest tips posted. */
export async function GET(request: Request) {
  const panel = await requirePanel(request, "admin");
  if (panel instanceof NextResponse) return panel;
  try {
    return NextResponse.json({ ok: true, ...(await adsOverview()) }, { headers: NO_STORE });
  } catch (error) {
    console.error("Admin ads failed", error);
    return NextResponse.json({ ok: false, error: "Couldn't load the ad settings." }, { status: 500 });
  }
}

/** Admins: save settings (the bot picks them up within a minute). */
export async function POST(request: Request) {
  const panel = await requirePanel(request, "admin");
  if (panel instanceof NextResponse) return panel;
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    await saveAdSettings(body, panel.name);
    return NextResponse.json({ ok: true, ...(await adsOverview()) }, { headers: NO_STORE });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Couldn't save." }, { status: 400 });
  }
}
