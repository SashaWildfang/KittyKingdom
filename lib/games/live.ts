// Live games: the lobby of tables being played right now, spectating them, and viewer counts.
//
// Tables live in `web_game_sessions` ("bj:<discordId>" for blackjack, "sc:<discordId>" for the latest
// scratch-off ticket, "sl:<discordId>" for the latest slots spin). Nobody can watch their own table. Spectators only ever get the public view: the dealer's hole card, the deck and any
// unscratched cells stay hidden. A viewer is "watching" while their page keeps checking in; each check-in
// is a row in `web_game_viewers` that expires on its own. Members can hide their games from spectators
// (`web_games_private` on their bot users record); staff can still watch from the admin panel.

import type { Document } from "mongodb";
import { people } from "../admin-people";
import { view, type PublicTable, type Session } from "./blackjack";
import { gameCollections, GameError, userFilter } from "./core";
import { checkInTable as checkIn, viewerCounts } from "./viewers";

export { viewerCounts };
import { rouletteLive } from "./roulette";
import { TICKETS, type ScratchSession } from "./scratch";
import { getJackpot, type SlotsSession, type SpinResult } from "./slots";
import { minesView, type MinesSession, type PublicMines } from "./mines";

const BJ_IDLE_MS = 15 * 60_000;
const BJ_DONE_MS = 45_000;
const SC_IDLE_MS = 5 * 60_000;
const SC_DONE_MS = 30_000;
const SL_LIVE_MS = 60_000;
const MN_IDLE_MS = 10 * 60_000;
const MN_DONE_MS = 30_000;
const SL_DONE_MS = 3 * 60_000;

/** Members who asked not to be watched. */
async function privateIds(ids: string[]) {
  if (!ids.length) return new Set<string>();
  const { users } = await gameCollections();
  const rows = await users.find({ $or: ids.map((id) => userFilter(id)), web_games_private: true }, { projection: { discordId: 1 }, useBigInt64: true }).toArray();
  return new Set(rows.map((r) => String(r.discordId)));
}

export async function isPrivate(discordId: string) {
  return (await privateIds([discordId])).has(discordId);
}

export async function setPrivate(discordId: string, value: boolean) {
  const { users } = await gameCollections();
  await users.updateOne(userFilter(discordId), { $set: { web_games_private: value } });
  return { private: value };
}

// ---------- scratch-off tickets as live tables ----------

export type PublicScratch = {
  ticket: { id: string; name: string; icon: string; cost: number; colors: [string, string]; prizes: { symbol: string; payout: number }[] };
  /** null for cells still under the foil */
  cells: (string | null)[];
  finished: boolean;
  winSymbol: string | null;
  payout: number | null;
  startedAt: string;
};

function scratchView(s: ScratchSession): PublicScratch | null {
  const t = TICKETS.find((x) => x.id === s.ticket);
  if (!t) return null;
  const open = new Set(s.revealed);
  return {
    ticket: { id: t.id, name: t.name, icon: t.icon, cost: t.cost, colors: t.colors, prizes: t.prizes.map((p) => ({ symbol: p.symbol, payout: p.payout })) },
    cells: s.grid.map((sym, i) => (s.finished || open.has(i) ? sym : null)),
    finished: s.finished,
    winSymbol: s.finished ? s.winSymbol : null,
    payout: s.finished ? s.payout : null,
    startedAt: new Date(s.startedAt).toISOString(),
  };
}

export type PublicSlots = { bet: number; spins: number; results: SpinResult[]; payout: number; batch: number; updatedAt: string; jackpot: number };

async function slotsView(s: SlotsSession): Promise<PublicSlots> {
  return { bet: s.bet, spins: s.spins, results: s.results, payout: s.payout, batch: s.batch, updatedAt: new Date(s.updatedAt).toISOString(), jackpot: await getJackpot() };
}

function slotsStatusText(s: SlotsSession) {
  const net = s.payout - s.bet * s.spins;
  const what = s.results.some((r) => r.kind === "jackpot") ? "JACKPOT! " : "";
  const tail = net > 0 ? `Won +${net.toLocaleString()}` : net === 0 ? "Broke even" : `Lost ${Math.abs(net).toLocaleString()}`;
  return `${what}${s.spins > 1 ? `${s.spins} spins · ` : ""}${tail}`;
}

