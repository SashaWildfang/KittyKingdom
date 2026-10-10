import { NextResponse } from "next/server";
import { getCurrentUser } from "../../../lib/auth";
import { publicGiveaways } from "../../../lib/giveaways";

export const dynamic = "force-dynamic";

/** Public: running and upcoming giveaways, recent winners, and which ones you've entered. */
export async function GET() {
  try {
    const user = await getCurrentUser().catch(() => null);
    const data = await publicGiveaways(user?.discordId ? String(user.discordId) : null);
    return NextResponse.json({ ok: true, ...data }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Giveaways failed", error);
    return NextResponse.json({ ok: false, error: "Couldn't load giveaways." }, { status: 500 });
  }
}
