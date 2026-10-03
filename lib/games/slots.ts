// Slots for the website, with the same machine as the bot's /slots (Economy/cmds/slots.py): 12% of spins
// are a triple (which paw is weighted), 26% a pair (bet back), 62% three different paws (about a 95% return). Three gold mice
// win the shared progressive jackpot; every losing spin feeds it. Up to 25 spins at a time (Nitro
// boosters, like the bot). The latest batch is kept as `sl:<discordId>` so it can be watched live.

import { Long } from "mongodb";
import { getMemberRoleIds } from "../discord-member";
import { addToJackpot, BASE_JACKPOT, charge, credit, gameCollections, GameError, getBalance, num, random, userFilter } from "./core";
import { PAIR_CHANCE, SLOT_SYMBOLS, TRIPLE_CHANCE, type SlotSymbol } from "./slot-symbols";

export { SLOT_SYMBOLS, type SlotSymbol } from "./slot-symbols";

export const SLOTS_MIN_BET = 50;
export const SLOTS_MAX_SPINS = 25;
const NITRO_ROLE_ID = "1360260086500561237";

const byId = new Map(SLOT_SYMBOLS.map((s) => [s.id, s]));

function weighted() {
  const total = SLOT_SYMBOLS.reduce((a, s) => a + s.weight, 0);
  let roll = random() * total;
  for (const s of SLOT_SYMBOLS) {
    roll -= s.weight;
    if (roll < 0) return s;
  }
  return SLOT_SYMBOLS[0];
}

const pickOne = <T>(list: T[]) => list[Math.floor(random() * list.length)];

function sample3() {
  const pool = SLOT_SYMBOLS.slice();
  const out: SlotSymbol[] = [];
  while (out.length < 3) out.push(pool.splice(Math.floor(random() * pool.length), 1)[0]);
  return out;
}

/** One spin, exactly like the bot's generate_spin. */
function generate(): SlotSymbol[] {
  const roll = random();
  if (roll < TRIPLE_CHANCE) {
    const s = weighted();
    return [s, s, s];
  }
  if (roll < TRIPLE_CHANCE + PAIR_CHANCE) {
    const s = weighted();
    const other = pickOne(SLOT_SYMBOLS.filter((x) => x.id !== s.id));
    const reels = [s, s, other];
    const at = Math.floor(random() * 3);
    [reels[at], reels[2]] = [reels[2], reels[at]];
    return reels;
  }
  return sample3();
}

export type SpinKind = "jackpot" | "triple" | "pair" | "loss";
export type SpinResult = { reels: string[]; payout: number; kind: SpinKind };

export type SlotsSession = {
  _id: string;
  discordId: string;
  bet: number;
  spins: number;
  results: SpinResult[];
  payout: number;
  batch: number;
  startedAt: Date;
  updatedAt: Date;
};

async function isNitro(discordId: string) {
  const roles = await getMemberRoleIds(discordId).catch(() => null);
  return Boolean(roles?.includes(NITRO_ROLE_ID));
}

export async function getJackpot() {
  const { globals } = await gameCollections();
  const doc = await globals.findOne({ _id: "casino_jackpot" } as never);
  return doc ? num(doc.amount) : BASE_JACKPOT;
}

export async function slotsStatus(discordId: string) {
  const { users } = await gameCollections();
  const [doc, nitro, jackpot] = await Promise.all([users.findOne(userFilter(discordId), { projection: { balance: 1 }, useBigInt64: true }), isNitro(discordId), getJackpot()]);
  return { balance: num(doc?.balance), nitro, jackpot, maxSpins: nitro ? SLOTS_MAX_SPINS : 1 };
}

/** Takes the whole jackpot (and resets it) in one step, so two winners can't both get it. */
async function claimJackpot() {
  const { globals } = await gameCollections();
  const before = await globals.findOneAndUpdate({ _id: "casino_jackpot" } as never, { $set: { amount: BASE_JACKPOT } }, { upsert: true, returnDocument: "before" });
  return before ? num(before.amount) : BASE_JACKPOT;
}

