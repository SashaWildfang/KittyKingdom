// Live roulette: one shared single-zero (European) table. Rounds run on the clock, so every member sees
// the same spin: bets are open for BET_MS, the wheel spins for SPIN_MS, and the result shows for SHOW_MS
// before the next round opens. No server process is needed: whoever loads the table after a round closes
// draws its number (once, stored) and settles it.
//
// Money safety:
//  - All of a member's bets for a round live in one record (`roulette_stakes`, "<round>:<discordId>").
//    Placing a bet is a single conditional update on it: refused once the round is settled or past the
//    limits. The leaves are taken first (atomically) and given back if that update is refused.
//  - The winning number is drawn with crypto randomness only after betting closes (plus a grace gap), and
//    bets and cancels are only accepted while betting is open, so nobody can bet knowing the number.
//  - Settling claims the record (settled: false → true) in one step before paying, so a round can never
//    pay twice, even with many members loading the table at the same moment.
//  - Standard single-zero payouts (house edge 2.7%); integer amounts with per-spot and per-round limits.

import { randomInt } from "node:crypto";
import { Long, type Document } from "mongodb";
import { people } from "../admin-people";
import { getBotCollection } from "../mongodb";
import { addToJackpot, charge, credit, gameCollections, GameError, getBalance, num } from "./core";
import { checkInTable, viewerCounts } from "./viewers";

export const BET_MS = 15_000;
export const SPIN_MS = 7_000;
export const SHOW_MS = 4_000;
export const ROUND_MS = BET_MS + SPIN_MS + SHOW_MS;
/** The number is drawn this long after betting closes, so a bet that squeezed in at the buzzer is still written first. */
const GRACE_MS = 1_200;

export const MIN_CHIP = 25;
export const MAX_STRAIGHT = 10_000;
export const MAX_OUTSIDE = 50_000;
export const MAX_ROUND = 100_000;

export const RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
export const colorOf = (n: number) => (n === 0 ? "green" : RED.has(n) ? "red" : "black");

/** Bet spots: what they cover and what they pay (total returned per leaf, stake included). */
export type Spot = { key: string; label: string; covers: (n: number) => boolean; returns: number; straight: boolean };
const outside = (key: string, label: string, covers: (n: number) => boolean, returns: number): Spot => ({ key, label, covers, returns, straight: false });
export const SPOTS: Spot[] = [
  ...Array.from({ length: 37 }, (_, n): Spot => ({ key: `n${n}`, label: String(n), covers: (x) => x === n, returns: 36, straight: true })),
  outside("red", "Red", (n) => RED.has(n), 2),
  outside("black", "Black", (n) => n > 0 && !RED.has(n), 2),
  outside("odd", "Odd", (n) => n > 0 && n % 2 === 1, 2),
  outside("even", "Even", (n) => n > 0 && n % 2 === 0, 2),
  outside("low", "1 to 18", (n) => n >= 1 && n <= 18, 2),
  outside("high", "19 to 36", (n) => n >= 19, 2),
  outside("d1", "1st 12", (n) => n >= 1 && n <= 12, 3),
  outside("d2", "2nd 12", (n) => n >= 13 && n <= 24, 3),
  outside("d3", "3rd 12", (n) => n >= 25, 3),
  outside("c1", "Column 1", (n) => n > 0 && n % 3 === 1, 3),
  outside("c2", "Column 2", (n) => n > 0 && n % 3 === 2, 3),
  outside("c3", "Column 3", (n) => n > 0 && n % 3 === 0, 3),
];
const spotByKey = new Map(SPOTS.map((s) => [s.key, s]));

export const roundOf = (t: number) => Math.floor(t / ROUND_MS);
export const roundTimes = (round: number) => {
  const startAt = round * ROUND_MS;
  return { startAt, closeAt: startAt + BET_MS, spinEndAt: startAt + BET_MS + SPIN_MS, endAt: startAt + ROUND_MS };
};

type Stake = { _id: string; round: number; discordId: string; bets: Record<string, number>; total: number; settled: boolean; payout?: number; at: Date };
type RoundDoc = { _id: number; number: number; at: Date };

let indexed: Promise<unknown> | null = null;
async function cols() {
  const [stakes, rounds] = await Promise.all([getBotCollection("roulette_stakes"), getBotCollection("roulette_rounds")]);
  indexed ??= Promise.all([stakes.createIndex({ round: 1 }), stakes.createIndex({ settled: 1, round: 1 })]).catch(() => undefined);
  await indexed;
  return { stakes, rounds };
}

