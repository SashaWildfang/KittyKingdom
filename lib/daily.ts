// The daily leaf reward. Mirrors the bot's /daily (main_bot/cmds/daily.py) and uses the same
// fields on the same user document, so claiming here or in Discord shares one cooldown and streak.
//
// Rules (same as the bot):
// - one claim per UTC calendar day, resetting at midnight UTC
// - everyone gets 250 leaves; the streak goes up by one per day and resets after a missed day
// - Nitro boosters also get a streak bonus of +100 × the day of the 7-day cycle (+100 … +700)

import { Long, type Document } from "mongodb";
import { getMemberRoleIds } from "./discord-member";
import { getBotCollection } from "./mongodb";
import { StoreError } from "./store";

export const NITRO_ROLE_ID = "1360260086500561237";
export const NITRO_INFO_CHANNEL_ID = "1358485327030784071";
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
  base: number;
  step: number;
  infoChannelId: string;
};

const utcDay = (d: Date) => Math.floor(d.getTime() / DAY_MS);
const num = (v: unknown) => (typeof v === "bigint" ? Number(v) : typeof v === "number" ? v : Number(v ?? 0) || 0);
const idFilter = (discordId: string) => ({ discordId: { $in: [Long.fromString(discordId), discordId] } });
const cycleDayOf = (streak: number) => ((streak - 1) % CYCLE_DAYS) + 1;
const rewardFor = (streak: number, nitro: boolean) => DAILY_BASE + (nitro ? STREAK_STEP * cycleDayOf(streak) : 0);

async function hasNitro(discordId: string) {
  const roles = await getMemberRoleIds(discordId).catch(() => null);
  return Boolean(roles?.includes(NITRO_ROLE_ID));
}

function lastDailyOf(doc: Document | null) {
  const v = doc?.lastDaily;
  return v instanceof Date && !Number.isNaN(v.getTime()) ? v : null;
}

function statusFrom(doc: Document | null, nitro: boolean, now = new Date()): DailyStatus {
  const last = lastDailyOf(doc);
  const daysSince = last ? utcDay(now) - utcDay(last) : null;
  const claimedToday = daysSince === 0;
  const alive = daysSince !== null && daysSince <= 1;
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
    // Claimed today → safe until the end of tomorrow; claimed yesterday → must claim before tonight
    streakEndsAt: streak ? new Date(claimedToday ? tomorrow + DAY_MS : tomorrow).toISOString() : null,
    nitro,
    cycleDone,
    nextCycleDay: cycleDayOf(nextStreak),
    nextReward: rewardFor(nextStreak, nitro),
    nextRewardWithNitro: rewardFor(nextStreak, true),
    base: DAILY_BASE,
    step: STREAK_STEP,
    infoChannelId: NITRO_INFO_CHANNEL_ID,
  };
}

export async function getDailyStatus(discordId: string) {
  const users = await getBotCollection("users");
  const [doc, nitro] = await Promise.all([users.findOne(idFilter(discordId), { projection: { balance: 1, streak: 1, lastDaily: 1 }, ...BIG }), hasNitro(discordId)]);
  return statusFrom(doc, nitro);
}

/** Claims today's reward. Safe against double clicks: the write only lands if nobody claimed in between. */
export async function claimDaily(discordId: string) {
  const users = await getBotCollection("users");
  const [doc, nitro] = await Promise.all([users.findOne(idFilter(discordId), { ...BIG }), hasNitro(discordId)]);
  const now = new Date();
  const before = statusFrom(doc, nitro, now);
  if (before.claimedToday) throw new StoreError("You already claimed today's leaves. Come back after the reset!", 409);

  const streak = before.streak + 1;
  const reward = rewardFor(streak, nitro);
  const bonus = reward - DAILY_BASE;

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
  const message = bonus
    ? `+${reward.toLocaleString()} leaves! (${DAILY_BASE} + ${bonus} day ${cycleDayOf(streak)} streak bonus)`
    : `+${reward.toLocaleString()} leaves! Streak: ${streak} day${streak === 1 ? "" : "s"}.`;
  return { message, reward, bonus, status: after };
}
