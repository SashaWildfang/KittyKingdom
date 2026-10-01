import { NextResponse } from "next/server";
import { searchAppealAccounts } from "../../../../lib/appeals";
import { HOUR, MINUTE, allow, clientIp } from "../../../../lib/rate-limit";

export const dynamic = "force-dynamic";

/** Accounts matching a Discord name (names and avatars only; punishments need a Discord sign-in). */
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q") ?? "";
  const ip = await clientIp();
  if (!(await allow([{ key: `appeal-search:${ip}`, limit: 20, windowMs: MINUTE }, { key: `appeal-search-h:${ip}`, limit: 200, windowMs: HOUR }]))) {
    return NextResponse.json({ ok: false, error: "Slow down a little and try again in a minute." }, { status: 429 });
  }
  try {
    return NextResponse.json({ ok: true, accounts: await searchAppealAccounts(q.slice(0, 40)) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Appeal search failed", error);
    return NextResponse.json({ ok: false, error: "Search isn't working right now. Please try again." }, { status: 500 });
  }
}
