import { NextResponse } from "next/server";
import { getDiscordInviteSummary } from "../../../../lib/discord";

export const dynamic = "force-dynamic";

export async function GET() {
  const summary = await getDiscordInviteSummary();
  return NextResponse.json(summary);
}
