import { NextResponse } from "next/server";
import { getCurrentUser } from "../auth";
import { allow, MINUTE } from "../rate-limit";
import { hasOperatorKeys } from "../validate";
import { GameError } from "./core";

/** Runs a Games request for a signed-in member with a linked Discord account. */
export async function gameRoute(request: Request, limit: { key: string; perMinute: number } | null, run: (discordId: string, body: Record<string, unknown>) => Promise<unknown>) {
  try {
    // Reject cross-site requests (the session cookie is SameSite=Lax, this is a second layer)
    const origin = request.headers.get("origin");
    if (request.method !== "GET" && origin && origin !== new URL(request.url).origin) throw new GameError("Invalid request origin.", 403);
    const user = await getCurrentUser();
    if (!user) throw new GameError("Please log in to play.", 401);
    if (!user.discordId) throw new GameError("Link your Discord account to play.", 403);
    const discordId = String(user.discordId);
    if (limit && !(await allow([{ key: `games-${limit.key}:${discordId}`, limit: limit.perMinute, windowMs: MINUTE }]))) {
      throw new GameError("Slow down a little!", 429);
    }
    let body: Record<string, unknown> = {};
    if (request.method !== "GET") {
      const raw = (await request.json().catch(() => ({}))) as unknown;
      if (raw && typeof raw === "object" && !Array.isArray(raw) && !hasOperatorKeys(raw)) body = raw as Record<string, unknown>;
    }
    return NextResponse.json({ ok: true, ...((await run(discordId, body)) as object) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof GameError) return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    console.error("Game request failed", error);
    return NextResponse.json({ ok: false, error: "The tables are having trouble right now. Please try again." }, { status: 500 });
  }
}
