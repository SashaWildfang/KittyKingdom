import { NextResponse } from "next/server";
import { conversations } from "../../../../lib/dating/messages";
import { requireDating } from "../../../../lib/dating/route-helpers";
import { friendsOf, likesReceived, matchesOf, touchActive } from "../../../../lib/dating/social";

export const dynamic = "force-dynamic";

/** Small counts for the Dating tabs (polled). */
export async function GET() {
  const me = await requireDating();
  if (me instanceof NextResponse) return me;
  // Polled while they have Social open, so it keeps "Active …" honest
  await touchActive(me.discordId).catch(() => undefined);
  const [likes, matches, convs, friends] = await Promise.all([likesReceived(me.discordId, me.booster), matchesOf(me.discordId), conversations(me.discordId), friendsOf(me.discordId)]);
  return NextResponse.json(
    { ok: true, likes: likes.length, matches: matches.length, unread: convs.unread, requests: convs.requestCount, friendRequests: friends.filter((f) => f.status === "received").length },
    { headers: { "Cache-Control": "no-store" } },
  );
}
