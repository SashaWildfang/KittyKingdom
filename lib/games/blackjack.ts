// Blackjack for the website, with the same rules and payouts as the bot (Economy/cmds/blackjack.py):
// minimum bet 25, dealer hits until 17, natural blackjack pays 3:2, wins 1:1, pushes return the bet,
// double down on two cards, split two cards of equal value. Losing wagers feed the slots jackpot.
//
// The deck and the dealer's hole card never leave the server. A table lives in `web_game_sessions`
// (`_id: "bj:<discordId>"`); every move is applied with a version check so a double click or two tabs
// can't play the same move twice.

import { addToJackpot, charge, credit, gameCollections, GameError, getBalance, recordGame, shuffle } from "./core";

export const MIN_BET = 25;
export const MAX_BET = 1_000_000;
const BLACKJACK_PAYOUT = 2.5;
const WIN_PAYOUT = 2.0;
/** A table left mid-hand this long is forfeited (the bot times out after a minute). */
const ABANDON_MS = 24 * 60 * 60 * 1000;

export type Suit = "S" | "H" | "D" | "C";
export type Card = { rank: string; suit: Suit; value: number };
export type HandResult = "blackjack" | "win" | "dealer_bust" | "push" | "bust" | "loss" | "timeout";

type Session = {
  _id: string;
  discordId: string;
  deck: Card[];
  hands: Card[][];
  bets: number[];
  index: number;
  dealer: Card[];
  phase: "player" | "done";
  results?: HandResult[];
  payout?: number;
  version: number;
  createdAt: Date;
  updatedAt: Date;
};

export type PublicCard = Card | { hidden: true };
export type PublicTable = {
  phase: "player" | "done";
  hands: { cards: Card[]; value: number; bet: number; result: HandResult | null }[];
  index: number;
  dealer: { cards: PublicCard[]; value: number | null; shown: number };
  canDouble: boolean;
  canSplit: boolean;
  totalBet: number;
  payout: number | null;
  net: number | null;
};

const RANKS: [string, number][] = [["2", 2], ["3", 3], ["4", 4], ["5", 5], ["6", 6], ["7", 7], ["8", 8], ["9", 9], ["10", 10], ["J", 10], ["Q", 10], ["K", 10], ["A", 11]];
const SUITS: Suit[] = ["S", "H", "D", "C"];

function newDeck(): Card[] {
  return shuffle(SUITS.flatMap((suit) => RANKS.map(([rank, value]) => ({ rank, suit, value }))));
}

/** Best value of a hand (aces drop from 11 to 1 as needed). */
export function handValue(hand: Card[]) {
  let value = hand.reduce((s, c) => s + c.value, 0);
  let aces = hand.filter((c) => c.rank === "A").length;
  while (value > 21 && aces) {
    value -= 10;
    aces -= 1;
  }
  return value;
}

const sid = (discordId: string) => `bj:${discordId}`;

function view(s: Session): PublicTable {
  const done = s.phase === "done";
  const hand = s.hands[s.index] ?? [];
  const totalBet = s.bets.reduce((a, b) => a + b, 0);
  return {
    phase: s.phase,
    hands: s.hands.map((cards, i) => ({ cards, value: handValue(cards), bet: s.bets[i], result: s.results?.[i] ?? null })),
    index: s.index,
    dealer: done
      ? { cards: s.dealer, value: handValue(s.dealer), shown: s.dealer[0]?.value ?? 0 }
      : { cards: [s.dealer[0], { hidden: true }], value: null, shown: s.dealer[0]?.value ?? 0 },
    canDouble: !done && hand.length === 2,
    canSplit: !done && s.hands.length === 1 && hand.length === 2 && hand[0].value === hand[1].value,
    totalBet,
    payout: done ? (s.payout ?? 0) : null,
    net: done ? (s.payout ?? 0) - totalBet : null,
  };
}

async function load(discordId: string) {
  const { sessions } = await gameCollections();
  return (await sessions.findOne({ _id: sid(discordId) } as never)) as unknown as Session | null;
}

/** Saves a move only if nobody else changed the table since it was read. */
async function save(prev: Session, next: Session) {
  const { sessions } = await gameCollections();
  const res = await sessions.replaceOne({ _id: prev._id, version: prev.version } as never, { ...next, version: prev.version + 1, updatedAt: new Date() } as never);
  if (res.matchedCount !== 1) throw new GameError("That move was already played. Refreshing the table.", 409);
  next.version = prev.version + 1;
}

/** Plays out the dealer, settles every hand and pays out. */
async function finish(prev: Session, next: Session, forced?: HandResult) {
  const anyAlive = next.hands.some((h) => handValue(h) <= 21);
  if (!forced && anyAlive) while (handValue(next.dealer) < 17) next.dealer.push(next.deck.pop()!);
  const d = handValue(next.dealer);
  const results: HandResult[] = next.hands.map((h) => {
    if (forced) return forced;
    const p = handValue(h);
    if (p > 21) return "bust";
    if (d > 21) return "dealer_bust";
    if (p === d) return "push";
    if (p > d) return p === 21 && h.length === 2 && next.hands.length === 1 ? "blackjack" : "win";
    return "loss";
  });
  return settle(prev, next, results);
}

