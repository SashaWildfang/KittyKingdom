import { NextResponse } from "next/server";
import { people } from "../../../../lib/admin-people";
import { datingCols, isSnowflake, toLong } from "../../../../lib/dating/db";
import { MAX_PARTNERS, partnersOf, removePartner, requestPartner, respondPartner } from "../../../../lib/dating/partners";
import { invalidatePool } from "../../../../lib/dating/pool";
import { getProfile } from "../../../../lib/dating/profiles";
import { requireDating, sameOrigin } from "../../../../lib/dating/route-helpers";
import { bigAvatar } from "../../../../lib/dating/text";
import { MINUTE, allow } from "../../../../lib/rate-limit";

export const dynamic = "force-dynamic";

/** Your partner links (confirmed, sent and waiting for you), with names and avatars. */
export async function GET() {
  const me = await requireDating();
  if (me instanceof NextResponse) return me;
  const links = await partnersOf(me.discordId);
  const ids = links.map((l) => l.id);
  const [who, withProfiles] = await Promise.all([
    people(ids).catch(() => ({}) as Awaited<ReturnType<typeof people>>),
    ids.length ? datingCols().then((c) => c.profiles.find({ _id: { $in: ids.map(toLong) } } as never, { projection: { _id: 1, name: 1 } }).toArray()) : Promise.resolve([]),
  ]);
  const names = new Map(withProfiles.map((p) => [String(p._id), String(p.name ?? "")]));
  return NextResponse.json(
    {
      ok: true,
      max: MAX_PARTNERS,
      partners: links.map((l) => ({
        ...l,
        name: names.get(l.id) || who[l.id]?.name || "Member",
        username: who[l.id]?.username ?? null,
        avatar: bigAvatar(who[l.id]?.avatar, 128),
        hasProfile: names.has(l.id),
      })),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

/** { action: "request" | "accept" | "decline" | "remove", target } */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ ok: false, error: "Invalid request origin." }, { status: 403 });
  const me = await requireDating();
  if (me instanceof NextResponse) return me;
  const body = (await request.json().catch(() => null)) as { action?: string; target?: string } | null;
  if (!body || !isSnowflake(body.target)) return NextResponse.json({ ok: false, error: "Pick a member." }, { status: 400 });
  if (!(await allow([{ key: `dating-partner:${me.discordId}`, limit: 20, windowMs: MINUTE }]))) return NextResponse.json({ ok: false, error: "Slow down a little." }, { status: 429 });
  const myName = String((await getProfile(me.discordId))?.name ?? me.name);
  let err: string | null = null;
  if (body.action === "request") err = await requestPartner(me.discordId, body.target, myName);
  else if (body.action === "accept" || body.action === "decline") err = await respondPartner(me.discordId, body.target, body.action === "accept", myName);
  else if (body.action === "remove") await removePartner(me.discordId, body.target);
  else return NextResponse.json({ ok: false, error: "Unknown action." }, { status: 400 });
  if (err) return NextResponse.json({ ok: false, error: err }, { status: 400 });
  invalidatePool();
  return NextResponse.json({ ok: true });
}
