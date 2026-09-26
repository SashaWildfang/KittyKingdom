import { activateItem } from "../../../../lib/store";
import { storeAction } from "../../../../lib/store-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 10;

export async function POST(request: Request) {
  return storeAction(request, (user, body) => activateItem(user.discordId, String(body.itemId ?? "")));
}
