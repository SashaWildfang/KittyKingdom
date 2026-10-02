import { buyTicket, scratchProgress, scratchStatus } from "../../../../lib/games/scratch";
import { gameRoute } from "../../../../lib/games/route";

export const dynamic = "force-dynamic";

/** Balance, today's scratch-offs used and whether the member is a Nitro booster. */
export async function GET(request: Request) {
  return gameRoute(request, null, (discordId) => scratchStatus(discordId));
}

/** { ticket } buys one ticket (the result comes back with it and is revealed by scratching) ·
 *  { action: "progress", revealed: [cells] } tells spectators which cells are open */
export async function POST(request: Request) {
  if (request.headers.get("x-kk-progress") === "1") return gameRoute(request, { key: "scratch-progress", perMinute: 120 }, (discordId, body) => scratchProgress(discordId, body.revealed));
  return gameRoute(request, { key: "scratch", perMinute: 30 }, (discordId, body) => buyTicket(discordId, body.ticket));
}
