import { NextResponse } from "next/server";
import { discoverQueue, friendQueue } from "../../../../lib/dating/discover";
import { requireDating } from "../../../../lib/dating/route-helpers";
import { likesLeftToday } from "../../../../lib/dating/social";
import { getSettings } from "../../../../lib/dating/settings";

export const dynamic = "force-dynamic";

/** Your best matches you haven't answered yet. ?mode=friends: people to be friends with instead. */
export async function GET(request: Request) {
  const me = await requireDating();
  if (me instanceof NextResponse) return me;
  // No ?mode= means the member's default from Settings
  const asked = new URL(request.url).searchParams.get("mode");
  const friends = asked ? asked === "friends" : (await getSettings(me.discordId)).discoverMode === "friends";
  const [q, left] = await Promise.all([friends ? friendQueue(me.discordId) : discoverQueue(me.discordId), likesLeftToday(me.discordId, me.booster)]);
  return NextResponse.json({ ok: true, mode: friends ? "friends" : "dating", ...q, likesLeft: left, booster: me.booster }, { headers: { "Cache-Control": "no-store" } });
}