/** The round's winning number: drawn once, the first time it's needed after betting (and the grace gap) closes. */
async function resultFor(round: number, now: number): Promise<number | null> {
  const { rounds } = await cols();
  const existing = (await rounds.findOne({ _id: round } as never)) as unknown as RoundDoc | null;
  if (existing) return existing.number;
  if (now < roundTimes(round).closeAt + GRACE_MS) return null;
  const number = randomInt(37);
  try {
    await rounds.insertOne({ _id: round, number, at: new Date() } as never);
    return number;
  } catch {
    // Someone else drew it at the same moment: theirs stands
    const doc = (await rounds.findOne({ _id: round } as never)) as unknown as RoundDoc | null;
    return doc ? doc.number : null;
  }
}

const payoutOf = (bets: Record<string, number>, number: number) =>
  Object.entries(bets).reduce((sum, [key, amount]) => {
    const spot = spotByKey.get(key);
    return spot && spot.covers(number) ? sum + Math.floor(num(amount)) * spot.returns : sum;
  }, 0);

/** Settles every member's bets on closed rounds (each record exactly once). */
async function settleDue(now: number) {
  const { stakes } = await cols();
  const { gambling, logs } = await gameCollections();
  const current = roundOf(now);
  const due = (await stakes.distinct("round", { settled: false, round: { $lte: current } })) as number[];
  for (const round of due) {
    const number = await resultFor(round, now);
    if (number === null) continue;
    for (;;) {
      // Claim one unsettled record, then pay it
      const claimed = (await stakes.findOneAndUpdate({ round, settled: false } as Document, { $set: { settled: true, number } }, { returnDocument: "after" })) as unknown as Stake | null;
      if (!claimed) break;
      if (!(claimed.total > 0)) continue;
      const payout = payoutOf(claimed.bets, number);
      await stakes.updateOne({ _id: claimed._id } as never, { $set: { payout } });
      if (payout > 0) await credit(claimed.discordId, payout);
      if (claimed.total > payout) await addToJackpot(claimed.total - payout);
      const id = Long.fromString(claimed.discordId);
      const net = payout - claimed.total;
      const symbols = `Roulette: ${number} ${colorOf(number)} · ${Object.keys(claimed.bets)
        .map((k) => spotByKey.get(k)?.label ?? k)
        .join(", ")}`;
      const stats = await gambling.findOne({ discordId: id }, { useBigInt64: true });
      const set: Document = { biggest_win: Math.max(num(stats?.biggest_win), payout), biggest_loss: Math.min(num(stats?.biggest_loss), net) };
      if (net > 0) set.last_win = { amount: net, symbols, timestamp: new Date() };
      else if (net < 0) set.last_loss = { amount: net, symbols, timestamp: new Date() };
      await gambling.updateOne({ discordId: id }, { $inc: { total_spent: claimed.total, total_won: payout, net_profit: net, total_spins: 1 }, $set: set }, { upsert: true });
      await logs.insertOne({ discordId: id, spent: claimed.total, won: payout, net, symbols, timestamp: new Date(), game: "roulette", source: "website" });
    }
  }
}

/** Places chips on a spot for the current round. */
export async function placeBet(discordId: string, rawSpot: unknown, rawAmount: unknown) {
  const now = Date.now();
  const round = roundOf(now);
  const { closeAt } = roundTimes(round);
  if (now >= closeAt) throw new GameError("No more bets! Wait for the next round.", 409);
  const spot = typeof rawSpot === "string" ? spotByKey.get(rawSpot) : undefined;
  if (!spot) throw new GameError("Pick a spot on the table.");
  const amount = Math.floor(Number(rawAmount));
  if (!Number.isFinite(amount) || amount < MIN_CHIP) throw new GameError(`The smallest chip is ${MIN_CHIP} leaves.`);
  const cap = spot.straight ? MAX_STRAIGHT : MAX_OUTSIDE;
  if (amount > cap) throw new GameError(`The most on one ${spot.straight ? "number" : "spot"} is ${cap.toLocaleString()} leaves.`);

  await charge(discordId, amount).catch(() => {
    throw new GameError("You don't have enough leaves for that chip.");
  });
  const { stakes } = await cols();
  const _id = `${round}:${discordId}`;
  const field = `bets.${spot.key}`;
  try {
    const doc = await stakes.findOneAndUpdate(
      {
        _id,
        settled: { $ne: true },
        total: { $not: { $gt: MAX_ROUND - amount } },
        [field]: { $not: { $gt: cap - amount } },
      } as Document,
      { $inc: { total: amount, [field]: amount }, $setOnInsert: { round, discordId, settled: false, at: new Date() } },
      { upsert: true, returnDocument: "after" },
    );
    if (!doc) throw new Error("refused");
    // Betting closed while this was being written? Take it back (the number isn't drawn until after the grace gap)
    if (Date.now() >= closeAt + GRACE_MS / 2) {
      const undo = await stakes.updateOne({ _id, settled: false, [field]: { $gte: amount } } as Document, { $inc: { total: -amount, [field]: -amount } });
      if (undo.modifiedCount) await credit(discordId, amount);
      throw new GameError("No more bets! Wait for the next round.", 409);
    }
    return { placed: true, mine: (doc as unknown as Stake).bets, total: (doc as unknown as Stake).total, balance: await getBalance(discordId) };
  } catch (error) {
    if (error instanceof GameError) throw error;
    // Over a limit, or the round already settled: give the chip back
    await credit(discordId, amount);
    throw new GameError(`That's over the table limit (${MAX_ROUND.toLocaleString()} a round, ${cap.toLocaleString()} on one ${spot.straight ? "number" : "spot"}).`);
  }
}

