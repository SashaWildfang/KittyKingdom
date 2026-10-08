import { NextResponse } from "next/server";
import { MINUTE, hit } from "../../../../lib/rate-limit";
import { StoreError } from "../../../../lib/store";
import { requireStoreUser, storeErrorResponse } from "../../../../lib/store-auth";
import { SupporterError, saveCustomRole, saveTitle, supporterStatus } from "../../../../lib/supporter";

export const dynamic = "force-dynamic";
export const maxDuration = 10;
const NO_STORE = { "Cache-Control": "no-store" };

function errorResponse(error: unknown) {
  if (error instanceof SupporterError) return NextResponse.json({ ok: false, error: error.message }, { status: error.status, headers: NO_STORE });
  return storeErrorResponse(error);
}

/** Your Patreon / Nitro perks and custom role (My Account → Supporter perks). */
export async function GET(request: Request) {
  try {
    const user = await requireStoreUser(request);
    if (!(await hit(`supporter:${user.discordId}`, 60, MINUTE)).ok) throw new StoreError("Slow down a little and try again in a minute.", 429);
    return NextResponse.json({ ok: true, status: await supporterStatus(user.discordId) }, { headers: NO_STORE });
  } catch (error) {
    return errorResponse(error);
  }
}

/** Save your title (King/Queen…) or custom role design (Prince/Princess and up). The bot applies it within seconds. */
export async function POST(request: Request) {
  try {
    const user = await requireStoreUser(request);
    if (!(await hit(`supporter-save:${user.discordId}`, 10, MINUTE)).ok) throw new StoreError("You're saving too fast. Try again in a minute.", 429);
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const status = body.action === "title" ? await saveTitle(user.discordId, body.variant) : await saveCustomRole(user.discordId, body);
    return NextResponse.json({ ok: true, status }, { headers: NO_STORE });
  } catch (error) {
    return errorResponse(error);
  }
}
