// Seasons: settings (zeo_bot.bot_config "season"), uploaded art (zeo_bot.season_assets) and what the
// Main Bot last applied in Discord (bot_config "season_state"). See lib/seasons.ts for the seasons themselves.

import { Binary, ObjectId, type Document } from "mongodb";
import { sniff } from "./news-media";
import { getBotCollection } from "./mongodb";
import {
  ASSET_KINDS,
  SEASONS,
  SEASON_KEYS,
  activeSeasonKey,
  defaultSeasonConfig,
  defaultSeasonSettings,
  seasonView,
  seasonalText,
  type AssetKind,
  type SeasonConfig,
  type SeasonKey,
  type SeasonView,
} from "./seasons";

export class SeasonError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

const CONFIG_ID = "season";
const STATE_ID = "season_state";
const MAX_BYTES: Record<AssetKind, number> = { logo: 4 * 1024 * 1024, banner: 4 * 1024 * 1024, emote: 256 * 1024 };
const ASSET_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];
const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : typeof v === "string" ? v : null);

// ---------------------------------------------------------------- reading (cached briefly per server)
let cache: { at: number; config: SeasonConfig } | null = null;
let warned = false;
const TTL = 20_000;

/** Merges a stored doc over the defaults, so new settings always have a value. */
function normalise(doc: Document | null): SeasonConfig {
  const base = defaultSeasonConfig();
  if (!doc) return base;
  const seasons = { ...base.seasons };
  for (const key of SEASON_KEYS) {
    const saved = (doc.seasons?.[key] ?? {}) as Partial<SeasonConfig["seasons"][SeasonKey]>;
    seasons[key] = { ...defaultSeasonSettings(key), ...saved, assets: { ...(saved.assets ?? {}) } };
  }
  return {
    mode: doc.mode === "manual" ? "manual" : "auto",
    manual: SEASON_KEYS.includes(doc.manual) ? doc.manual : base.manual,
    timezone: typeof doc.timezone === "string" && doc.timezone ? doc.timezone : base.timezone,
    seasons,
    site: { ...base.site, ...(doc.site ?? {}) },
    discord: { ...base.discord, ...(doc.discord ?? {}) },
    version: Number(doc.version ?? 0),
    updatedAt: iso(doc.updatedAt),
    updatedBy: doc.updatedBy ? String(doc.updatedBy) : null,
  };
}

export async function getSeasonConfig(fresh = false): Promise<SeasonConfig> {
  if (!fresh && cache && Date.now() - cache.at < TTL) return cache.config;
  try {
    const doc = await (await getBotCollection("bot_config")).findOne({ _id: CONFIG_ID as never });
    cache = { at: Date.now(), config: normalise(doc) };
  } catch (error) {
    // The site keeps working on the calendar season if the database is down
    if (!warned) console.error("Season settings unavailable", error instanceof Error ? error.message : error);
    warned = true;
    return cache?.config ?? defaultSeasonConfig();
  }
  return cache.config;
}

/** The live season, ready for the website to draw. */
export async function getSeason(): Promise<SeasonView> {
  const config = await getSeasonConfig();
  return seasonView(config, activeSeasonKey(config));
}

/** Every season's view (for previews). */
export async function getAllSeasonViews(): Promise<Record<SeasonKey, SeasonView>> {
  const config = await getSeasonConfig();
  return Object.fromEntries(SEASON_KEYS.map((k) => [k, seasonView(config, k)])) as Record<SeasonKey, SeasonView>;
}

/**
 * The live season's currency words right away (from the last settings this server read, or the calendar),
 * for messages built in places that can't wait. Refreshes the settings in the background.
 */
export function seasonWordsSync() {
  if (!cache || Date.now() - cache.at > TTL) void getSeasonConfig().catch(() => undefined);
  const config = cache?.config ?? defaultSeasonConfig();
  const v = seasonView(config, activeSeasonKey(config));
  return { one: v.one, many: v.many };
}

/** "50 leaves" → "50 snowflakes" in winter (for messages written with the autumn words). */
export function seasonal(text: string) {
  return seasonalText(text, seasonWordsSync());
}

/** "Leaves" / "Leaf" for the live season, for messages built on the server. */
export async function currencyWords() {
  const s = await getSeason();
  return { one: s.one, many: s.many };
}

