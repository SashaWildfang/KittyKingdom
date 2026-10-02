// Gambling stats, from the log the bot and the website both write (`gambling_logs`: one row per game with
// spent / won / net / game / timestamp; slots rows have no `game`). Personal stats for My Stats, and
// server-wide stats for the staff Games tab. Days are Mountain time, like the rest of the server's stats.

import type { Document } from "mongodb";
import { people } from "../admin-people";
import { getBotCollection } from "../mongodb";
import { num, userFilter } from "./core";

const TZ = "America/Denver";
export const GAME_LABELS: Record<string, string> = { slots: "Slots", blackjack: "Blackjack", scratchoff: "Scratch-offs", roulette: "Roulette", mines: "Mines" };
const gameOf = (g: unknown) => (typeof g === "string" && g ? g : "slots");

let indexed: Promise<unknown> | null = null;
async function logsCol() {
  const col = await getBotCollection("gambling_logs");
  indexed ??= Promise.all([col.createIndex({ discordId: 1, timestamp: -1 }), col.createIndex({ timestamp: -1 })]).catch(() => undefined);
  await indexed;
  return col;
}

async function jackpot() {
  const globals = await getBotCollection("globals");
  return num((await globals.findOne({ _id: "casino_jackpot" } as never))?.amount);
}

const dayKey = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
const lastDays = (n: number) => Array.from({ length: n }, (_, i) => dayKey(new Date(Date.now() - (n - 1 - i) * 86_400_000)));

export type GameLine = { game: string; label: string; plays: number; wagered: number; won: number; net: number; wins: number; losses: number; pushes: number; biggestWin: number; biggestLoss: number; avgBet: number; rtp: number | null };

function emptyLine(game: string): GameLine {
  return { game, label: GAME_LABELS[game] ?? game, plays: 0, wagered: 0, won: 0, net: 0, wins: 0, losses: 0, pushes: 0, biggestWin: 0, biggestLoss: 0, avgBet: 0, rtp: null };
}

function addTo(line: GameLine, spent: number, won: number) {
  const net = won - spent;
  line.plays += 1;
  line.wagered += spent;
  line.won += won;
  line.net += net;
  if (net > 0) line.wins += 1;
  else if (net < 0) line.losses += 1;
  else line.pushes += 1;
  line.biggestWin = Math.max(line.biggestWin, net);
  line.biggestLoss = Math.min(line.biggestLoss, net);
}

function finish(line: GameLine) {
  line.avgBet = line.plays ? Math.round(line.wagered / line.plays) : 0;
  line.rtp = line.wagered ? line.won / line.wagered : null;
  return line;
}

// ==========================================
// Personal (My Stats → Games)
// ==========================================

export type PersonalGames = {
  total: GameLine;
  games: GameLine[];
  days: { day: string; plays: number; wagered: number; net: number; cumulative: number }[];
  recent: { game: string; label: string; spent: number; won: number; net: number; detail: string | null; at: string | null; source: "website" | "discord" }[];
  streaks: { bestWin: number; worstLoss: number; current: number };
  favorite: string | null;
  luckiest: string | null;
  sources: { website: number; discord: number };
  rank: { byNet: number | null; byWagered: number | null; of: number };
  jackpot: number;
  firstPlayed: string | null;
};

