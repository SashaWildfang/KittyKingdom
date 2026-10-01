import { checkout } from "../../../../lib/store";
import { storeAction } from "../../../../lib/store-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

/** { items: [{ itemId, amount }] } buys the whole cart, or nothing. */
export async function POST(request: Request) {
  return storeAction(request, (user, body) => checkout(user.discordId, body.items));
}