// ---------------------------------------------------------------- admin
export type SeasonState = {
  applied: SeasonKey | null;
  appliedAt: string | null;
  appliedVersion: number | null;
  heartbeat: string | null;
  channels: { id: string; from: string; to: string; ok: boolean; error?: string }[];
  icon: string | null;
  banner: string | null;
  emoji: string | null;
  errors: string[];
  pending: boolean;
};

export type AssetInfo = { id: string; season: SeasonKey; kind: AssetKind; type: string; size: number; name: string; at: string | null; by: string | null };

export async function getSeasonAdmin() {
  const config = await getSeasonConfig(true);
  const cfg = await getBotCollection("bot_config");
  const [stateDoc, raw, assets] = await Promise.all([
    cfg.findOne({ _id: STATE_ID as never }),
    cfg.findOne({ _id: CONFIG_ID as never }, { projection: { history: 1, applyRequestedAt: 1, applyHandledAt: 1 } }),
    (await getBotCollection("season_assets")).find({}, { projection: { data: 0 } }).sort({ at: -1 }).toArray(),
  ]);
  const st = (stateDoc ?? {}) as Document;
  const state: SeasonState = {
    applied: SEASON_KEYS.includes(st.applied) ? st.applied : null,
    appliedAt: iso(st.appliedAt),
    appliedVersion: st.appliedVersion ?? null,
    heartbeat: iso(st.heartbeat),
    channels: ((st.channels ?? []) as Document[]).map((c) => ({ id: String(c.id), from: String(c.from ?? ""), to: String(c.to ?? ""), ok: c.ok !== false, ...(c.error ? { error: String(c.error) } : {}) })),
    icon: st.icon ? String(st.icon) : null,
    banner: st.banner ? String(st.banner) : null,
    emoji: st.emoji ? String(st.emoji) : null,
    errors: ((st.errors ?? []) as unknown[]).map(String).slice(0, 20),
    pending: Boolean(raw?.applyRequestedAt && (!raw.applyHandledAt || raw.applyRequestedAt > raw.applyHandledAt)),
  };
  const history = (raw?.history ?? []) as Document[];
  return {
    config,
    active: activeSeasonKey(config),
    calendar: activeSeasonKey({ ...config, mode: "auto" }),
    views: Object.fromEntries(SEASON_KEYS.map((k) => [k, seasonView(config, k)])) as Record<SeasonKey, SeasonView>,
    state,
    assets: assets.map(
      (a): AssetInfo => ({ id: String(a._id), season: a.season, kind: a.kind, type: String(a.type), size: Number(a.size ?? 0), name: String(a.name ?? ""), at: iso(a.at), by: a.by ? String(a.by) : null }),
    ),
    history: history
      .slice(-40)
      .reverse()
      .map((h) => ({ at: iso(h.at), by: String(h.by ?? ""), what: String(h.what ?? "") })),
  };
}

const text = (v: unknown, label: string, max: number) => {
  const s = String(v ?? "").trim();
  if (!s) throw new SeasonError(`${label} can't be empty.`);
  if (s.length > max) throw new SeasonError(`${label} must be ${max} characters or fewer.`);
  return s;
};

