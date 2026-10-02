import { myAudience, setPrivate } from "../../../../lib/games/live";
import { gameRoute } from "../../../../lib/games/route";

export const dynamic = "force-dynamic";

/** How many people are watching my games, and whether I let people watch. */
export async function GET(request: Request) {
  return gameRoute(request, null, (discordId) => myAudience(discordId));
}

/** { private: boolean } hides (or shows) my games to spectators. */
export async function POST(request: Request) {
  return gameRoute(request, { key: "audience", perMinute: 20 }, (discordId, body) => setPrivate(discordId, body.private === true));
}
