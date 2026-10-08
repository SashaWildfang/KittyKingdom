// Admin → Ads: settings for the Discord tips (Main_Bot events/ad_manager.py reads bot_config "ads" every minute),
// how often each tip played, and the latest ones posted.

import { AD_CATALOG, AD_LIMITS, type AdSettings } from "./ads-catalog";
import { getBotCollection } from "./mongodb";

// Same defaults as Main_Bot db/ads.py
const DEFAULTS: AdSettings = {
  enabled: true,
  threshold: 40,
  windowMinutes: 45,
  minChatters: 3,
  channelCooldown: 45,
  globalCooldown: 15,
  deleteAfter: 10,
  disabled: [],
  weights: {},
  excludedCategories: ["1358485995649237103", "1362459990245245151", "1362461644768411758", "1448247633574363237", "1358486463251091569", "1358485130242560020", "1495849806395084862", "1499431359284908083"],
  excludedChannels: ["1496875154314231828", "1496743217390157935", "1497237389741920446", "1359520996561781009", "1358487818057289848", "1358487300245295104"],
};

const KEYS = new Set(AD_CATALOG.map((a) => a.key));
const ids = (v: unknown) => (Array.isArray(v) ? v.map(String).filter((x) => /^\d{15,25}$/.test(x)) : []);

export async function adsOverview() {
  const cfgCol = await getBotCollection("bot_config");
  const [doc, stats, log] = await Promise.all([
    cfgCol.findOne({ _id: "ads" } as never),
    cfgCol.findOne({ _id: "ads_stats" } as never),
    getBotCollection("ad_log").then((c) => c.find({}).sort({ at: -1 }).limit(40).toArray()),
  ]);
  const d = (doc ?? {}) as Record<string, unknown>;
  const settings: AdSettings = {
    enabled: typeof d.enabled === "boolean" ? d.enabled : DEFAULTS.enabled,
    threshold: Number(d.threshold ?? DEFAULTS.threshold),
    windowMinutes: Number(d.windowMinutes ?? DEFAULTS.windowMinutes),
    minChatters: Number(d.minChatters ?? DEFAULTS.minChatters),
    channelCooldown: Number(d.channelCooldown ?? DEFAULTS.channelCooldown),
    globalCooldown: Number(d.globalCooldown ?? DEFAULTS.globalCooldown),
    deleteAfter: Number(d.deleteAfter ?? DEFAULTS.deleteAfter),
    disabled: Array.isArray(d.disabled) ? d.disabled.map(String).filter((k) => KEYS.has(k)) : [],
    weights: (d.weights && typeof d.weights === "object" ? d.weights : {}) as Record<string, number>,
    excludedChannels: d.excludedChannels ? ids(d.excludedChannels) : DEFAULTS.excludedChannels,
    excludedCategories: d.excludedCategories ? ids(d.excludedCategories) : DEFAULTS.excludedCategories,
  };
  const s = (stats ?? {}) as { shown?: Record<string, number>; lastShown?: Record<string, Date>; total?: number; lastAt?: Date };
  const week = Date.now() - 7 * 86_400_000;
  const lastWeek = await getBotCollection("ad_log").then((c) => c.countDocuments({ at: { $gte: new Date(week) } }));
  return {
    settings,
    total: Number(s.total ?? 0),
    lastWeek,
    lastAt: s.lastAt instanceof Date ? s.lastAt.toISOString() : null,
    perAd: AD_CATALOG.map((a) => ({
      ...a,
      shown: Number(s.shown?.[a.key] ?? 0),
      lastShown: s.lastShown?.[a.key] instanceof Date ? (s.lastShown[a.key] as Date).toISOString() : null,
    })),
    recent: log.map((l) => ({
      key: String(l.key),
      label: AD_CATALOG.find((a) => a.key === l.key)?.label ?? String(l.key),
      channelId: String(l.channelId ?? ""),
      channelName: l.channelName ? String(l.channelName) : null,
      trigger: l.trigger === "manual" ? "manual" : "auto",
      at: l.at instanceof Date ? l.at.toISOString() : String(l.at),
    })),
  };
}

export async function saveAdSettings(raw: Record<string, unknown>, by: string) {
  const out: Record<string, unknown> = { enabled: Boolean(raw.enabled) };
  for (const [k, [lo, hi]] of Object.entries(AD_LIMITS)) {
    const n = Math.round(Number(raw[k]));
    if (!Number.isFinite(n) || n < lo || n > hi) throw new Error(`${k} must be between ${lo} and ${hi}.`);
    out[k] = n;
  }
  out.disabled = Array.isArray(raw.disabled) ? raw.disabled.map(String).filter((k) => KEYS.has(k)) : [];
  const weights: Record<string, number> = {};
  if (raw.weights && typeof raw.weights === "object") {
    for (const [k, v] of Object.entries(raw.weights as Record<string, unknown>)) {
      const n = Number(v);
      if (KEYS.has(k) && Number.isFinite(n)) weights[k] = Math.max(0, Math.min(5, Math.round(n)));
    }
  }
  out.weights = weights;
  out.excludedChannels = ids(raw.excludedChannels).slice(0, 200);
  out.excludedCategories = ids(raw.excludedCategories).slice(0, 100);
  await (await getBotCollection("bot_config")).updateOne({ _id: "ads" } as never, { $set: { ...out, updatedAt: new Date(), updatedBy: by } }, { upsert: true });
}
