// The website's own store items (cosmetics, perks, Social boosts, seasonal and limited drops).
// They live in the same catalog as the bot's items (zeo_bot.store_inventory), so the bot's /store
// lists them too. The website keeps them up to date: names, prices and on-sale windows come from
// here; stock for limited items is only set the first time (sales count it down).
//
// rotation_type: "permanent" (always), "seasonal" (on sale between available_from and
// available_until), "limited" (numbered stock, same window). The bot only rotates daily/weekly.

import type { Document } from "mongodb";
import { getBotCollection } from "./mongodb";
import { SITE_ITEMS } from "./store-items";

export { SITE_ITEMS };

export const siteItemById = new Map(SITE_ITEMS.map((i) => [i.item_id, i]));

/** Whether an item's on-sale window (if it has one) is open right now. */
export function inWindow(item: { available_from?: unknown; available_until?: unknown }, now = Date.now()) {
  const from = item.available_from ? Date.parse(String(item.available_from)) : NaN;
  const until = item.available_until ? Date.parse(String(item.available_until)) : NaN;
  if (!Number.isNaN(from) && now < from) return false;
  if (!Number.isNaN(until) && now >= until) return false;
  return true;
}

let synced: { at: number; job: Promise<void> } | null = null;

/** Puts the website's items in the catalog (and turns seasonal/limited ones on or off by date). Runs at most every 5 minutes. */
export function ensureSiteCatalog(): Promise<void> {
  if (synced && Date.now() - synced.at < 5 * 60_000) return synced.job;
  const job = (async () => {
    const col = await getBotCollection("store_inventory");
    const now = new Date();
    await Promise.all(
      SITE_ITEMS.map((item) => {
        const { quantity, ...rest } = item;
        const set: Document = {
          ...rest,
          image_url: "",
          role_id: null,
          stackable: Boolean(item.stackable),
          max_owned: item.max_owned ?? null,
          duration: item.duration ?? null,
          available_from: item.available_from ? new Date(item.available_from) : null,
          available_until: item.available_until ? new Date(item.available_until) : null,
          season: item.season ?? null,
          is_active: inWindow(item, now.getTime()),
          site_item: true,
          updated_at: now,
        };
        return col.updateOne({ item_id: item.item_id }, { $set: set, $setOnInsert: { quantity: quantity ?? -1, created_at: now } }, { upsert: true });
      }),
    );
  })().catch((error) => {
    synced = null;
    console.error("Store catalog sync failed", error);
  });
  synced = { at: Date.now(), job };
  return job;
}
