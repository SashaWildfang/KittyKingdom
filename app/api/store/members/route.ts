import { NextResponse } from "next/server";
import { searchMembers } from "../../../../lib/discord-member";
import { requireStoreUser, storeErrorResponse } from "../../../../lib/store-auth";

export const dynamic = "force-dynamic";

/** Member search for choosing who to send a gift to. */
export async function GET(request: Request) {
  try {
    const user = await requireStoreUser(request);
    const query = (new URL(request.url).searchParams.get("q") ?? "").trim().slice(0, 32);
    if (query.length < 2) return NextResponse.json({ ok: true, members: [] });
    const members = (await searchMembers(query, 8)).filter((m) => !m.bot && m.id !== user.discordId);
    return NextResponse.json({ ok: true, members });
  } catch (error) {
    return storeErrorResponse(error);
  }
}
