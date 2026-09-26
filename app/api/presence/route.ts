import { NextResponse } from "next/server";
import { getPresenceCollection } from "../../../lib/mongodb";

export const dynamic = "force-dynamic";

// A visitor counts as "on the website" if an open, visible tab checked in within this window
const ACTIVE_WINDOW_MS = 75_000;

/** Heartbeat from an open tab. Records the visitor and returns how many people are on the site. */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { id?: unknown };
    const id = typeof body.id === "string" && /^[A-Za-z0-9-]{16,64}$/.test(body.id) ? body.id : null;
    const presence = await getPresenceCollection();
    const now = new Date();

    if (id) {
      await presence.updateOne({ _id: id }, { $set: { lastSeen: now } }, { upsert: true });
    }
    const online = await presence.countDocuments({ lastSeen: { $gte: new Date(now.getTime() - ACTIVE_WINDOW_MS) } });
    return NextResponse.json({ online }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ online: null, reason: "presence-unavailable" });
  }
}
