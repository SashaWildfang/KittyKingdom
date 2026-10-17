// Crash for the website: place a bet, watch the multiplier climb from 1.00x, and cash out before it crashes.
// Each round is your own. The crash point is picked on the server with crypto randomness when the round starts
// and is never sent to the browser until the round is over; cashing out is checked against the server's clock,
// so a slow connection or an edited page can't cash out after the crash.
//
// Odds: P(the round reaches x) = (1 - edge) / x, so every cash-out target returns 97% on average (a 3% house
// edge), and about 3% of rounds crash instantly at 1.00x. The multiplier grows as e^(0.00006 · ms): 2x after
// ~11.6s, 10x after ~38s. Rounds are capped at 1,000x.
//
// One record per member (`cr:<discordId>`) with a version check, so a double click can't cash out twice.

import { economyNumber } from "../bot-settings/live";
import { addToJackpot, charge, credit, gameCollections, GameError, getBalance, random, recordGame } from "./core";

export const CRASH_EDGE = 0.03;
export const CRASH_MAX = 1000;
export const CRASH_MIN_BET = 10;
export const CRASH_MAX_BET = 100_000;
const GROWTH = 0.00006;
const HISTORY = 24;

/** The multiplier `ms` after the round started (2 decimals, rounded down). */
export const crashMultiplierAt = (ms: number) => Math.floor(Math.exp(GROWTH * Math.max(0, ms)) * 100) / 100;
/** How long after the start the multiplier reaches `x`. */
export const crashTimeFor = (x: number) => Math.log(Math.max(1, x)) / GROWTH;

export type CrashSession = {
  _id: string;
  discordId: string;
  bet: number;
  crashAt: number; // server only while playing
  auto: number | null;
  status: "playing" | "cashed" | "bust";
  cashedAt: number | null;
  payout: number;
  version: number;
  startedAt: Date;
  updatedAt: Date;
};

export type PublicCrash = {
  roundId: number;
  bet: number;
  auto: number | null;
  status: CrashSession["status"];
  startedAt: number;
  cashedAt: number | null;
  payout: number | null;
  /** Only once the round is over */
  crashAt: number | null;
};

const sid = (discordId: string) => `cr:${discordId}`;

function pickCrashPoint() {
  const r = random();
  const x = Math.floor(((1 - CRASH_EDGE) / (1 - r)) * 100) / 100;
  return Math.min(CRASH_MAX, Math.max(1, x));
}

const view = (s: CrashSession): PublicCrash => ({
  roundId: new Date(s.startedAt).getTime(),
  bet: s.bet,
  auto: s.auto,
  status: s.status,
  startedAt: new Date(s.startedAt).getTime(),
  cashedAt: s.cashedAt,
  payout: s.status === "playing" ? null : s.payout,
  crashAt: s.status === "playing" ? null : s.crashAt,
});

async function load(discordId: string) {
  const { sessions } = await gameCollections();
  return (await sessions.findOne({ _id: sid(discordId) } as never)) as unknown as CrashSession | null;
}

async function recent() {
  const { globals } = await gameCollections();
  const doc = await globals.findOne({ _id: "crash_recent" } as never);
  return ((doc?.points as number[] | undefined) ?? []).slice(-HISTORY).reverse();
}

/** Ends a round (bust, or cashed at `at`), pays out and records it. Only the first caller wins the version race. */
async function finish(s: CrashSession, outcome: "cashed" | "bust", at: number | null) {
  const payout = outcome === "cashed" && at ? Math.floor(s.bet * at) : 0;
  const { sessions, globals } = await gameCollections();
  const res = await sessions.updateOne({ _id: s._id, version: s.version, status: "playing" } as never, {
    $set: { status: outcome, cashedAt: outcome === "cashed" ? at : null, payout, updatedAt: new Date() },
    $inc: { version: 1 },
  });
  if (!res.modifiedCount) return (await load(s.discordId))!;
  if (payout > 0) await credit(s.discordId, payout);
  else await addToJackpot(s.bet);
  await globals.updateOne({ _id: "crash_recent" } as never, { $push: { points: { $each: [s.crashAt], $slice: -HISTORY } } as never }, { upsert: true }).catch(() => undefined);
  const detail = outcome === "cashed" ? `Crash: cashed out at ${at!.toFixed(2)}x (crashed at ${s.crashAt.toFixed(2)}x)` : `Crash: 💥 at ${s.crashAt.toFixed(2)}x`;
  await recordGame(s.discordId, "crash", s.bet, payout, detail).catch(() => undefined);
  return { ...s, status: outcome, cashedAt: outcome === "cashed" ? at : null, payout, version: s.version + 1 } as CrashSession;
}

