import { NextResponse } from "next/server";
import { GiveawayError, toggleEntry } from "../../../../../lib/giveaways";
import { MINUTE, allow } from "../../../../../lib/rate-limit";
import { StoreError } from "../../../../../lib/store";
import { readJson, requireStoreUser } from "../../../../../lib/store-auth";

export const dynamic = "force-dynamic";

/** Members with Discord linked: {enter: true|false} for a running giveaway. */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireStoreUser(request);
    if (!(await allow([{ key: `giveaway-enter:${user.discordId}`, limit: 20, windowMs: MINUTE }]))) {
      return NextResponse.json({ ok: false, error: "Slow down a little." }, { status: 429 });
    }
    const body = await readJson(request);
    return NextResponse.json({ ok: true, ...(await toggleEntry(params.id, user.discordId, body.enter !== false)) });
  } catch (error) {
    if (error instanceof GiveawayError || error instanceof StoreError) {
      const message = error instanceof StoreError ? error.message.replace("use the store", "enter giveaways") : error.message;
      return NextResponse.json({ ok: false, error: message }, { status: error.status });
    }
    console.error("Giveaway entry failed", error);
    return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500 });
  }
}