export async function personalGames(discordId: string): Promise<PersonalGames> {
  const logs = await logsCol();
  const rows = await logs.find(userFilter(discordId), { projection: { spent: 1, won: 1, game: 1, timestamp: 1, symbols: 1, source: 1 }, useBigInt64: true }).sort({ timestamp: 1 }).limit(20000).toArray();

  const total = emptyLine("all");
  total.label = "All games";
  const byGame = new Map<string, GameLine>();
  const daily = new Map<string, { plays: number; wagered: number; net: number }>();
  let run = 0;
  let bestWin = 0;
  let worstLoss = 0;
  const sources = { website: 0, discord: 0 };
  for (const r of rows) {
    const spent = num(r.spent);
    const won = num(r.won);
    const net = won - spent;
    const g = gameOf(r.game);
    if (!byGame.has(g)) byGame.set(g, emptyLine(g));
    addTo(byGame.get(g)!, spent, won);
    addTo(total, spent, won);
    if (r.source === "website") sources.website += 1;
    else sources.discord += 1;
    if (r.timestamp instanceof Date) {
      const k = dayKey(r.timestamp);
      const d = daily.get(k) ?? { plays: 0, wagered: 0, net: 0 };
      d.plays += 1;
      d.wagered += spent;
      d.net += net;
      daily.set(k, d);
    }
    // Win / loss streaks (pushes don't break a streak)
    if (net > 0) run = run > 0 ? run + 1 : 1;
    else if (net < 0) run = run < 0 ? run - 1 : -1;
    bestWin = Math.max(bestWin, run);
    worstLoss = Math.min(worstLoss, run);
  }
  const games = Array.from(byGame.values()).map(finish).sort((a, b) => b.plays - a.plays);
  finish(total);

  // A running profit line over the last 30 days
  let cumulative = 0;
  const days = lastDays(30).map((day) => {
    const d = daily.get(day) ?? { plays: 0, wagered: 0, net: 0 };
    cumulative += d.net;
    return { day, ...d, cumulative };
  });

  // Where they rank among everyone who has played
  const board = await logs.aggregate([{ $group: { _id: "$discordId", net: { $sum: { $subtract: ["$won", "$spent"] } }, wagered: { $sum: "$spent" } } }]).toArray();
  const me = String(discordId);
  const byNet = [...board].sort((a, b) => num(b.net) - num(a.net)).findIndex((r) => String(r._id) === me);
  const byWagered = [...board].sort((a, b) => num(b.wagered) - num(a.wagered)).findIndex((r) => String(r._id) === me);

  const eligible = games.filter((g) => g.plays >= 5 && g.rtp !== null);
  return {
    total,
    games,
    days,
    recent: rows
      .slice(-15)
      .reverse()
      .map((r) => ({
        game: gameOf(r.game),
        label: GAME_LABELS[gameOf(r.game)] ?? gameOf(r.game),
        spent: num(r.spent),
        won: num(r.won),
        net: num(r.won) - num(r.spent),
        detail: typeof r.symbols === "string" ? r.symbols.replace(/^(BJ|Scratch): /, "") : null,
        at: r.timestamp instanceof Date ? r.timestamp.toISOString() : null,
        source: r.source === "website" ? "website" : "discord",
      })),
    streaks: { bestWin, worstLoss: Math.abs(worstLoss), current: run },
    favorite: games[0]?.label ?? null,
    luckiest: eligible.length ? [...eligible].sort((a, b) => (b.rtp ?? 0) - (a.rtp ?? 0))[0].label : null,
    sources,
    rank: { byNet: byNet >= 0 ? byNet + 1 : null, byWagered: byWagered >= 0 ? byWagered + 1 : null, of: board.length },
    jackpot: await jackpot(),
    firstPlayed: rows[0]?.timestamp instanceof Date ? rows[0].timestamp.toISOString() : null,
  };
}

// ==========================================
// Server-wide (Admin → Games)
// ==========================================

type Period = "24h" | "7d" | "30d" | "all";
const PERIODS: Record<Period, number | null> = { "24h": 1, "7d": 7, "30d": 30, all: null };
type PlayerRow = { id: string; name: string; avatar: string | null; plays: number; wagered: number; net: number };

export type SiteGames = {
  periods: Record<Period, { total: GameLine; games: GameLine[]; players: number }>;
  days: { day: string; plays: number; wagered: number; paid: number; house: number; players: number }[];
  hours: number[];
  topWagered: PlayerRow[];
  topWinners: PlayerRow[];
  topLosers: PlayerRow[];
  bigWins: { id: string; name: string; avatar: string | null; game: string; label: string; spent: number; won: number; net: number; detail: string | null; at: string | null }[];
  sources: { website: number; discord: number; websiteWagered: number; discordWagered: number };
  jackpot: number;
};

