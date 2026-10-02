import { gameRoute } from "../../../../lib/games/route";
import { slotsStatus, spinSlots } from "../../../../lib/games/slots";

export const dynamic = "force-dynamic";

/** Balance, the jackpot and how many spins at once the member can do. */
export async function GET(request: Request) {
  return gameRoute(request, null, (discordId) => slotsStatus(discordId));
}

/** { bet, spins } spins the machine (1–25 times; more than once is for Nitro boosters). */
export async function POST(request: Request) {
  return gameRoute(request, { key: "slots", perMinute: 40 }, (discordId, body) => spinSlots(discordId, body.bet, body.spins));
}
