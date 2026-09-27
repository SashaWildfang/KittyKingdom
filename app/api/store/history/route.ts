import { NextResponse } from "next/server";
import { purchaseHistory } from "../../../../lib/purchase-history";
import { requireStoreUser, storeErrorResponse } from "../../../../lib/store-auth";

export const dynamic = "force-dynamic";

/** Your own purchase history (My Account → Inventory). */
export async function GET(request: Request) {
  try {
    const user = await requireStoreUser(request);
    const p = new URL(request.url).searchParams;
    const result = await purchaseHistory(user.discordId, { search: p.get("search") ?? undefined, kind: p.get("kind") ?? undefined, page: Number(p.get("page") ?? 1) });
    return NextResponse.json({ ok: true, ...result }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return storeErrorResponse(error);
  }
}
