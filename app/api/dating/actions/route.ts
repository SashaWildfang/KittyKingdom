import { NextResponse } from "next/server";
import { isSnowflake } from "../../../../lib/dating/db";
import { invalidatePool } from "../../../../lib/dating/pool";
import { getProfile } from "../../../../lib/dating/profiles";
import { requireDating, sameOrigin } from "../../../../lib/dating/route-helpers";
import { block, friendAction, like, setFriendSkip, setPass, unblock, unlike } from "../../../../lib/dating/social";
import { MINUTE, allow } from "../../../../lib/rate-limit";

export const dynamic = "force-dynamic";

const ACTIONS = ["like", "unlike", "pass", "unpass", "friend", "accept", "decline", "unfriend", "block", "unblock", "skip", "unskip"] as const;

/** { action, target }: likes, passes, friends and blocks. */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ ok: false, error: "Invalid request origin." }, { status: 403 });
  const me = await requireDating();
  if (me instanceof NextResponse) return me;
  const body = (await request.json().catch(() => null)) as { action?: string; target?: string } | null;
  const action = ACTIONS.find((a) => a === body?.action);
  const target = body?.target;
  if (!action || !isSnowflake(target)) return NextResponse.json({ ok: false, error: "Invalid action." }, { status: 400 });
  if (!(await allow([{ key: `dating-action:${me.discordId}`, limit: 60, windowMs: MINUTE }]))) return NextResponse.json({ ok: false, error: "Slow down a little." }, { status: 429 });
  const mine = await getProfile(me.discordId);
  const myName = String(mine?.name ?? me.name);
  if ((action === "like" || action === "pass") && !mine) return NextResponse.json({ ok: false, error: "Create your dating profile first." }, { status: 400 });
  switch (action) {
    case "like": {
      const r = await like(me.discordId, target, me.booster, myName);
      if (r.status === "blocked") return NextResponse.json({ ok: false, error: "You can't like this profile." }, { status: 400 });
      invalidatePool();
      return NextResponse.json({ ok: true, mutual: r.mutual, left: r.left });
    }
    case "unlike":
      await unlike(me.discordId, target);
      return NextResponse.json({ ok: true });
    case "pass":
    case "unpass":
      await setPass(me.discordId, target, action === "pass");
      return NextResponse.json({ ok: true });
    case "skip":
    case "unskip":
      await setFriendSkip(me.discordId, target, action === "skip");
      return NextResponse.json({ ok: true });
    case "block":
      await block(me.discordId, target);
      return NextResponse.json({ ok: true });
    case "unblock":
      await unblock(me.discordId, target);
      return NextResponse.json({ ok: true });
    default: {
      const map = { friend: "request", accept: "accept", decline: "decline", unfriend: "remove" } as const;
      const res = await friendAction(me.discordId, target, map[action], myName);
      if (!["none", "friends", "sent", "received"].includes(res)) return NextResponse.json({ ok: false, error: res }, { status: 400 });
      return NextResponse.json({ ok: true, friend: res });
    }
  }
}
