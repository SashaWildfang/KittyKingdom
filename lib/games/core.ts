// Shared plumbing for the website's casino games (Games tab). Everything runs on the server: decks and
// tickets are generated here with crypto randomness, and leaves move in single atomic updates on the
// bot's users record, so the website and the Discord bot share one balance, one set of gambling stats
// (`gambling` / `gambling_logs`) and the same slots jackpot (`globals._id = "casino_jackpot"`).

import { randomInt } from "node:crypto";
import { Long, type Document } from "mongodb";
import { getBotCollection } from "../mongodb";
import { seasonal } from "../season-store";

export class GameError extends Error {
  constructor(message: string, public status = 400) {
    // Messages are written with the autumn words ("leaves"); the season swaps them
    super(seasonal(message));
  }
}

const BIG = { useBigInt64: true } as const;
export const num = (v: unknown) => (typeof v === "bigint" ? Number(v) : typeof v === "number" ? v : v instanceof Long ? v.toNumber() : Number(v ?? 0) || 0);
const toLong = (id: string) => Long.fromString(id);
/** The bot stores Discord ids as 64-bit integers; older website writes used strings. */
export const userFilter = (discordId: string) => ({ discordId: { $in: [toLong(discordId), discordId] } });

export async function gameCollections() {
  const [users, gambling, logs, globals, sessions] = await Promise.all([
    getBotCollection("users"),
    getBotCollection("gambling"),
    getBotCollection("gambling_logs"),
    getBotCollection("globals"),
    getBotCollection("web_game_sessions"),
  ]);
  return { users, gambling, logs, globals, sessions };
}

export async function getBalance(discordId: string) {
  const { users } = await gameCollections();
  const doc = await users.findOne(userFilter(discordId), { projection: { balance: 1 }, ...BIG });
  return num(doc?.balance);
}

/** Takes `amount` leaves only if the member has them (one atomic step). Returns the new balance. */
export async function charge(discordId: string, amount: number, extra: Document = {}) {
  const { users } = await gameCollections();
  const doc = await users.findOneAndUpdate(
    { ...userFilter(discordId), balance: { $gte: amount } },
    { $inc: { balance: -amount }, ...extra },
    { returnDocument: "after", projection: { balance: 1 }, ...BIG },
  );
  if (!doc) throw new GameError(`You need ${amount.toLocaleString()} leaves for that.`);
  return num(doc.balance);
}

/** Pays out leaves. Returns the new balance. */
export async function credit(discordId: string, amount: number) {
  const { users } = await gameCollections();
  if (amount <= 0) return getBalance(discordId);
  const doc = await users.findOneAndUpdate(userFilter(discordId), { $inc: { balance: amount } }, { returnDocument: "after", projection: { balance: 1 }, ...BIG });
  return num(doc?.balance);
}

export const BASE_JACKPOT = 100_000;

/** Losing wagers feed the slots jackpot, exactly like the bot (which starts it at 100,000). */
export async function addToJackpot(amount: number) {
  if (amount <= 0) return;
  const { globals } = await gameCollections();
  await globals.updateOne({ _id: "casino_jackpot" } as never, { $setOnInsert: { amount: BASE_JACKPOT } }, { upsert: true });
  await globals.updateOne({ _id: "casino_jackpot" } as never, { $inc: { amount } });
}

/** Records a finished game in the same stats and log the bot keeps (`/gamblingstats`, My Stats). */
export async function recordGame(discordId: string, game: "blackjack" | "scratchoff" | "mines", spent: number, won: number, symbols: string) {
  const { gambling, logs } = await gameCollections();
  const id = toLong(discordId);
  const net = won - spent;
  const now = new Date();
  const stats = await gambling.findOne({ discordId: id }, BIG);
  const set: Document = {
    biggest_win: Math.max(num(stats?.biggest_win), won),
    biggest_loss: Math.min(num(stats?.biggest_loss), net),
  };
  if (net > 0) set.last_win = { amount: net, symbols, timestamp: now };
  else if (net < 0) set.last_loss = { amount: net, symbols, timestamp: now };
  await gambling.updateOne({ discordId: id }, { $inc: { total_spent: spent, total_won: won, net_profit: net, total_spins: 1 }, $set: set }, { upsert: true });
  await logs.insertOne({ discordId: id, spent, won, net, symbols, timestamp: now, game, source: "website" });
}

/** Fisher–Yates with a cryptographic RNG. */
export function shuffle<T>(items: T[]) {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** A uniform random float in [0, 1). */
export const random = () => randomInt(2 ** 30) / 2 ** 30;
