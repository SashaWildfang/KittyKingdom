import { NextResponse } from "next/server";
import { getCurrentUser } from "../../../../lib/auth";
import { publicPolls } from "../../../../lib/event-polls";

export const dynamic = "force-dynamic";

/** Running and recent event polls, with the viewer's own vote. */
export async function GET() {
  try {
    const user = await getCurrentUser().catch(() => null);
    const polls = await publicPolls(user?.discordId ? String(user.discordId) : null);
    return NextResponse.json({ ok: true, polls }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Event polls failed", error);
    return NextResponse.json({ ok: false, error: "Couldn't load the polls." }, { status: 500 });
  }
}
