import { NextResponse } from "next/server";
import { discoverQueue } from "../../../../lib/dating/discover";
import { requireDating } from "../../../../lib/dating/route-helpers";
import { likesLeftToday } from "../../../../lib/dating/social";

export const dynamic = "force-dynamic";

/** Your best matches you haven't answered yet. */
export async function GET() {
  const me = await requireDating();
  if (me instanceof NextResponse) return me;
  const [q, left] = await Promise.all([discoverQueue(me.discordId), likesLeftToday(me.discordId, me.booster)]);
  return NextResponse.json({ ok: true, ...q, likesLeft: left, booster: me.booster }, { headers: { "Cache-Control": "no-store" } });
}
