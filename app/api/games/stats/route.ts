import { gameRoute } from "../../../../lib/games/route";
import { personalGames } from "../../../../lib/games/stats";

export const dynamic = "force-dynamic";

/** My gambling stats across every game (Discord and the website). */
export async function GET(request: Request) {
  return gameRoute(request, { key: "stats", perMinute: 30 }, async (discordId) => ({ stats: await personalGames(discordId) }));
}
