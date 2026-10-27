import { NextResponse } from "next/server";
import { requirePanel } from "../../../../lib/admin";
import { people } from "../../../../lib/admin-people";
import { listWatch, noteCounts, watchActivity } from "../../../../lib/staff-notes";

export const dynamic = "force-dynamic";

/** Everyone on the watchlist with what they've done in the last 14 days. */
export async function GET(request: Request) {
  const panel = await requirePanel(request);
  if (panel instanceof NextResponse) return panel;
  try {
    const list = await listWatch();
    const ids = list.map((w) => w.discordId);
    const [activity, notes, who] = await Promise.all([watchActivity(ids, new Date(Date.now() - 14 * 86_400_000)), noteCounts(ids), people([...ids, ...list.map((w) => w.by)])]);
    // 18+ tickets stay admin-only
    const visible = panel.level === "admin" ? activity : activity.filter((a) => !(a.kind === "ticket" && /nsfw/i.test(a.label)));
    return NextResponse.json({ ok: true, list, activity: visible, notes, people: who }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Watchlist failed", error);
    return NextResponse.json({ ok: false, error: "Couldn't load the watchlist." }, { status: 500 });
  }
}
