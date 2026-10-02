import { GameError } from "../../../../lib/games/core";
import { clearBets, placeBet, rouletteState } from "../../../../lib/games/roulette";
import { gameRoute } from "../../../../lib/games/route";

export const dynamic = "force-dynamic";

/** The live table: the round clock, everyone's chips, the number and the last round's winners and losers. */
export async function GET(request: Request) {
  return gameRoute(request, { key: "roulette-view", perMinute: 150 }, (discordId) => rouletteState(discordId));
}

/** { action: "bet", spot, amount } puts chips down · { action: "clear" } takes yours back (while bets are open). */
export async function POST(request: Request) {
  return gameRoute(request, { key: "roulette", perMinute: 90 }, async (discordId, body) => {
    if (body.action === "bet") return placeBet(discordId, body.spot, body.amount);
    if (body.action === "clear") return clearBets(discordId);
    throw new GameError("Unknown action.");
  });
}
