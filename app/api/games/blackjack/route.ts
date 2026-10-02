import { blackjackState, playMove, startHand } from "../../../../lib/games/blackjack";
import { gameRoute } from "../../../../lib/games/route";

export const dynamic = "force-dynamic";

/** The member's table (the dealer's hole card stays hidden until the hand ends). */
export async function GET(request: Request) {
  return gameRoute(request, null, (discordId) => blackjackState(discordId));
}

/** { action: "deal", bet } · { action: "hit" | "stand" | "double" | "split" } */
export async function POST(request: Request) {
  return gameRoute(request, { key: "bj", perMinute: 90 }, (discordId, body) => (body.action === "deal" ? startHand(discordId, body.bet) : playMove(discordId, body.action)));
}
