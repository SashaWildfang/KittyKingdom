// Live games: the lobby of tables being played right now, spectating them, and viewer counts.
//
// Tables live in `web_game_sessions` ("bj:<discordId>" for blackjack, "sc:<discordId>" for the latest
// scratch-off ticket). Spectators only ever get the public view: the dealer's hole card, the deck and any
// unscratched cells stay hidden. A viewer is "watching" while their page keeps checking in; each check-in
// is a row in `web_game_viewers` that expires on its own. Members can hide their games from spectators
// (`web_games_private` on their bot users record); staff can still watch from the admin panel.

import type { Document } from "mongodb";
import { people } from "../admin-people";
import { getBotCollection } from "../mongodb";
import { view, type PublicTable, type Session } from "./blackjack";
import { gameCollections, GameError, num, userFilter } from "./core";
import { TICKETS, type ScratchSession } from "./scratch";

const VIEWER_TTL_MS = 12_000;
const BJ_IDLE_MS = 15 * 60_000;
const BJ_DONE_MS = 45_000;
const SC_IDLE_MS = 5 * 60_000;
const SC_DONE_MS = 30_000;

let indexed: Promise<unknown> | null = null;
async function viewersCol() {
  const col = await getBotCollection("web_game_viewers");
  indexed ??= col.createIndex({ at: 1 }, { expireAfterSeconds: 120 }).catch(() => undefined);
  await indexed;
  return col;
}

/** How many people are watching each table right now. */
export async function viewerCounts(tables: string[]) {
  if (!tables.length) return {} as Record<string, number>;
  const col = await viewersCol();
  const rows = await col.aggregate([{ $match: { table: { $in: tables }, at: { $gt: new Date(Date.now() - VIEWER_TTL_MS) } } }, { $group: { _id: "$table", n: { $sum: 1 } } }]).toArray();
  return Object.fromEntries(rows.map((r) => [String(r._id), num(r.n)])) as Record<string, number>;
}

async function checkIn(table: string, viewer: string) {
  const col = await viewersCol();
  await col.updateOne({ _id: `${table}:${viewer}` } as never, { $set: { table, viewer, at: new Date() } }, { upsert: true });
}

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

// ---------- the lobby ----------

export type LiveEntry = {
  id: string;
  game: "blackjack" | "scratchoff";
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

/** Tables being played right now (and ones that just finished). Staff also see members who hide their games. */
export async function liveList(opts: { staff?: boolean } = {}): Promise<LiveEntry[]> {
  const { sessions } = await gameCollections();
  const now = Date.now();
  const docs = (await sessions
    .find({
      $or: [
        { _id: { $regex: "^bj:" }, phase: "player", updatedAt: { $gt: new Date(now - BJ_IDLE_MS) } },
        { _id: { $regex: "^bj:" }, phase: "done", updatedAt: { $gt: new Date(now - BJ_DONE_MS) } },
        { _id: { $regex: "^sc:" }, finished: false, updatedAt: { $gt: new Date(now - SC_IDLE_MS) } },
        { _id: { $regex: "^sc:" }, finished: true, updatedAt: { $gt: new Date(now - SC_DONE_MS) } },
      ],
    } as Document)
    .sort({ updatedAt: -1 })
    .limit(60)
    .toArray()) as unknown as (Session | ScratchSession)[];
  const ids = Array.from(new Set(docs.map((d) => String(d.discordId))));
  const [hidden, who, viewers] = await Promise.all([opts.staff ? Promise.resolve(new Set<string>()) : privateIds(ids), people(ids), viewerCounts(docs.map((d) => String(d._id)))]);
  return docs
    .filter((d) => !hidden.has(String(d.discordId)))
    .map((d): LiveEntry => {
      const id = String(d._id);
      const p = who[String(d.discordId)];
      const player = { id: String(d.discordId), name: p?.name ?? "A member", avatar: p?.avatar ?? null };
      if (id.startsWith("bj:")) {
        const s = d as Session;
        return { id, game: "blackjack", player, stake: s.bets.reduce((a, b) => a + b, 0), status: bjStatus(s), live: s.phase === "player", viewers: viewers[id] ?? 0, updatedAt: new Date(s.updatedAt).toISOString() };
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
    });
}

// ---------- spectating ----------

export type Spectate = {
  id: string;
  game: "blackjack" | "scratchoff";
  player: { id: string; name: string; avatar: string | null };
  viewers: number;
  blackjack: PublicTable | null;
  scratch: PublicScratch | null;
};

/** One table, as a spectator sees it. Counts the viewer as watching (unless it's the player). */
export async function spectate(tableId: string, viewer: string, opts: { staff?: boolean } = {}): Promise<Spectate> {
  const m = /^(bj|sc):(\d{5,25})$/.exec(tableId);
  if (!m) throw new GameError("That table doesn't exist.", 404);
  const owner = m[2];
  if (!opts.staff && owner !== viewer && (await isPrivate(owner))) throw new GameError("This player keeps their games private.", 403);
  const { sessions } = await gameCollections();
  const doc = await sessions.findOne({ _id: tableId } as never);
  if (!doc) throw new GameError("That table is empty right now.", 404);
  if (owner !== viewer) await checkIn(tableId, viewer);
  const [who, viewers] = await Promise.all([people([owner]), viewerCounts([tableId])]);
  const p = who[owner];
  return {
    id: tableId,
    game: m[1] === "bj" ? "blackjack" : "scratchoff",
    player: { id: owner, name: p?.name ?? "A member", avatar: p?.avatar ?? null },
    viewers: viewers[tableId] ?? 0,
    blackjack: m[1] === "bj" ? view(doc as unknown as Session) : null,
    scratch: m[1] === "sc" ? scratchView(doc as unknown as ScratchSession) : null,
  };
}

/** How many people are watching my blackjack table and my ticket, and whether I hide my games. */
export async function myAudience(discordId: string) {
  const [counts, hidden] = await Promise.all([viewerCounts([`bj:${discordId}`, `sc:${discordId}`]), isPrivate(discordId)]);
  return { blackjack: counts[`bj:${discordId}`] ?? 0, scratch: counts[`sc:${discordId}`] ?? 0, private: hidden };
}
