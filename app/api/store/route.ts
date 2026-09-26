import { NextResponse } from "next/server";
import { getStoreState } from "../../../lib/store";
import { requireStoreUser, storeErrorResponse } from "../../../lib/store-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 10;

export async function GET(request: Request) {
  try {
    const user = await requireStoreUser(request);
    return NextResponse.json({ ok: true, state: await getStoreState(user.discordId) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return storeErrorResponse(error);
  }
}
