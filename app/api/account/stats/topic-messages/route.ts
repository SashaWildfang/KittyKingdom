import { NextResponse } from "next/server";
import { getCurrentUser } from "../../../../../lib/auth";
import { allow, MINUTE } from "../../../../../lib/rate-limit";
import { topicMessage } from "../../../../../lib/topic-messages";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

/** One of the signed-in member's messages for a topic word (or topic), with the chat around it. */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Sign in to see your messages." }, { status: 401 });
  if (!user.discordId) return NextResponse.json({ ok: false, error: "Link your Discord account first." }, { status: 403 });
  const params = new URL(request.url).searchParams;
  const word = params.get("word")?.toLowerCase() ?? null;
  const topic = params.get("topic");
  const index = Math.max(0, Math.min(100, Number(params.get("i")) || 0));
  if (!(await allow([{ key: `topic-msgs:${user.discordId}`, limit: 60, windowMs: MINUTE }]))) {
    return NextResponse.json({ ok: false, error: "Slow down a little, then try again." }, { status: 429 });
  }
  try {
    const page = await topicMessage(String(user.discordId), word ? "word" : "topic", word ?? topic ?? "", index);
    if (!page) return NextResponse.json({ ok: false, error: "Unknown word or topic." }, { status: 400 });
    return NextResponse.json({ ok: true, ...page }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Topic messages failed", error);
    return NextResponse.json({ ok: false, error: "Discord didn't answer. Try again in a moment." }, { status: 502 });
  }
}