async function settle(prev: Session, next: Session, results: HandResult[]) {
  let payout = 0;
  results.forEach((r, i) => {
    const bet = next.bets[i];
    if (r === "blackjack") payout += Math.floor(bet * BLACKJACK_PAYOUT);
    else if (r === "win" || r === "dealer_bust") payout += Math.floor(bet * WIN_PAYOUT);
    else if (r === "push") payout += bet;
  });
  next.phase = "done";
  next.results = results;
  next.payout = payout;
  // Close the table first, so a payout can only ever happen once
  await save(prev, next);
  if (payout > 0) await credit(next.discordId, payout);
  const total = next.bets.reduce((a, b) => a + b, 0);
  if (payout < total) await addToJackpot(total - payout);
  await recordGame(next.discordId, "blackjack", total, payout, `BJ: ${next.hands.map((h) => h.map((c) => c.rank).join("")).join(" | ")}`);
}

export async function blackjackState(discordId: string) {
  const s = await load(discordId);
  return { table: s ? view(s) : null, balance: await getBalance(discordId) };
}

export async function startHand(discordId: string, rawBet: unknown) {
  const bet = Math.floor(Number(rawBet));
  if (!Number.isFinite(bet) || bet < MIN_BET) throw new GameError(`The minimum bet is ${MIN_BET} leaves.`);
  if (bet > MAX_BET) throw new GameError(`The maximum bet is ${MAX_BET.toLocaleString()} leaves.`);

  let existing = await load(discordId);
  if (existing?.phase === "player") {
    if (Date.now() - new Date(existing.updatedAt).getTime() < ABANDON_MS) throw new GameError("Finish your current hand first.", 409);
    // Left mid-hand for a day: forfeited, like the bot's timeout
    await settle(existing, structuredClone(existing), existing.hands.map(() => "timeout" as HandResult));
    existing = await load(discordId);
  }

  await charge(discordId, bet);
  const deck = newDeck();
  const hand = [deck.pop()!, deck.pop()!];
  const dealer = [deck.pop()!, deck.pop()!];
  const now = new Date();
  const fresh: Session = { _id: sid(discordId), discordId, deck, hands: [hand], bets: [bet], index: 0, dealer, phase: "player", version: (existing?.version ?? 0) + 1, createdAt: now, updatedAt: now };

  // Replace the finished table (only if it's still the one we read), or open the first one
  const { sessions } = await gameCollections();
  let placed = false;
  if (existing) {
    placed = (await sessions.replaceOne({ _id: fresh._id, version: existing.version, phase: "done" } as never, fresh as never)).matchedCount === 1;
  } else {
    placed = await sessions.insertOne(fresh as never).then(() => true, () => false);
  }
  if (!placed) {
    await credit(discordId, bet);
    throw new GameError("Another hand was just dealt. Refreshing the table.", 409);
  }

  // A natural ends the hand at once (push if the dealer has one too)
  if (handValue(hand) === 21) await settle(fresh, structuredClone(fresh), [handValue(dealer) === 21 ? "push" : "blackjack"]);
  return blackjackState(discordId);
}

export async function playMove(discordId: string, move: unknown) {
  const s = await load(discordId);
  if (!s || s.phase !== "player") throw new GameError("There's no hand in play. Deal a new one.", 409);
  const next: Session = structuredClone(s);
  const hand = next.hands[next.index];
  const advance = async () => {
    if (next.index < next.hands.length - 1) {
      next.index += 1;
      await save(s, next);
    } else {
      await finish(s, next);
    }
  };

  if (move === "hit") {
    hand.push(next.deck.pop()!);
    if (handValue(hand) > 21) await advance();
    else await save(s, next);
  } else if (move === "stand") {
    await advance();
  } else if (move === "double") {
    if (hand.length !== 2) throw new GameError("You can only double down on your first two cards.");
    const extra = next.bets[next.index];
    await charge(discordId, extra);
    next.bets[next.index] *= 2;
    hand.push(next.deck.pop()!);
    try {
      await advance();
    } catch (error) {
      await credit(discordId, extra);
      throw error;
    }
  } else if (move === "split") {
    if (!(next.hands.length === 1 && hand.length === 2 && hand[0].value === hand[1].value)) throw new GameError("You can only split two cards of the same value.");
    const extra = next.bets[0];
    await charge(discordId, extra);
    next.hands = [
      [hand[0], next.deck.pop()!],
      [hand[1], next.deck.pop()!],
    ];
    next.bets = [extra, extra];
    try {
      await save(s, next);
    } catch (error) {
      await credit(discordId, extra);
      throw error;
    }
  } else {
    throw new GameError("Unknown move.");
  }
  return blackjackState(discordId);
}
