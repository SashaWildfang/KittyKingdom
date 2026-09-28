import { NextResponse } from "next/server";
import { getCurrentUser, getRealUser } from "../../../lib/auth";
import { getPresenceCollection } from "../../../lib/mongodb";

export const dynamic = "force-dynamic";

// A visitor counts as "on the website" if an open, visible tab checked in within this window
const ACTIVE_WINDOW_MS = 75_000;

/** Heartbeat from an open tab. Records the visitor and returns how many people are on the site. */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { id?: unknown; path?: unknown; title?: unknown };
    const path = typeof body.path === "string" && body.path.startsWith("/") ? body.path.slice(0, 200) : null;
    const title = typeof body.title === "string" ? body.title.slice(0, 120) : null;
    const id = typeof body.id === "string" && /^[A-Za-z0-9-]{16,64}$/.test(body.id) ? body.id : null;
    const presence = await getPresenceCollection();
    const now = new Date();

    // Signed-in visitors: keeps their device's "last active" fresh for the admin online list
    await getCurrentUser().catch(() => null);
    // The real account (not a "view as" target), so staff see who is actually where
    const real = await getRealUser().catch(() => null);

    if (id) {
      const set: Record<string, unknown> = { lastSeen: now, userId: real?._id ? String(real._id) : null };
      if (path) {
        set.path = path;
        set.title = title;
      }
      const prev = path ? await presence.findOne({ _id: id }, { projection: { path: 1 } }) : null;
      if (path && (prev as { path?: string } | null)?.path !== path) set.pathSince = now;
      await presence.updateOne({ _id: id }, { $set: set }, { upsert: true });
    }
    const online = await presence.countDocuments({ lastSeen: { $gte: new Date(now.getTime() - ACTIVE_WINDOW_MS) } });
    return NextResponse.json({ online }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ online: null, reason: "presence-unavailable" });
  }
}
