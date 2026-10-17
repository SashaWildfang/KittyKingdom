import { GameError } from "../../../../lib/games/core";
import { gameRoute } from "../../../../lib/games/route";
import { wordleGiveUp, wordleGuess, wordleState } from "../../../../lib/games/wordle";

export const dynamic = "force-dynamic";

/** Today's Wordle (the same game as /wordle in Discord). */
export async function GET(request: Request) {
  return gameRoute(request, null, (discordId) => wordleState(discordId));
}

/** { action: "guess", word } · { action: "giveup" } */
export async function POST(request: Request) {
  return gameRoute(request, { key: "wordle", perMinute: 40 }, async (discordId, body) => {
    if (body.action === "guess") return wordleGuess(discordId, body.word);
    if (body.action === "giveup") return wordleGiveUp(discordId);
    throw new GameError("Unknown action.");
  });
}
