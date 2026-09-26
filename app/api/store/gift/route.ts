import { giftItem } from "../../../../lib/store";
import { storeAction } from "../../../../lib/store-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 10;

export async function POST(request: Request) {
  return storeAction(request, (user, body) =>
    giftItem(user, String(body.recipientId ?? ""), String(body.itemId ?? ""), String(body.message ?? "")),
  );
}
