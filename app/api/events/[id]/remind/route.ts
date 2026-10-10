import { NextResponse } from "next/server";
import { EventError, setReminder } from "../../../../../lib/events";
import { MINUTE, allow } from "../../../../../lib/rate-limit";
import { readJson, requireStoreUser } from "../../../../../lib/store-auth";
import { StoreError } from "../../../../../lib/store";

export const dynamic = "force-dynamic";

/** Signed-in members with Discord linked: {on: true|false} for a DM reminder before the event. */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireStoreUser(request);
    if (!(await allow([{ key: `event-remind:${user.discordId}`, limit: 30, windowMs: MINUTE }]))) {
      return NextResponse.json({ ok: false, error: "Slow down a little." }, { status: 429 });
    }
    const body = await readJson(request);
    return NextResponse.json({ ok: true, ...(await setReminder(params.id, user.discordId, body.on !== false)) });
  } catch (error) {
    if (error instanceof EventError || error instanceof StoreError) {
      const message = error instanceof StoreError ? error.message.replace("use the store", "get reminders") : error.message;
      return NextResponse.json({ ok: false, error: message }, { status: error.status });
    }
    console.error("Event reminder failed", error);
    return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500 });
  }
}
