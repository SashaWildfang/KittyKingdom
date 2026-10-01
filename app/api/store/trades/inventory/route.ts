import { NextResponse } from "next/server";
import { requireStoreUser, storeErrorResponse } from "../../../../../lib/store-auth";
import { StoreError } from "../../../../../lib/store";
import { tradableInventory } from "../../../../../lib/trades";

export const dynamic = "force-dynamic";

/** What another member could trade (for building an offer). */
export async function GET(request: Request) {
  try {
    const user = await requireStoreUser(request);
    const member = new URL(request.url).searchParams.get("member") ?? "";
    if (!/^\d{15,21}$/.test(member) || member === user.discordId) throw new StoreError("Pick someone else to trade with.");
    return NextResponse.json({ ok: true, items: await tradableInventory(member) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return storeErrorResponse(error);
  }
}