function validTimezone(tz: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Saves the settings from the admin page. Returns what changed (for the log). */
export async function saveSeasonConfig(raw: Partial<SeasonConfig>, by: string) {
  const current = await getSeasonConfig(true);
  const next: SeasonConfig = JSON.parse(JSON.stringify(current));
  if (raw.mode !== undefined) next.mode = raw.mode === "manual" ? "manual" : "auto";
  if (raw.manual !== undefined) {
    if (!SEASON_KEYS.includes(raw.manual)) throw new SeasonError("Pick a season.");
    next.manual = raw.manual;
  }
  if (raw.timezone !== undefined) {
    if (!validTimezone(String(raw.timezone))) throw new SeasonError("That isn't a time zone (e.g. US/Mountain).");
    next.timezone = String(raw.timezone);
  }
  if (raw.seasons) {
    for (const key of SEASON_KEYS) {
      const r = raw.seasons[key];
      if (!r) continue;
      const name = SEASONS[key].name;
      const s = next.seasons[key];
      if (r.currencyOne !== undefined) s.currencyOne = text(r.currencyOne, `${name}: currency (one)`, 24);
      if (r.currencyMany !== undefined) s.currencyMany = text(r.currencyMany, `${name}: currency (many)`, 24);
      if (r.discordEmoji !== undefined) {
        const e = text(r.discordEmoji, `${name}: Discord emoji`, 80);
        if (!/^<a?:\w{2,32}:\d{15,21}>$/.test(e) && e.length > 16) throw new SeasonError(`${name}: the Discord emoji must be an emoji or a custom emoji like <:leaf:123…>.`);
        s.discordEmoji = e;
      }
      if (r.channelEmoji !== undefined) {
        const e = text(r.channelEmoji, `${name}: channel emoji`, 16);
        if (/[\s#@]/.test(e)) throw new SeasonError(`${name}: the channel emoji can't have spaces, # or @.`);
        s.channelEmoji = e;
      }
      if (r.siteLogo !== undefined) s.siteLogo = Boolean(r.siteLogo);
      if (r.siteBanner !== undefined) s.siteBanner = Boolean(r.siteBanner);
    }
    const emojis = SEASON_KEYS.map((k) => next.seasons[k].channelEmoji);
    if (new Set(emojis).size !== emojis.length) throw new SeasonError("Each season needs its own channel emoji, so the bot can tell which channels to swap.");
  }
  if (raw.site) {
    if (raw.site.particles !== undefined) {
      if (!["full", "light", "off"].includes(raw.site.particles)) throw new SeasonError("Pick how many particles.");
      next.site.particles = raw.site.particles;
    }
    if (raw.site.scenery !== undefined) next.site.scenery = Boolean(raw.site.scenery);
    if (raw.site.bursts !== undefined) next.site.bursts = Boolean(raw.site.bursts);
  }
  if (raw.discord) {
    for (const k of ["renameChannels", "renameCategories", "swapIcon", "swapBanner"] as const) {
      if (raw.discord[k] !== undefined) next.discord[k] = Boolean(raw.discord[k]);
    }
  }
  const changes = describeChanges(current, next);
  if (!changes.length) return { changed: [] as string[] };
  const col = await getBotCollection("bot_config");
  const { version: _v, updatedAt: _a, updatedBy: _b, ...body } = next;
  await col.updateOne(
    { _id: CONFIG_ID as never },
    {
      $set: { ...body, updatedAt: new Date(), updatedBy: by },
      $inc: { version: 1 },
      $push: { history: { $each: changes.map((what) => ({ at: new Date(), by, what })), $slice: -200 } } as Document,
    },
    { upsert: true },
  );
  cache = null;
  return { changed: changes };
}

function describeChanges(a: SeasonConfig, b: SeasonConfig) {
  const out: string[] = [];
  if (a.mode !== b.mode) out.push(b.mode === "auto" ? "Switched to automatic seasons (by date)" : `Picked the season by hand: ${SEASONS[b.manual].name}`);
  else if (b.mode === "manual" && a.manual !== b.manual) out.push(`Changed the season to ${SEASONS[b.manual].name}`);
  if (a.timezone !== b.timezone) out.push(`Time zone: ${b.timezone}`);
  for (const key of SEASON_KEYS) {
    const x = a.seasons[key];
    const y = b.seasons[key];
    const n = SEASONS[key].name;
    if (x.currencyOne !== y.currencyOne || x.currencyMany !== y.currencyMany) out.push(`${n} currency: ${y.currencyOne} / ${y.currencyMany}`);
    if (x.discordEmoji !== y.discordEmoji) out.push(`${n} Discord emoji: ${y.discordEmoji}`);
    if (x.channelEmoji !== y.channelEmoji) out.push(`${n} channel emoji: ${y.channelEmoji}`);
    if (x.siteLogo !== y.siteLogo) out.push(`${n}: ${y.siteLogo ? "show" : "hide"} the logo on the website`);
    if (x.siteBanner !== y.siteBanner) out.push(`${n}: ${y.siteBanner ? "show" : "hide"} the banner on the website`);
  }
  const onOff = (v: boolean) => (v ? "on" : "off");
  if (a.site.particles !== b.site.particles) out.push(`Website particles: ${b.site.particles}`);
  if (a.site.scenery !== b.site.scenery) out.push(`Website scenery ${onOff(b.site.scenery)}`);
  if (a.site.bursts !== b.site.bursts) out.push(`Click bursts ${onOff(b.site.bursts)}`);
  if (a.discord.renameChannels !== b.discord.renameChannels) out.push(`Channel emoji swap ${onOff(b.discord.renameChannels)}`);
  if (a.discord.renameCategories !== b.discord.renameCategories) out.push(`Category emoji swap ${onOff(b.discord.renameCategories)}`);
  if (a.discord.swapIcon !== b.discord.swapIcon) out.push(`Server icon swap ${onOff(b.discord.swapIcon)}`);
  if (a.discord.swapBanner !== b.discord.swapBanner) out.push(`Server banner swap ${onOff(b.discord.swapBanner)}`);
  return out;
}

/** Asks the Main Bot to apply the live season in Discord now (channel emojis, icon, banner). */
export async function requestApply(by: string) {
  await (await getBotCollection("bot_config")).updateOne(
    { _id: CONFIG_ID as never },
    { $set: { applyRequestedAt: new Date(), applyRequestedBy: by }, $push: { history: { $each: [{ at: new Date(), by, what: "Asked the bot to apply the season in Discord now" }], $slice: -200 } } as Document },
    { upsert: true },
  );
}

// ---------------------------------------------------------------- art
export async function uploadAsset(season: string, kind: string, data: Buffer, name: string, by: string) {
  if (!SEASON_KEYS.includes(season as SeasonKey)) throw new SeasonError("Unknown season.");
  if (!ASSET_KINDS.includes(kind as AssetKind)) throw new SeasonError("Unknown kind of image.");
  const k = kind as AssetKind;
  const type = sniff(data);
  if (!type || !ASSET_TYPES.includes(type)) throw new SeasonError("Upload a PNG, JPG, GIF or WebP image.");
  if (data.length > MAX_BYTES[k]) throw new SeasonError(k === "emote" ? "Emotes must be 256 KB or smaller (Discord's limit)." : "Images must be 4 MB or smaller.");
  const res = await (await getBotCollection("season_assets")).insertOne({ season, kind: k, type, size: data.length, name: name.slice(0, 120), data: new Binary(data), at: new Date(), by });
  const id = String(res.insertedId);
  await useAsset(season as SeasonKey, k, id, by, `Uploaded a new ${SEASONS[season as SeasonKey].name} ${k}`);
  return { id };
}

/** Points a season at one of its uploaded images (or back to the default with null). */
export async function useAsset(season: SeasonKey, kind: AssetKind, id: string | null, by: string, what?: string) {
  if (id) {
    if (!ObjectId.isValid(id)) throw new SeasonError("Unknown image.");
    const found = await (await getBotCollection("season_assets")).findOne({ _id: new ObjectId(id) }, { projection: { season: 1, kind: 1 } });
    if (!found || found.season !== season || found.kind !== kind) throw new SeasonError("That image isn't a " + `${SEASONS[season].name} ${kind}.`);
  }
  await (await getBotCollection("bot_config")).updateOne(
    { _id: CONFIG_ID as never },
    {
      $set: { [`seasons.${season}.assets.${kind}`]: id, updatedAt: new Date(), updatedBy: by },
      $inc: { version: 1 },
      $push: { history: { $each: [{ at: new Date(), by, what: what ?? (id ? `Switched the ${SEASONS[season].name} ${kind}` : `${SEASONS[season].name} ${kind} back to the default`) }], $slice: -200 } } as Document,
    },
    { upsert: true },
  );
  cache = null;
}

export async function deleteAsset(id: string, by: string) {
  if (!ObjectId.isValid(id)) throw new SeasonError("Unknown image.", 404);
  const col = await getBotCollection("season_assets");
  const doc = await col.findOne({ _id: new ObjectId(id) }, { projection: { data: 0 } });
  if (!doc) throw new SeasonError("Unknown image.", 404);
  const config = await getSeasonConfig(true);
  if (config.seasons[doc.season as SeasonKey]?.assets?.[doc.kind as AssetKind] === id) await useAsset(doc.season, doc.kind, null, by, `Removed the ${SEASONS[doc.season as SeasonKey].name} ${doc.kind}`);
  await col.deleteOne({ _id: doc._id });
}

/** The image a season uses for a kind (or null to fall back to the default file). */
export async function readSeasonAsset(season: string, kind: string, id?: string | null) {
  if (!SEASON_KEYS.includes(season as SeasonKey) || !ASSET_KINDS.includes(kind as AssetKind)) return null;
  const config = await getSeasonConfig();
  const assetId = id ?? config.seasons[season as SeasonKey].assets[kind as AssetKind];
  if (!assetId || !ObjectId.isValid(assetId)) return null;
  const doc = await (await getBotCollection("season_assets")).findOne({ _id: new ObjectId(assetId) });
  if (!doc) return null;
  const data = doc.data instanceof Binary ? Buffer.from(doc.data.buffer) : Buffer.from(doc.data);
  return { data, type: String(doc.type) };
}
