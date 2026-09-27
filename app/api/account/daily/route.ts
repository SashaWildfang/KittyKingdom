import { NextResponse } from "next/server";
import { claimDaily, getDailyStatus } from "../../../../lib/daily";
import { MINUTE, hit } from "../../../../lib/rate-limit";
import { StoreError } from "../../../../lib/store";
import { requireStoreUser, storeErrorResponse } from "../../../../lib/store-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 10;

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(request: Request) {
  try {
    const user = await requireStoreUser(request);
    return NextResponse.json({ ok: true, status: await getDailyStatus(user.discordId) }, { headers: NO_STORE });
  } catch (error) {
    return storeErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireStoreUser(request);
    if (!(await hit(`daily:${user.discordId}`, 10, MINUTE)).ok) throw new StoreError("Slow down a little and try again in a minute.", 429);
    const result = await claimDaily(user.discordId);
    return NextResponse.json({ ok: true, ...result }, { headers: NO_STORE });
  } catch (error) {
    return storeErrorResponse(error);
  }
}
