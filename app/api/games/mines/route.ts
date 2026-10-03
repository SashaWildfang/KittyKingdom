import { GameError } from "../../../../lib/games/core";
import { cashOutMines, minesState, revealTile, startMines } from "../../../../lib/games/mines";
import { gameRoute } from "../../../../lib/games/route";

export const dynamic = "force-dynamic";

/** Your current (or last) board and balance. */
export async function GET(request: Request) {
  return gameRoute(request, null, (discordId) => minesState(discordId));
}

/** { action: "start", bet, mines } · { action: "reveal", tile } · { action: "cashout" } */
export async function POST(request: Request) {
  return gameRoute(request, { key: "mines", perMinute: 150 }, async (discordId, body) => {
    if (body.action === "start") return startMines(discordId, body.bet, body.mines);
    if (body.action === "reveal") return revealTile(discordId, body.tile);
    if (body.action === "cashout") return cashOutMines(discordId);
    throw new GameError("Unknown action.");
  });
}
