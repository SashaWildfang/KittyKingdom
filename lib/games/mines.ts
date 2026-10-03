// Mines for the website: a 5×5 board with 1–24 hidden mines. Every gem you uncover raises the multiplier;
// cash out any time after your first gem, or hit a mine and lose the bet. Same rules as the bot's /mines:
// the multiplier is the fair odds of surviving that many picks minus a 1% house edge (a 99% return, the
// normal edge for mines), capped at 1,000x.
//
// Everything is decided on the server: the board is made with crypto randomness when the game starts and
// never leaves the server until the game is over. Each game is one record (`mn:<discordId>`) and every move is
// applied with a version check, so a double click or a second tab can't reveal twice or cash out twice.

import { addToJackpot, charge, credit, gameCollections, GameError, getBalance, recordGame, shuffle } from "./core";

export const MINES_TILES = 25;
export const MINES_MIN_BET = 25;
export const MINES_MAX_BET = 1_000_000;
export const MINES_HOUSE_EDGE = 0.01;
export const MINES_MAX_MULTIPLIER = 1000;

/** What the bet is worth after `picks` safe picks with `mines` mines on the board. */
export function minesMultiplier(picks: number, mines: number, tiles = MINES_TILES) {
  if (picks <= 0) return 1;
  let fair = 1;
  for (let i = 0; i < picks; i++) fair *= (tiles - i) / (tiles - mines - i);
  return Math.min(MINES_MAX_MULTIPLIER, Math.floor((1 - MINES_HOUSE_EDGE) * fair * 100) / 100);
}

export type MinesSession = {
  _id: string;
  discordId: string;
  bet: number;
  mines: number;
  board: number[]; // where the mines are (server only)
  revealed: number[]; // gems uncovered, in order
  status: "playing" | "cashed" | "bust";
  hit: number | null; // the mine that ended it
  payout: number;
  version: number;
  startedAt: Date;
  updatedAt: Date;
};

export type PublicMines = {
  gameId: number;
  bet: number;
  mines: number;
  revealed: number[];
  status: MinesSession["status"];
  multiplier: number;
  next: number | null;
  value: number;
  payout: number | null;
  hit: number | null;
  /** Only once the game is over */
  board: number[] | null;
};

const sid = (discordId: string) => `mn:${discordId}`;

export function minesView(s: MinesSession): PublicMines {
  const over = s.status !== "playing";
  const picks = s.revealed.length;
  const multiplier = minesMultiplier(picks, s.mines);
  const left = MINES_TILES - s.mines - picks;
  return {
    gameId: new Date(s.startedAt).getTime(),
    bet: s.bet,
    mines: s.mines,
    revealed: s.revealed,
    status: s.status,
    multiplier,
    next: !over && left > 0 ? minesMultiplier(picks + 1, s.mines) : null,
    value: Math.floor(s.bet * multiplier),
    payout: over ? s.payout : null,
    hit: s.hit,
    board: over ? s.board : null,
  };
}

async function load(discordId: string) {
  const { sessions } = await gameCollections();
  return (await sessions.findOne({ _id: sid(discordId) } as never)) as unknown as MinesSession | null;
}

/** Save a move, but only if nothing else changed the game since we read it. */
async function save(prev: MinesSession, next: MinesSession) {
  const { sessions } = await gameCollections();
  const res = await sessions.replaceOne({ _id: prev._id, version: prev.version } as never, { ...next, version: prev.version + 1, updatedAt: new Date() } as never);
  if (!res.modifiedCount) throw new GameError("That board changed in another tab. Refresh and try again.", 409);
  next.version = prev.version + 1;
}

export async function minesState(discordId: string) {
  const [s, balance] = await Promise.all([load(discordId), getBalance(discordId)]);
  return { game: s ? minesView(s) : null, balance };
}

export async function startMines(discordId: string, rawBet: unknown, rawMines: unknown) {
  const bet = Math.floor(Number(rawBet));
  const mines = Math.floor(Number(rawMines));
  if (!Number.isFinite(bet) || bet < MINES_MIN_BET) throw new GameError(`The minimum bet is ${MINES_MIN_BET} leaves.`);
  if (bet > MINES_MAX_BET) throw new GameError(`The most you can bet is ${MINES_MAX_BET.toLocaleString()} leaves.`);
  if (!Number.isFinite(mines) || mines < 1 || mines > MINES_TILES - 1) throw new GameError(`Pick between 1 and ${MINES_TILES - 1} mines.`);
  const existing = await load(discordId);
  if (existing?.status === "playing") throw new GameError("Finish your current board first (cash out or keep picking).", 409);

  await charge(discordId, bet).catch(() => {
    throw new GameError(`You need ${bet.toLocaleString()} leaves for that bet.`);
  });
  const board = shuffle(Array.from({ length: MINES_TILES }, (_, i) => i)).slice(0, mines).sort((a, b) => a - b);
  const now = new Date();
  const fresh: MinesSession = { _id: sid(discordId), discordId, bet, mines, board, revealed: [], status: "playing", hit: null, payout: 0, version: (existing?.version ?? 0) + 1, startedAt: now, updatedAt: now };
  const { sessions } = await gameCollections();
  await sessions.replaceOne({ _id: fresh._id } as never, fresh as never, { upsert: true });
  return { game: minesView(fresh), balance: await getBalance(discordId) };
}

async function finish(s: MinesSession, outcome: "cashed" | "bust", hit: number | null) {
  const payout = outcome === "cashed" ? Math.floor(s.bet * minesMultiplier(s.revealed.length, s.mines)) : 0;
  const next: MinesSession = { ...s, status: outcome, hit, payout };
  await save(s, next);
  if (payout > 0) await credit(s.discordId, payout);
  else await addToJackpot(s.bet);
  const detail = outcome === "bust" ? `Mines: 💥 after ${s.revealed.length} gems (${s.mines} mines)` : `Mines: ${s.revealed.length} gems, ${(payout / s.bet).toFixed(2)}x (${s.mines} mines)`;
  await recordGame(s.discordId, "mines", s.bet, payout, detail).catch(() => undefined);
  return next;
}

export async function revealTile(discordId: string, rawTile: unknown) {
  const tile = Math.floor(Number(rawTile));
  if (!Number.isInteger(tile) || tile < 0 || tile >= MINES_TILES) throw new GameError("Pick a tile on the board.");
  const s = await load(discordId);
  if (!s || s.status !== "playing") throw new GameError("Start a new board first.", 409);
  if (s.revealed.includes(tile)) return { game: minesView(s), balance: await getBalance(discordId) };

  let result: MinesSession;
  if (s.board.includes(tile)) {
    result = await finish(s, "bust", tile);
  } else {
    const next: MinesSession = { ...s, revealed: [...s.revealed, tile] };
    // Every gem found: the board is cleared, so it cashes out by itself
    if (next.revealed.length === MINES_TILES - s.mines) {
      await save(s, next);
      result = await finish(next, "cashed", null);
    } else {
      await save(s, next);
      result = next;
    }
  }
  return { game: minesView(result), balance: await getBalance(discordId) };
}

export async function cashOutMines(discordId: string) {
  const s = await load(discordId);
  if (!s || s.status !== "playing") throw new GameError("There's nothing to cash out.", 409);
  if (!s.revealed.length) throw new GameError("Find at least one gem before cashing out.");
  const done = await finish(s, "cashed", null);
  return { game: minesView(done), balance: await getBalance(discordId) };
}
