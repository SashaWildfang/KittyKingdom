// Bot settings the website itself also uses (marked "bot + website" in Admin → Bots), so a change applies
// to the Discord command and the website at the same time. Cached for 30 seconds.

import { getBotCollection } from "../mongodb";

const cache = new Map<string, { at: number; values: Record<string, unknown> }>();

async function values(bot: string) {
  const hit = cache.get(bot);
  if (hit && Date.now() - hit.at < 30_000) return hit.values;
  const doc = (await (await getBotCollection("bot_settings")).findOne({ _id: bot } as never, { projection: { values: 1 } }).catch(() => null)) as { values?: Record<string, unknown> } | null;
  const v = doc?.values ?? {};
  cache.set(bot, { at: Date.now(), values: v });
  return v;
}

/** A number setting from a bot's saved settings ("daily.base"), or the fallback when it isn't set. */
export async function botNumber(bot: string, key: string, fallback: number) {
  const v = key.split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), await values(bot).catch(() => ({})));
  const n = typeof v === "number" ? v : Number(v);
  return v !== undefined && v !== null && Number.isFinite(n) ? n : fallback;
}

export const economyNumber = (key: string, fallback: number) => botNumber("economy", key, fallback);
