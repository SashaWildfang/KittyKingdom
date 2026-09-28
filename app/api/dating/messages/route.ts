import { NextResponse } from "next/server";
import { cardsFor } from "../../../../lib/dating/discover";
import { conversations } from "../../../../lib/dating/messages";
import { requireDating } from "../../../../lib/dating/route-helpers";

export const dynamic = "force-dynamic";

/** Your conversations and message requests, with who they're with. */
export async function GET() {
  const me = await requireDating();
  if (me instanceof NextResponse) return me;
  const c = await conversations(me.discordId);
  const people = await cardsFor(me.discordId, Array.from(new Set([...c.inbox, ...c.requests].map((x) => x.other))));
  const byId = Object.fromEntries(people.map((p) => [p.id, { name: p.name, photo: p.photo, accent: p.accent }]));
  return NextResponse.json({ ok: true, ...c, people: byId }, { headers: { "Cache-Control": "no-store" } });
}
