import { liveList, spectate } from "../../../../lib/games/live";
import { gameRoute } from "../../../../lib/games/route";

export const dynamic = "force-dynamic";

/** The live lobby, or ?table=bj:<id> / sc:<id> / sl:<id> to watch one table (counts you as a viewer). */
export async function GET(request: Request) {
  const table = new URL(request.url).searchParams.get("table");
  return gameRoute(request, { key: "live", perMinute: 120 }, async (discordId) => (table ? { table: await spectate(table, discordId) } : { live: await liveList({ viewer: discordId }) }));
}