// ---------- the lobby ----------

export type LiveEntry = {
  id: string;
  game: "blackjack" | "scratchoff" | "slots" | "roulette" | "mines";
  player: { id: string; name: string; avatar: string | null };
  /** Total wagered on the table now (blackjack) or the ticket price */
  stake: number;
  status: string;
  live: boolean;
  viewers: number;
  updatedAt: string;
  ticket?: { name: string; icon: string };
};

function bjStatus(s: Session) {
  if (s.phase === "player") return s.hands.length > 1 ? `Playing two hands (hand ${s.index + 1})` : "Deciding…";
  const total = s.bets.reduce((a, b) => a + b, 0);
  const net = (s.payout ?? 0) - total;
  if (s.results?.includes("blackjack")) return `Blackjack! +${net.toLocaleString()}`;
  return net > 0 ? `Won +${net.toLocaleString()}` : net === 0 ? "Push" : `Lost ${Math.abs(net).toLocaleString()}`;
}

/** Tables being played right now (and ones that just finished). Staff also see members who hide their games;
 *  members never see their own. */
export async function liveList(opts: { staff?: boolean; viewer?: string } = {}): Promise<LiveEntry[]> {
  const { sessions } = await gameCollections();
  const now = Date.now();
  const docs = (await sessions
    .find({
      $or: [
        { _id: { $regex: "^bj:" }, phase: "player", updatedAt: { $gt: new Date(now - BJ_IDLE_MS) } },
        { _id: { $regex: "^bj:" }, phase: "done", updatedAt: { $gt: new Date(now - BJ_DONE_MS) } },
        { _id: { $regex: "^sc:" }, finished: false, updatedAt: { $gt: new Date(now - SC_IDLE_MS) } },
        { _id: { $regex: "^sc:" }, finished: true, updatedAt: { $gt: new Date(now - SC_DONE_MS) } },
        { _id: { $regex: "^sl:" }, updatedAt: { $gt: new Date(now - SL_DONE_MS) } },
        { _id: { $regex: "^mn:" }, status: "playing", updatedAt: { $gt: new Date(now - MN_IDLE_MS) } },
        { _id: { $regex: "^mn:" }, status: { $in: ["cashed", "bust"] }, updatedAt: { $gt: new Date(now - MN_DONE_MS) } },
      ],
    } as Document)
    .sort({ updatedAt: -1 })
    .limit(60)
    .toArray()) as unknown as (Session | ScratchSession | SlotsSession)[];
  const ids = Array.from(new Set(docs.map((d) => String(d.discordId))));
  const roulette = await rouletteLive().catch(() => null);
  const table: LiveEntry[] =
    roulette && roulette.players > 0
      ? [{ id: "rl:table", game: "roulette", player: { id: "", name: "Roulette table", avatar: null }, stake: roulette.total, status: `${roulette.players} ${roulette.players === 1 ? "player" : "players"} betting`, live: true, viewers: (await viewerCounts(["rl:table"]))["rl:table"] ?? 0, updatedAt: new Date().toISOString() }]
      : [];
  const [hidden, who, viewers] = await Promise.all([opts.staff ? Promise.resolve(new Set<string>()) : privateIds(ids), people(ids), viewerCounts(docs.map((d) => String(d._id)))]);
  return table.concat(docs
    .filter((d) => !hidden.has(String(d.discordId)) && (opts.staff || String(d.discordId) !== opts.viewer))
    .map((d): LiveEntry => {
      const id = String(d._id);
      const p = who[String(d.discordId)];
      const player = { id: String(d.discordId), name: p?.name ?? "A member", avatar: p?.avatar ?? null };
      if (id.startsWith("bj:")) {
        const s = d as Session;
        return { id, game: "blackjack", player, stake: s.bets.reduce((a, b) => a + b, 0), status: bjStatus(s), live: s.phase === "player", viewers: viewers[id] ?? 0, updatedAt: new Date(s.updatedAt).toISOString() };
      }
      if (id.startsWith("mn:")) {
        const s = d as unknown as MinesSession;
        const v = minesView(s);
        const status = s.status === "playing" ? `${s.revealed.length} gems · ${v.multiplier.toFixed(2)}x (${s.mines} mines)` : s.status === "bust" ? `Lost ${s.bet.toLocaleString()} · hit a mine` : `Won +${(s.payout - s.bet).toLocaleString()} · ${v.multiplier.toFixed(2)}x`;
        return { id, game: "mines", player, stake: s.bet, status, live: s.status === "playing", viewers: viewers[id] ?? 0, updatedAt: new Date(s.updatedAt).toISOString() };
      }
      if (id.startsWith("sl:")) {
        const s = d as SlotsSession;
        const live = now - new Date(s.updatedAt).getTime() < SL_LIVE_MS;
        return { id, game: "slots", player, stake: s.bet * s.spins, status: slotsStatusText(s), live, viewers: viewers[id] ?? 0, updatedAt: new Date(s.updatedAt).toISOString() };
      }
      const s = d as ScratchSession;
      const t = TICKETS.find((x) => x.id === s.ticket);
      const net = s.payout - (t?.cost ?? 0);
      return {
        id,
        game: "scratchoff",
        player,
        stake: t?.cost ?? 0,
        status: s.finished ? (s.payout > 0 ? (net > 0 ? `Won +${net.toLocaleString()}` : "Free ticket") : "No luck") : `Scratching… ${s.revealed.length}/9`,
        live: !s.finished,
        viewers: viewers[id] ?? 0,
        updatedAt: new Date(s.updatedAt).toISOString(),
        ticket: t ? { name: t.name, icon: t.icon } : undefined,
      };
    }));
}

