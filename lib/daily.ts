// The daily leaf reward. Mirrors the bot's /daily (main_bot/cmds/daily.py) and uses the same
// fields on the same user document, so claiming here or in Discord shares one cooldown and streak.
//
// Rules (same as the bot):
// - one claim per UTC calendar day, resetting at midnight UTC
// - everyone gets 250 leaves; the streak goes up by one per day and resets after a missed day
// - Nitro boosters also get a streak bonus of +100 × the day of the 7-day cycle (+100 … +700)
// - Streak Shields (store item): a missed day uses one shield instead of breaking the streak
//   (one shield per missed day, up to 3 missed days in a row)

import { withTierAliases } from "./tier-roles";
import { dailyBonusFromRoles } from "./perks";
import { serverGuidePath } from "./server-guide";
import { Long, type Document } from "mongodb";
import { getMemberRoleIds } from "./discord-member";
import { getBotCollection } from "./mongodb";
import { ITEM, SHIELD_MAX_GAP } from "./cosmetics";
import { StoreError } from "./store";

// 🍂 Golden Leaf (Nitro), given to server boosters
export const NITRO_ROLE_ID = "1360260086500561237";
export const DAILY_BASE = 250;
export const STREAK_STEP = 100;
export const CYCLE_DAYS = 7;

const DAY_MS = 86_400_000;
const BIG = { useBigInt64: true } as const;

export type DailyStatus = {
  balance: number;
  /** Streak as it stands now (0 if it has already been broken) */
  streak: number;
  claimedToday: boolean;
  lastClaimAt: string | null;
  /** When the next claim opens (now, if it is open) */
  nextClaimAt: string;
  /** When the streak is lost if nobody claims (null when there is no streak) */
  streakEndsAt: string | null;
  nitro: boolean;
  /** Days of the current 7-day cycle already claimed (0–7) */
  cycleDone: number;
  /** Which cycle day the next claim counts as (1–7) */
  nextCycleDay: number;
  nextReward: number;
  /** What the next claim would pay with Nitro (for the upsell) */
  nextRewardWithNitro: number;
  /** Every claim's base (250 + any Patreon tier bonus) */
  base: number;
  /** Extra Leaves on every claim from the Patreon tier */
  patronBonus: number;
  step: number;
  /** The Boosting section of #server-guide (`channel/message`), once the guide is posted */
  perksPath: string | null;
  /** Streak Shields they hold */
  shields: number;
  /** Shields the next claim will use to keep the streak (0 if none are needed) */
  shieldsNeeded: number;
};

const utcDay = (d: Date) => Math.floor(d.getTime() / DAY_MS);
const num = (v: unknown) => (typeof v === "bigint" ? Number(v) : typeof v === "number" ? v : Number(v ?? 0) || 0);
const idFilter = (discordId: string) => ({ discordId: { $in: [Long.fromString(discordId), discordId] } });
const cycleDayOf = (streak: number) => ((streak - 1) % CYCLE_DAYS) + 1;
/** Base + the Patreon tier bonus (every claim) + the Nitro streak bonus */
const rewardFor = (streak: number, nitro: boolean, patron = 0) => DAILY_BASE + patron + (nitro ? STREAK_STEP * cycleDayOf(streak) : 0);

/** Nitro (streak bonus) and the Patreon tier's bonus on every claim, from the member's roles. */
async function memberPerks(discordId: string) {
  const roles = await withTierAliases(await getMemberRoleIds(discordId).catch(() => null));
  return { nitro: Boolean(roles?.includes(NITRO_ROLE_ID)), patron: dailyBonusFromRoles(roles) };
}

function lastDailyOf(doc: Document | null) {
  const v = doc?.lastDaily;
  return v instanceof Date && !Number.isNaN(v.getTime()) ? v : null;
}

