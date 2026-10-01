import { NextResponse } from "next/server";
import { getStoreState } from "../../../../lib/store";
import { readJson, requireStoreUser, storeErrorResponse } from "../../../../lib/store-auth";
import { StoreError } from "../../../../lib/store";
import { acceptTrade, closeTrade, createTrade, myTrades, tradableInventory } from "../../../../lib/trades";
import { HOUR, MINUTE, allow } from "../../../../lib/rate-limit";

export const dynamic = "force-dynamic";
export const maxDuration = 20;

/** Your open offers (both ways), recent history, and what you can trade. */
export async function GET(request: Request) {
  try {
    const user = await requireStoreUser(request);
    const [list, mine] = await Promise.all([myTrades(user.discordId), tradableInventory(user.discordId)]);
    return NextResponse.json({ ok: true, ...list, mine }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return storeErrorResponse(error);
  }
}

/** { action: "create", to, giveItems, wantItems, giveLeaves, wantLeaves, message } | { action: "accept" | "decline" | "cancel", id } */
export async function POST(request: Request) {
  try {
    const user = await requireStoreUser(request);
    const body = await readJson(request);
    if (!(await allow([{ key: `trade:${user.discordId}`, limit: 20, windowMs: MINUTE }, { key: `trade-h:${user.discordId}`, limit: 120, windowMs: HOUR }]))) {
      throw new StoreError("Slow down a little and try again in a minute.", 429);
    }
    const action = String(body.action ?? "");
    const result =
      action === "create"
        ? await createTrade(user, body)
        : action === "accept"
          ? await acceptTrade(user, String(body.id ?? ""))
          : action === "decline" || action === "cancel"
            ? await closeTrade(user, String(body.id ?? ""), action)
            : null;
    if (!result) throw new StoreError("Unknown action.");
    const [list, mine, state] = await Promise.all([myTrades(user.discordId), tradableInventory(user.discordId), getStoreState(user.discordId)]);
    return NextResponse.json({ ok: true, ...result, trades: { ...list, mine }, state }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return storeErrorResponse(error);
  }
}
