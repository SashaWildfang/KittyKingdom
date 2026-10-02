import { NextResponse } from "next/server";
import { requirePanel } from "../../../../lib/admin";
import { GameError } from "../../../../lib/games/core";
import { liveList, spectate } from "../../../../lib/games/live";
import { siteGames } from "../../../../lib/games/stats";

export const dynamic = "force-dynamic";

/** Staff: live tables (including members who hide theirs) and server-wide gambling stats.
 *  ?table=bj:<id> watches one table; ?live=1 returns only the live list (for polling). */
export async function GET(request: Request) {
  const panel = await requirePanel(request);
  if (panel instanceof NextResponse) return panel;
  const params = new URL(request.url).searchParams;
  try {
    const table = params.get("table");
    if (table) return NextResponse.json({ ok: true, table: await spectate(table, panel.discordId, { staff: true }) }, { headers: { "Cache-Control": "no-store" } });
    const live = await liveList({ staff: true });
    if (params.get("live")) return NextResponse.json({ ok: true, live }, { headers: { "Cache-Control": "no-store" } });
    return NextResponse.json({ ok: true, live, stats: await siteGames() }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof GameError) return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    console.error("Admin games failed", error);
    return NextResponse.json({ ok: false, error: "Couldn't load games." }, { status: 500 });
  }
}