function statusFrom(doc: Document | null, nitro: boolean, now = new Date(), shields = 0, patron = 0): DailyStatus {
  const last = lastDailyOf(doc);
  const daysSince = last ? utcDay(now) - utcDay(last) : null;
  const claimedToday = daysSince === 0;
  // Days missed since the last claim, and whether shields can cover them
  const gap = daysSince !== null && daysSince > 1 ? daysSince - 1 : 0;
  const shielded = gap > 0 && gap <= SHIELD_MAX_GAP && shields >= gap;
  const alive = daysSince !== null && (daysSince <= 1 || shielded);
  const streak = alive ? Math.max(0, num(doc?.streak)) : 0;

  const nextStreak = streak + 1;
  const tomorrow = (utcDay(now) + 1) * DAY_MS;
  let cycleDone = streak ? cycleDayOf(streak) : 0;
  // A finished week only shows as full on the day it was completed
  if (!claimedToday && cycleDone === CYCLE_DAYS) cycleDone = 0;

  return {
    balance: num(doc?.balance),
    streak,
    claimedToday,
    lastClaimAt: last?.toISOString() ?? null,
    nextClaimAt: new Date(claimedToday ? tomorrow : now.getTime()).toISOString(),
    // Lost at the start of the day after the last safe one: the day after the last claim, plus a day
    // for each shield still left over after covering days already missed
    streakEndsAt: streak && last ? new Date((utcDay(last) + 2 + Math.min(SHIELD_MAX_GAP, shields) ) * DAY_MS).toISOString() : null,
    nitro,
    cycleDone,
    nextCycleDay: cycleDayOf(nextStreak),
    nextReward: rewardFor(nextStreak, nitro, patron),
    nextRewardWithNitro: rewardFor(nextStreak, true, patron),
    base: DAILY_BASE + patron,
    patronBonus: patron,
    step: STREAK_STEP,
    perksPath: null,
    shields,
    shieldsNeeded: shielded ? gap : 0,
  };
}

async function shieldCount(discordId: string) {
  return (await getBotCollection("user_inventory")).countDocuments({ discordId, item_id: ITEM.shield }).catch(() => 0);
}

export async function getDailyStatus(discordId: string) {
  const users = await getBotCollection("users");
  const [doc, perks, shields] = await Promise.all([users.findOne(idFilter(discordId), { projection: { balance: 1, streak: 1, lastDaily: 1 }, ...BIG }), memberPerks(discordId), shieldCount(discordId)]);
  const [status, perksPath] = [statusFrom(doc, perks.nitro, new Date(), shields, perks.patron), await serverGuidePath("boost").catch(() => null)];
  return { ...status, perksPath };
}

/** Claims today's reward. Safe against double clicks: the write only lands if nobody claimed in between. */
export async function claimDaily(discordId: string) {
  const users = await getBotCollection("users");
  const [doc, perks, shields] = await Promise.all([users.findOne(idFilter(discordId), { ...BIG }), memberPerks(discordId), shieldCount(discordId)]);
  const { nitro, patron } = perks;
  const now = new Date();
  let before = statusFrom(doc, nitro, now, shields, patron);
  if (before.claimedToday) throw new StoreError("You already claimed today's leaves. Come back after the reset!", 409);

  // Missed days: use one shield per day (all or none); if any can't be taken, the streak resets
  let usedShields = 0;
  if (before.shieldsNeeded) {
    const inv = await getBotCollection("user_inventory");
    const taken: Document[] = [];
    for (let i = 0; i < before.shieldsNeeded; i++) {
      const gone = await inv.findOneAndDelete({ discordId, item_id: ITEM.shield });
      if (!gone) break;
      taken.push(gone);
    }
    usedShields = taken.length;
    if (usedShields < before.shieldsNeeded) {
      // Not enough after all (used elsewhere at the same moment): give them back, the streak resets
      if (taken.length) await inv.insertMany(taken).catch(() => undefined);
      usedShields = 0;
      before = statusFrom(doc, nitro, now, 0, patron);
    }
  }

  const streak = before.streak + 1;
  const reward = rewardFor(streak, nitro, patron);
  const bonus = reward - DAILY_BASE - patron;

  if (doc) {
    const res = await users.updateOne(
      { _id: doc._id, lastDaily: doc.lastDaily ?? null },
      { $inc: { balance: reward }, $set: { streak, lastDaily: now, updatedAt: now } },
    );
    if (!res.modifiedCount) throw new StoreError("You already claimed today's leaves.", 409);
  } else {
    // Same shape the bot creates for a first-time claimer
    await users.insertOne({ discordId: Long.fromString(discordId), balance: reward, streak, lastDaily: now, createdAt: now, updatedAt: now });
  }

  const after = await getDailyStatus(discordId);
  const saved = usedShields && before.streak ? ` 🛡️ ${usedShields} Streak Shield${usedShields === 1 ? "" : "s"} kept your streak alive.` : "";
  const message =
    (bonus
      ? `+${reward.toLocaleString()} leaves! (${DAILY_BASE}${patron ? ` + ${patron} supporter bonus` : ""} + ${bonus} day ${cycleDayOf(streak)} streak bonus)`
      : `+${reward.toLocaleString()} leaves!${patron ? ` (includes your +${patron} supporter bonus)` : ""} Streak: ${streak} day${streak === 1 ? "" : "s"}.`) + saved;
  return { message, reward, bonus, status: { ...after, perksPath: await serverGuidePath("boost").catch(() => null) } };
}
