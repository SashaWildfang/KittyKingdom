// When each badge was earned. Badges are worked out from stats on the fly, so this remembers the
// tiers each time they're worked out (when a member opens their stats) and notes any change with the
// time it was first seen. Badges someone already had when tracking started are marked "baseline":
// all we know is they were earned by then.

import type { EarnedBadge } from "./badges";
import { getMongoClient } from "./mongodb";

export type BadgeEarned = { tier: number; at: string; baseline?: boolean };
export type BadgeEvent = { id: string; from: number; to: number; at: string };
export type BadgeHistory = { earned: Record<string, BadgeEarned>; events: BadgeEvent[] };

type Doc = {
  _id: string;
  tiers: Record<string, number>;
  earned: Record<string, { tier: number; at: Date; baseline?: boolean }>;
  events: { id: string; from: number; to: number; at: Date }[];
  sig: string;
  startedAt: Date;
};

const MAX_EVENTS = 50;
const EMPTY: BadgeHistory = { earned: {}, events: [] };

async function col() {
  const client = await getMongoClient();
  return client.db(process.env.MONGODB_DB ?? "website").collection<Doc>("badge_history");
}

const signature = (tiers: Record<string, number>) =>
  Object.keys(tiers)
    .sort()
    .map((k) => `${k}:${tiers[k]}`)
    .join(",");

function toHistory(doc: Doc | null): BadgeHistory {
  if (!doc) return EMPTY;
  const earned: Record<string, BadgeEarned> = {};
  for (const [id, e] of Object.entries(doc.earned ?? {})) earned[id] = { tier: e.tier, at: new Date(e.at).toISOString(), ...(e.baseline ? { baseline: true } : {}) };
  const events = (doc.events ?? []).map((e) => ({ id: e.id, from: e.from, to: e.to, at: new Date(e.at).toISOString() })).reverse();
  return { earned, events };
}

/** The saved history (newest events first), without updating it. */
export async function badgeHistory(discordId: string): Promise<BadgeHistory> {
  if (!/^\d{15,21}$/.test(discordId)) return EMPTY;
  return toHistory(await (await col()).findOne({ _id: discordId }).catch(() => null));
}

/** Saves this moment's tiers, noting anything newly earned, upgraded or lost. Returns the history. */
export async function recordBadges(discordId: string, badges: EarnedBadge[]): Promise<BadgeHistory> {
  if (!/^\d{15,21}$/.test(discordId)) return EMPTY;
  const c = await col();
  const now = new Date();
  const tiers: Record<string, number> = {};
  for (const b of badges) if (b.tier > 0) tiers[b.id] = b.tier;
  const sig = signature(tiers);
  const doc = await c.findOne({ _id: discordId });

  if (!doc) {
    const earned: Doc["earned"] = {};
    for (const [id, tier] of Object.entries(tiers)) earned[id] = { tier, at: now, baseline: true };
    const fresh: Doc = { _id: discordId, tiers, earned, events: [], sig, startedAt: now };
    await c.insertOne(fresh).catch(() => undefined); // a parallel request may have made it first
    return toHistory((await c.findOne({ _id: discordId })) ?? fresh);
  }
  if (doc.sig === sig) return toHistory(doc);

  const set: Record<string, unknown> = { tiers, sig };
  const unset: Record<string, ""> = {};
  const events: Doc["events"] = [];
  const ids = new Set([...Object.keys(doc.tiers ?? {}), ...Object.keys(tiers)]);
  ids.forEach((id) => {
    const from = doc.tiers?.[id] ?? 0;
    const to = tiers[id] ?? 0;
    if (from === to) return;
    events.push({ id, from, to, at: now });
    if (to === 0) unset[`earned.${id}`] = "";
    // Earned or moved up: this is when. Dropped a tier: keep when they first got it
    else if (to > from) set[`earned.${id}`] = { tier: to, at: now };
    else set[`earned.${id}.tier`] = to;
  });
  // Only if nobody else saved a change in between (so each change is noted once)
  await c.updateOne(
    { _id: discordId, sig: doc.sig },
    { $set: set, ...(Object.keys(unset).length ? { $unset: unset } : {}), $push: { events: { $each: events, $slice: -MAX_EVENTS } } },
  );
  return toHistory(await c.findOne({ _id: discordId }));
}

/** Forgets when this member earned their badges (their website account was deleted). */
export async function deleteBadgeHistory(discordId: string | null | undefined) {
  if (!discordId || !/^\d{15,21}$/.test(String(discordId))) return;
  await (await col()).deleteOne({ _id: String(discordId) });
}
