import { NextResponse } from "next/server";
import { requirePanel } from "../../../../../lib/admin";
import { markLiveRead } from "../../../../../lib/live-chat";
import { readJson } from "../../../../../lib/store-auth";

export const dynamic = "force-dynamic";

/** { channels: { channelId: newestReadTimestamp } } or { all: true } */
export async function POST(request: Request) {
  const panel = await requirePanel(request);
  if (panel instanceof NextResponse) return panel;
  const body = await readJson(request);
  const channels = body.channels && typeof body.channels === "object" && !Array.isArray(body.channels) ? (body.channels as Record<string, unknown>) : undefined;
  await markLiveRead(panel.discordId, { channels, all: body.all === true });
  return NextResponse.json({ ok: true });
}