// ---------- spectating ----------

export type Spectate = {
  id: string;
  game: "blackjack" | "scratchoff" | "slots" | "mines";
  player: { id: string; name: string; avatar: string | null };
  viewers: number;
  blackjack: PublicTable | null;
  scratch: PublicScratch | null;
  slots: PublicSlots | null;
  mines: PublicMines | null;
};

/** One table, as a spectator sees it, and counts the viewer as watching. Members can't watch their own table. */
export async function spectate(tableId: string, viewer: string, opts: { staff?: boolean } = {}): Promise<Spectate> {
  const m = /^(bj|sc|sl|mn):(\d{5,25})$/.exec(tableId);
  if (!m) throw new GameError("That table doesn't exist.", 404);
  const owner = m[2];
  if (!opts.staff && owner === viewer) throw new GameError("That's your own game. Go back to it to keep playing.", 400);
  if (!opts.staff && owner !== viewer && (await isPrivate(owner))) throw new GameError("This player keeps their games private.", 403);
  const { sessions } = await gameCollections();
  const doc = await sessions.findOne({ _id: tableId } as never);
  if (!doc) throw new GameError("That table is empty right now.", 404);
  if (owner !== viewer) await checkIn(tableId, viewer);
  const [who, viewers] = await Promise.all([people([owner]), viewerCounts([tableId])]);
  const p = who[owner];
  return {
    id: tableId,
    game: m[1] === "bj" ? "blackjack" : m[1] === "sc" ? "scratchoff" : m[1] === "mn" ? "mines" : "slots",
    player: { id: owner, name: p?.name ?? "A member", avatar: p?.avatar ?? null },
    viewers: viewers[tableId] ?? 0,
    blackjack: m[1] === "bj" ? view(doc as unknown as Session) : null,
    scratch: m[1] === "sc" ? scratchView(doc as unknown as ScratchSession) : null,
    slots: m[1] === "sl" ? await slotsView(doc as unknown as SlotsSession) : null,
    // The board itself stays hidden until the game is over
    mines: m[1] === "mn" ? minesView(doc as unknown as MinesSession) : null,
  };
}

/** How many people are watching my blackjack table, my ticket and my slot machine, and whether I hide my games. */
export async function myAudience(discordId: string) {
  const [counts, hidden] = await Promise.all([viewerCounts([`bj:${discordId}`, `sc:${discordId}`, `sl:${discordId}`, `mn:${discordId}`]), isPrivate(discordId)]);
  return { blackjack: counts[`bj:${discordId}`] ?? 0, scratch: counts[`sc:${discordId}`] ?? 0, slots: counts[`sl:${discordId}`] ?? 0, mines: counts[`mn:${discordId}`] ?? 0, private: hidden };
}