/** Settles a round whose time has run out: an auto cash-out it reached, or the crash. */
async function settle(s: CrashSession | null, now = Date.now()) {
  if (!s || s.status !== "playing") return s;
  const elapsed = now - new Date(s.startedAt).getTime();
  const crashMs = crashTimeFor(s.crashAt);
  if (s.auto && s.auto <= s.crashAt && s.crashAt > 1 && elapsed >= crashTimeFor(s.auto)) return finish(s, "cashed", s.auto);
  if (elapsed >= crashMs) return finish(s, "bust", null);
  return s;
}

export async function crashState(discordId: string) {
  const s = await settle(await load(discordId));
  const [balance, points, limits] = await Promise.all([getBalance(discordId), recent(), crashLimits()]);
  return { round: s ? view(s) : null, balance, recent: points, serverNow: Date.now(), limits };
}

export async function crashLimits() {
  const [min, max] = await Promise.all([economyNumber("casino.crashMinBet", CRASH_MIN_BET), economyNumber("casino.crashMaxBet", CRASH_MAX_BET)]);
  return { min, max };
}

export async function startCrash(discordId: string, rawBet: unknown, rawAuto: unknown) {
  const bet = Math.floor(Number(rawBet));
  const auto = rawAuto === null || rawAuto === undefined || rawAuto === "" ? null : Math.floor(Number(rawAuto) * 100) / 100;
  const { min, max } = await crashLimits();
  if (!Number.isFinite(bet) || bet < min) throw new GameError(`The minimum bet is ${min.toLocaleString()} leaves.`);
  if (bet > max) throw new GameError(`The most you can bet is ${max.toLocaleString()} leaves.`);
  if (auto !== null && (!Number.isFinite(auto) || auto < 1.01 || auto > CRASH_MAX)) throw new GameError(`Auto cash-out has to be between 1.01x and ${CRASH_MAX}x.`);

  const existing = await settle(await load(discordId));
  if (existing?.status === "playing") throw new GameError("Your rocket is still flying! Cash out or wait for it to crash.", 409);

  await charge(discordId, bet).catch(() => {
    throw new GameError(`You need ${bet.toLocaleString()} leaves for that bet.`);
  });
  const now = new Date();
  const fresh: CrashSession = { _id: sid(discordId), discordId, bet, crashAt: pickCrashPoint(), auto, status: "playing", cashedAt: null, payout: 0, version: (existing?.version ?? 0) + 1, startedAt: now, updatedAt: now };
  const { sessions } = await gameCollections();
  await sessions.replaceOne({ _id: fresh._id } as never, fresh as never, { upsert: true });
  // A 1.00x crash ends straight away
  const s = await settle(fresh);
  return { round: view(s!), balance: await getBalance(discordId), recent: await recent(), serverNow: Date.now() };
}

export async function cashOutCrash(discordId: string) {
  const now = Date.now();
  const s = await load(discordId);
  if (!s || s.status !== "playing") {
    const done = s ? view(s) : null;
    return { round: done, balance: await getBalance(discordId), recent: await recent(), serverNow: Date.now() };
  }
  const settled = await settle(s, now);
  if (settled && settled.status !== "playing") return { round: view(settled), balance: await getBalance(discordId), recent: await recent(), serverNow: Date.now() };
  const at = crashMultiplierAt(now - new Date(s.startedAt).getTime());
  const done = await finish(s, "cashed", Math.min(at, s.crashAt));
  return { round: view(done), balance: await getBalance(discordId), recent: await recent(), serverNow: Date.now() };
}
