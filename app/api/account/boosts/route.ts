import { NextResponse } from "next/server";
import { boostStatus } from "../../../../lib/boosts";
import { MINUTE, hit } from "../../../../lib/rate-limit";
import { StoreError } from "../../../../lib/store";
import { requireStoreUser, storeErrorResponse } from "../../../../lib/store-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 10;

/** Your running boosters, earning multipliers and Featured odds (My Account → Boosters & odds). */
export async function GET(request: Request) {
  try {
    const user = await requireStoreUser(request);
    if (!(await hit(`boosts:${user.discordId}`, 40, MINUTE)).ok) throw new StoreError("Slow down a little and try again in a minute.", 429);
    return NextResponse.json({ ok: true, status: await boostStatus(user.discordId) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return storeErrorResponse(error);
  }
}
