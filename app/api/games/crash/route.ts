import { GameError } from "../../../../lib/games/core";
import { cashOutCrash, crashState, startCrash } from "../../../../lib/games/crash";
import { gameRoute } from "../../../../lib/games/route";

export const dynamic = "force-dynamic";

/** Your current (or last) round, recent crash points and your balance. Polled while a round is flying. */
export async function GET(request: Request) {
  return gameRoute(request, null, (discordId) => crashState(discordId));
}

/** { action: "start", bet, auto? } · { action: "cashout" } */
export async function POST(request: Request) {
  return gameRoute(request, { key: "crash", perMinute: 90 }, async (discordId, body) => {
    if (body.action === "start") return startCrash(discordId, body.bet, body.auto);
    if (body.action === "cashout") return cashOutCrash(discordId);
    throw new GameError("Unknown action.");
  });
}
