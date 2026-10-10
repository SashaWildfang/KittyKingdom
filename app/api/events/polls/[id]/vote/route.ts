import { NextResponse } from "next/server";
import { castVote } from "../../../../../../lib/event-polls";
import { EventError } from "../../../../../../lib/events";
import { MINUTE, allow } from "../../../../../../lib/rate-limit";
import { readJson, requireStoreUser } from "../../../../../../lib/store-auth";
import { StoreError } from "../../../../../../lib/store";

export const dynamic = "force-dynamic";

/** Signed-in members with Discord linked: {answers: [index…]} votes on a poll ([] takes the vote back). */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireStoreUser(request);
    if (!(await allow([{ key: `event-poll-vote:${user.discordId}`, limit: 30, windowMs: MINUTE }]))) {
      return NextResponse.json({ ok: false, error: "Slow down a little." }, { status: 429 });
    }
    const body = await readJson(request);
    const { poll, mine } = await castVote(params.id, user.discordId, body.answers);
    return NextResponse.json({ ok: true, answers: poll.answers, totalVotes: poll.totalVotes, mine });
  } catch (error) {
    if (error instanceof EventError || error instanceof StoreError) {
      const message = error instanceof StoreError ? error.message.replace("use the store", "vote") : error.message;
      return NextResponse.json({ ok: false, error: message }, { status: error.status });
    }
    console.error("Event poll vote failed", error);
    return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500 });
  }
}
