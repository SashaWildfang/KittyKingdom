import { Long } from "mongodb";
import { NextResponse } from "next/server";
import { getBotUsersCollection } from "../../../../lib/mongodb";
import { MINUTE, hit } from "../../../../lib/rate-limit";
import { StoreError } from "../../../../lib/store";
import { requireStoreUser, storeErrorResponse } from "../../../../lib/store-auth";

export const dynamic = "force-dynamic";
const NO_STORE = { "Cache-Control": "no-store" };
const MODES = ["on", "quiet", "off"] as const;
type Mode = (typeof MODES)[number];
const idFilter = (discordId: string) => ({ discordId: { $in: [Long.fromString(discordId), discordId] } });

// Level-up messages in Discord (Economy events/leveling.py reads users.levelUpNotify):
// "on" = message with an @mention, "quiet" = message without the ping, "off" = no message (roles still update)

export async function GET(request: Request) {
  try {
    const user = await requireStoreUser(request);
    const doc = await (await getBotUsersCollection()).findOne(idFilter(user.discordId) as never, { projection: { levelUpNotify: 1 } });
    const mode = MODES.includes(doc?.levelUpNotify) ? (doc!.levelUpNotify as Mode) : "on";
    return NextResponse.json({ ok: true, mode }, { headers: NO_STORE });
  } catch (error) {
    return storeErrorResponse(error);
  }
}

export async function PUT(request: Request) {
  try {
    const user = await requireStoreUser(request);
    if (!(await hit(`levelups:${user.discordId}`, 20, MINUTE)).ok) throw new StoreError("You're changing this too fast. Try again in a minute.", 429);
    const body = (await request.json().catch(() => ({}))) as { mode?: unknown };
    if (!MODES.includes(body.mode as Mode)) throw new StoreError("Pick on, quiet or off.", 400);
    const users = await getBotUsersCollection();
    const res = await users.updateOne(idFilter(user.discordId) as never, { $set: { levelUpNotify: body.mode, updatedAt: new Date() } });
    if (!res.matchedCount) {
      await users.insertOne({ discordId: Long.fromString(user.discordId), levelUpNotify: body.mode, createdAt: new Date(), updatedAt: new Date() } as never);
    }
    return NextResponse.json({ ok: true, mode: body.mode }, { headers: NO_STORE });
  } catch (error) {
    return storeErrorResponse(error);
  }
}