export async function siteGames(): Promise<SiteGames> {
  const logs = await logsCol();
  const since = (days: number | null): Document => (days ? { timestamp: { $gte: new Date(Date.now() - days * 86_400_000) } } : {});
  const byGameStage = (match: Document) => [
    { $match: match },
    {
      $group: {
        _id: { $ifNull: ["$game", "slots"] },
        plays: { $sum: 1 },
        wagered: { $sum: "$spent" },
        won: { $sum: "$won" },
        wins: { $sum: { $cond: [{ $gt: ["$won", "$spent"] }, 1, 0] } },
        losses: { $sum: { $cond: [{ $lt: ["$won", "$spent"] }, 1, 0] } },
        biggestWin: { $max: { $subtract: ["$won", "$spent"] } },
        biggestLoss: { $min: { $subtract: ["$won", "$spent"] } },
        players: { $addToSet: "$discordId" },
      },
    },
  ];

  const facet: Document = {};
  for (const [p, d] of Object.entries(PERIODS)) facet[p] = byGameStage(since(d));
  facet.days = [
    { $match: since(30) },
    { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$timestamp", timezone: TZ } }, plays: { $sum: 1 }, wagered: { $sum: "$spent" }, paid: { $sum: "$won" }, players: { $addToSet: "$discordId" } } },
  ];
  facet.hours = [{ $match: since(90) }, { $group: { _id: { $hour: { date: "$timestamp", timezone: TZ } }, n: { $sum: 1 } } }];
  facet.players = [{ $group: { _id: "$discordId", plays: { $sum: 1 }, wagered: { $sum: "$spent" }, net: { $sum: { $subtract: ["$won", "$spent"] } } } }];
  facet.bigWins = [{ $addFields: { netv: { $subtract: ["$won", "$spent"] } } }, { $sort: { netv: -1 } }, { $limit: 10 }];
  facet.sources = [{ $group: { _id: { $cond: [{ $eq: ["$source", "website"] }, "website", "discord"] }, n: { $sum: 1 }, wagered: { $sum: "$spent" } } }];

  const [agg] = await logs.aggregate([{ $facet: facet }]).toArray();

  const periods = {} as SiteGames["periods"];
  for (const p of Object.keys(PERIODS) as Period[]) {
    const rows = (agg?.[p] ?? []) as Document[];
    const total = emptyLine("all");
    total.label = "All games";
    const allPlayers = new Set<string>();
    const games = rows
      .map((r) => {
        const line = emptyLine(String(r._id));
        line.plays = num(r.plays);
        line.wagered = num(r.wagered);
        line.won = num(r.won);
        line.net = line.won - line.wagered;
        line.wins = num(r.wins);
        line.losses = num(r.losses);
        line.pushes = line.plays - line.wins - line.losses;
        line.biggestWin = num(r.biggestWin);
        line.biggestLoss = num(r.biggestLoss);
        for (const id of (r.players ?? []) as unknown[]) allPlayers.add(String(id));
        for (const k of ["plays", "wagered", "won", "net", "wins", "losses", "pushes"] as const) total[k] += line[k];
        total.biggestWin = Math.max(total.biggestWin, line.biggestWin);
        total.biggestLoss = Math.min(total.biggestLoss, line.biggestLoss);
        return finish(line);
      })
      .sort((a, b) => b.wagered - a.wagered);
    periods[p] = { total: finish(total), games, players: allPlayers.size };
  }

  const dayRows = new Map(((agg?.days ?? []) as Document[]).map((r) => [String(r._id), r]));
  const days = lastDays(30).map((day) => {
    const r = dayRows.get(day);
    const wagered = num(r?.wagered);
    const paid = num(r?.paid);
    return { day, plays: num(r?.plays), wagered, paid, house: wagered - paid, players: ((r?.players ?? []) as unknown[]).length };
  });
  const hours = Array.from({ length: 24 }, () => 0);
  for (const r of (agg?.hours ?? []) as Document[]) hours[num(r._id)] = num(r.n);

  const players = ((agg?.players ?? []) as Document[]).map((r) => ({ id: String(r._id), plays: num(r.plays), wagered: num(r.wagered), net: num(r.net) }));
  const pick = (list: typeof players, by: (x: (typeof players)[number]) => number, n = 8) => [...list].sort((a, b) => by(b) - by(a)).slice(0, n);
  const topWagered = pick(players, (x) => x.wagered);
  const topWinners = pick(players.filter((x) => x.net > 0), (x) => x.net);
  const topLosers = pick(players.filter((x) => x.net < 0), (x) => -x.net);
  const bigWinRows = (agg?.bigWins ?? []) as Document[];

  const ids = [...topWagered, ...topWinners, ...topLosers].map((x) => x.id).concat(bigWinRows.map((r) => String(r.discordId)));
  const who = await people(ids);
  const withName = (x: (typeof players)[number]): PlayerRow => ({ ...x, name: who[x.id]?.name ?? `Member ${x.id.slice(-4)}`, avatar: who[x.id]?.avatar ?? null });

  const src = Object.fromEntries(((agg?.sources ?? []) as Document[]).map((r) => [String(r._id), r]));
  return {
    periods,
    days,
    hours,
    topWagered: topWagered.map(withName),
    topWinners: topWinners.map(withName),
    topLosers: topLosers.map(withName),
    bigWins: bigWinRows
      .filter((r) => num(r.won) > num(r.spent))
      .map((r) => {
        const id = String(r.discordId);
        const g = gameOf(r.game);
        return {
          id,
          name: who[id]?.name ?? `Member ${id.slice(-4)}`,
          avatar: who[id]?.avatar ?? null,
          game: g,
          label: GAME_LABELS[g] ?? g,
          spent: num(r.spent),
          won: num(r.won),
          net: num(r.won) - num(r.spent),
          detail: typeof r.symbols === "string" ? r.symbols.replace(/^(BJ|Scratch): /, "") : null,
          at: r.timestamp instanceof Date ? r.timestamp.toISOString() : null,
        };
      }),
    sources: { website: num(src.website?.n), discord: num(src.discord?.n), websiteWagered: num(src.website?.wagered), discordWagered: num(src.discord?.wagered) },
    jackpot: await jackpot(),
  };
}
