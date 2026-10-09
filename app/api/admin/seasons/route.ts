import { NextResponse } from "next/server";
import { requirePanel } from "../../../../lib/admin";
import { requireTwoFactorForAction } from "../../../../lib/admin-2fa";
import { people } from "../../../../lib/admin-people";
import { SeasonError, getSeasonAdmin, getSeasonConfig, saveSeasonConfig } from "../../../../lib/season-store";
import type { SeasonConfig } from "../../../../lib/seasons";

export const dynamic = "force-dynamic";

function fail(error: unknown) {
  if (error instanceof SeasonError) return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
  console.error("Seasons failed", error);
  return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500 });
}

/** Admins: season settings, uploaded art, what the bot applied, and the change history. */
export async function GET(request: Request) {
  const panel = await requirePanel(request, "admin");
  if (panel instanceof NextResponse) return panel;
  try {
    const data = await getSeasonAdmin();
    const who = await people([...data.history.map((h) => h.by), ...data.assets.map((a) => a.by)]);
    return NextResponse.json({ ok: true, ...data, people: who }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return fail(error);
  }
}

/** Admins: save settings. Switching the season itself changes Discord too, so that needs 2FA. */
export async function PATCH(request: Request) {
  const panel = await requirePanel(request, "admin");
  if (panel instanceof NextResponse) return panel;
  try {
    const body = (await request.json().catch(() => ({}))) as Partial<SeasonConfig>;
    const current = await getSeasonConfig(true);
    const switching = (body.mode !== undefined && body.mode !== current.mode) || (body.manual !== undefined && body.manual !== current.manual) || (body.timezone !== undefined && body.timezone !== current.timezone);
    if (switching) {
      const twoFactor = await requireTwoFactorForAction();
      if (twoFactor) return twoFactor;
    }
    return NextResponse.json({ ok: true, ...(await saveSeasonConfig(body, panel.discordId)) });
  } catch (error) {
    return fail(error);
  }
}