export async function spinSlots(discordId: string, rawBet: unknown, rawSpins: unknown) {
  const bet = Math.floor(Number(rawBet));
  const spins = Math.floor(Number(rawSpins ?? 1));
  if (!Number.isFinite(bet) || bet < SLOTS_MIN_BET) throw new GameError(`The minimum bet is ${SLOTS_MIN_BET} leaves a spin.`);
  if (bet > 10_000_000) throw new GameError("That bet is too big.");
  if (!Number.isFinite(spins) || spins < 1 || spins > SLOTS_MAX_SPINS) throw new GameError(`You can spin 1 to ${SLOTS_MAX_SPINS} times at once.`);
  if (spins > 1 && !(await isNitro(discordId))) throw new GameError("Multi-spin is for Nitro boosters.", 403);

  const cost = bet * spins;
  await charge(discordId, cost).catch(() => {
    throw new GameError(`You need ${cost.toLocaleString()} leaves for that.`);
  });

  const { gambling, logs, sessions } = await gameCollections();
  const results: SpinResult[] = [];
  let lost = 0;
  for (let i = 0; i < spins; i++) {
    const reels = generate();
    const [a, b, c] = reels;
    let payout = 0;
    let kind: SpinKind = "loss";
    if (a.id === b.id && b.id === c.id) {
      if (a.payout === "jackpot") {
        kind = "jackpot";
        payout = await claimJackpot();
      } else {
        kind = "triple";
        payout = Math.floor(bet * a.payout);
      }
    } else if (a.id === b.id || b.id === c.id || a.id === c.id) {
      kind = "pair";
      payout = bet;
    } else lost += bet;
    results.push({ reels: reels.map((s) => s.id), payout, kind });
  }

  const won = results.reduce((s, r) => s + r.payout, 0);
  await addToJackpot(lost);
  const balance = won > 0 ? await credit(discordId, won) : null;

  // Same stats and log rows as the bot (symbols in its format), tagged as website slots
  const now = new Date();
  const id = Long.fromString(discordId);
  const nets = results.map((r) => r.payout - bet);
  const stats = await gambling.findOne({ discordId: id }, { useBigInt64: true });
  const set: Record<string, unknown> = {
    biggest_win: Math.max(num(stats?.biggest_win), ...results.map((r) => r.payout)),
    biggest_loss: Math.min(num(stats?.biggest_loss), ...nets),
  };
  const symbolsOf = (r: SpinResult) => r.reels.map((x) => byId.get(x)!.emoji).join(" | ");
  const lastWin = [...results].reverse().find((r) => r.payout > bet);
  const lastLoss = [...results].reverse().find((r) => r.payout < bet);
  if (lastWin) set.last_win = { amount: lastWin.payout - bet, symbols: symbolsOf(lastWin), timestamp: now };
  if (lastLoss) set.last_loss = { amount: lastLoss.payout - bet, symbols: symbolsOf(lastLoss), timestamp: now };
  await gambling.updateOne({ discordId: id }, { $inc: { total_spent: cost, total_won: won, net_profit: won - cost, total_spins: spins }, $set: set }, { upsert: true });
  await logs.insertMany(results.map((r) => ({ discordId: id, spent: bet, won: r.payout, net: r.payout - bet, symbols: symbolsOf(r), timestamp: now, game: "slots", source: "website" })));

  // The machine as spectators see it
  const prev = (await sessions.findOne({ _id: `sl:${discordId}` } as never)) as unknown as SlotsSession | null;
  const session: SlotsSession = {
    _id: `sl:${discordId}`,
    discordId,
    bet,
    spins,
    results,
    payout: won,
    batch: (prev?.batch ?? 0) + 1,
    startedAt: prev && now.getTime() - new Date(prev.updatedAt).getTime() < 10 * 60_000 ? prev.startedAt : now,
    updatedAt: now,
  };
  await sessions.replaceOne({ _id: session._id } as never, session as never, { upsert: true }).catch(() => undefined);

  const [jackpot, finalBalance] = await Promise.all([getJackpot(), balance ?? getBalance(discordId)]);
  return { results, bet, spins, cost, payout: won, balance: finalBalance, jackpot, batch: session.batch };
}
