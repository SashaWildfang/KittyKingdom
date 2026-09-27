import { NextResponse } from "next/server";
import { getCurrentUser } from "../../../../lib/auth";
import { memberStats } from "../../../../lib/member-stats";
import { requestTimeZone } from "../../../../lib/timezone";

export const dynamic = "force-dynamic";
export const maxDuration = 20;

/** The signed-in member's own stats (My Account → My stats). */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Sign in to see your stats." }, { status: 401 });
  if (!user.discordId) return NextResponse.json({ ok: false, error: "Link your Discord account to see your stats." }, { status: 403 });
  try {
    const stats = await memberStats(String(user.discordId), requestTimeZone(request));
    return NextResponse.json({ ok: true, stats }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Member stats failed", error);
    return NextResponse.json({ ok: false, error: "Your stats couldn't be loaded right now." }, { status: 500 });
  }
}
