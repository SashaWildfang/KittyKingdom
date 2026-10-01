import type { ObjectId } from "mongodb";
import { getCurrentUser } from "../../../../lib/auth";
import type { CosmeticSlot } from "../../../../lib/cosmetics";
import { StoreError } from "../../../../lib/store";
import { storeAction } from "../../../../lib/store-auth";
import { PerkError, designBadge, equipCosmetic, setCustomTitle } from "../../../../lib/store-perks";
import { HOUR, allow } from "../../../../lib/rate-limit";

export const dynamic = "force-dynamic";
export const maxDuration = 10;

/**
 * The Locker: { action: "equip", slot, itemId | null } | { action: "title", text, hue }
 *             | { action: "badge", badgeId, name, desc, icon, shape, hue }
 */
export async function POST(request: Request) {
  return storeAction(request, async (user, body) => {
    const account = await getCurrentUser();
    if (!account) throw new StoreError("Please log in to use the store.", 401);
    const siteUserId = account._id as ObjectId;
    try {
      if (body.action === "equip") {
        return await equipCosmetic(user.discordId, siteUserId, String(body.slot) as CosmeticSlot, body.itemId ? String(body.itemId) : null);
      }
      if (body.action === "title" || body.action === "badge") {
        if (!(await allow([{ key: `locker-text:${user.discordId}`, limit: 20, windowMs: HOUR }]))) throw new StoreError("You've changed that a lot. Try again in a bit.", 429);
        if (body.action === "title") return await setCustomTitle(user.discordId, siteUserId, body.text, body.hue);
        return await designBadge(user.discordId, String(body.badgeId ?? ""), body);
      }
      throw new StoreError("Unknown action.");
    } catch (error) {
      if (error instanceof PerkError) throw new StoreError(error.message, error.status);
      throw error;
    }
  });
}
