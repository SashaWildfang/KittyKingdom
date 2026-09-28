import { NextResponse } from "next/server";
import { requireDating } from "../../../../../lib/dating/route-helpers";
import { searchMembers } from "../../../../../lib/discord-member";
import { getCurrentBans } from "../../../../../lib/moderation";
import { MINUTE, allow } from "../../../../../lib/rate-limit";

export const dynamic = "force-dynamic";

/** ?q= : server members to link as a partner (they don't need a website account yet). */
export async function GET(request: Request) {
  const me = await requireDating();
  if (me instanceof NextResponse) return me;
  const q = (new URL(request.url).searchParams.get("q") ?? "").trim().slice(0, 32);
  if (q.length < 2) return NextResponse.json({ ok: true, results: [] });
  if (!(await allow([{ key: `dating-partner-search:${me.discordId}`, limit: 40, windowMs: MINUTE }]))) return NextResponse.json({ ok: false, error: "Slow down a little." }, { status: 429 });
  const [found, bans] = await Promise.all([searchMembers(q, 8).catch(() => []), getCurrentBans().catch(() => null)]);
  const results = found.filter((m) => !m.bot && m.id !== me.discordId && !bans?.has(m.id)).map((m) => ({ id: m.id, name: m.displayName, username: m.username, avatar: m.avatar }));
  return NextResponse.json({ ok: true, results });
}