/** Takes all of your chips back off the table (only while betting is open). */
export async function clearBets(discordId: string) {
  const now = Date.now();
  const round = roundOf(now);
  if (now >= roundTimes(round).closeAt) throw new GameError("Bets are locked in for this spin.", 409);
  const { stakes } = await cols();
  const doc = (await stakes.findOneAndDelete({ _id: `${round}:${discordId}`, settled: false } as Document)) as unknown as Stake | null;
  if (doc && doc.total > 0) await credit(discordId, doc.total);
  return { cleared: doc?.total ?? 0, balance: await getBalance(discordId) };
}

export type TableBet = { player: { id: string; name: string; avatar: string | null }; bets: Record<string, number>; total: number };
export type RoundResult = { round: number; number: number; color: string; players: (TableBet & { payout: number; net: number })[] };

/** Everything the table shows: the clock, everyone's chips, the result, the last round's winners and losers. */
export async function rouletteState(discordId: string | null, opts: { watch?: boolean } = {}) {
  const now = Date.now();
  await settleDue(now).catch((e) => console.error("Roulette settle failed", e));
  const round = roundOf(now);
  const times = roundTimes(round);
  const { stakes, rounds } = await cols();
  const [current, number, history, prevStakes] = await Promise.all([
    stakes.find({ round } as Document).toArray() as unknown as Promise<Stake[]>,
    now >= times.closeAt + GRACE_MS ? resultFor(round, now) : Promise.resolve(null),
    rounds.find({ _id: { $lt: round } } as Document).sort({ _id: -1 }).limit(18).toArray() as unknown as Promise<RoundDoc[]>,
    stakes.find({ round: round - 1 } as Document).toArray() as unknown as Promise<Stake[]>,
  ]);
  // The winners and losers are only shown once the ball has landed
  const showNow = number !== null && now >= times.spinEndAt;
  const resultStakes = showNow ? current : prevStakes;
  const resultRound = showNow ? round : round - 1;
  const resultNumber = showNow ? number : history.find((h) => h._id === round - 1)?.number ?? null;

  const ids = Array.from(new Set([...current, ...resultStakes].map((s) => s.discordId)));
  if (discordId) await checkInTable("rl:table", discordId).catch(() => undefined);
  const [who, viewers, balance] = await Promise.all([people(ids), viewerCounts(["rl:table"]), discordId && !opts.watch ? getBalance(discordId) : Promise.resolve(null)]);
  const person = (id: string) => ({ id, name: who[id]?.name ?? "A member", avatar: who[id]?.avatar ?? null });

  const last: RoundResult | null =
    resultNumber === null
      ? null
      : {
          round: resultRound,
          number: resultNumber,
          color: colorOf(resultNumber),
          players: resultStakes
            .filter((s) => s.total > 0)
            .map((s) => {
              const payout = s.settled && typeof s.payout === "number" ? s.payout : payoutOf(s.bets, resultNumber);
              return { player: person(s.discordId), bets: s.bets, total: s.total, payout, net: payout - s.total };
            })
            .sort((a, b) => b.net - a.net),
        };

  return {
    now,
    round,
    ...times,
    phase: now < times.closeAt ? "betting" : now < times.spinEndAt ? "spinning" : "result",
    number,
    table: current.filter((s) => s.total > 0).map((s): TableBet => ({ player: person(s.discordId), bets: s.bets, total: s.total })),
    mine: discordId ? current.find((s) => s.discordId === discordId)?.bets ?? {} : {},
    history: history.map((h) => ({ round: h._id, number: h.number, color: colorOf(h.number) })),
    last,
    viewers: viewers["rl:table"] ?? 0,
    balance,
  };
}

/** For the Live lobby: the roulette table, while anyone has chips down. */
export async function rouletteLive() {
  const now = Date.now();
  const round = roundOf(now);
  const { stakes } = await cols();
  const rows = (await stakes.find({ round } as Document).toArray()) as unknown as Stake[];
  const players = rows.filter((s) => s.total > 0);
  return { players: players.length, total: players.reduce((a, s) => a + s.total, 0), round };
}
