import { NextResponse } from "next/server";
import { cardsFor } from "../../../../lib/dating/discover";
import { requireDating } from "../../../../lib/dating/route-helpers";
import { viewersOf } from "../../../../lib/dating/views";
import { blockList, friendSkipIds, friendsOf, likedIds, likesReceived, matchesOf, passedIds } from "../../../../lib/dating/social";

export const dynamic = "force-dynamic";

/** ?list=likes|matches|friends|blocked : the people in one of your lists, as cards. */
export async function GET(request: Request) {
  const me = await requireDating();
  if (me instanceof NextResponse) return me;
  const list = new URL(request.url).searchParams.get("list");
  const id = me.discordId;
  if (list === "likes") {
    const [received, sent] = await Promise.all([likesReceived(id, me.booster), likedIds(id)]);
    const visible = received.filter((r) => !r.hidden);
    const cards = await cardsFor(id, visible.map((r) => r.id));
    return NextResponse.json({ ok: true, booster: me.booster, received: cards.map((c) => ({ ...c, at: visible.find((v) => v.id === c.id)?.at ?? null, super: visible.find((v) => v.id === c.id)?.super ?? false })), hidden: received.length - visible.length, sent: await cardsFor(id, Array.from(sent)) });
  }
  if (list === "passed" || list === "skipped") {
    const ids = Array.from(list === "passed" ? await passedIds(id) : await friendSkipIds(id)).reverse();
    return NextResponse.json({ ok: true, cards: await cardsFor(id, ids) });
  }
  if (list === "views") {
    const v = await viewersOf(id);
    const cards = await cardsFor(id, v.views.map((x) => x.id));
    return NextResponse.json({ ok: true, weekCount: v.weekCount, cards: cards.map((c) => ({ ...c, at: v.views.find((x) => x.id === c.id)?.at ?? null })) });
  }
  if (list === "matches") {
    const m = await matchesOf(id);
    const cards = await cardsFor(id, m.map((x) => x.id), { online: true });
    return NextResponse.json({ ok: true, cards: cards.map((c) => ({ ...c, at: m.find((x) => x.id === c.id)?.at ?? null })) });
  }
  if (list === "friends") {
    const f = await friendsOf(id);
    const cards = await cardsFor(id, f.map((x) => x.id), { online: true });
    return NextResponse.json({ ok: true, cards: cards.map((c) => ({ ...c, friend: f.find((x) => x.id === c.id)?.status ?? "none" })) });
  }
  if (list === "blocked") {
    const b = await blockList(id);
    return NextResponse.json({ ok: true, cards: await cardsFor(id, b.map((x) => x.id)), ids: b });
  }
  return NextResponse.json({ ok: false, error: "Unknown list." }, { status: 400 });
}
