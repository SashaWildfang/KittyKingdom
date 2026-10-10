// The achievement wall (/achievements): what members have been up to lately, from:
//   - badge unlocks and tier-ups (website.badge_history events, written when stats are worked out)
//   - big casino wins (zeo_bot.gambling_logs, from the website and the bots' casino commands)
//   - giveaway winners (zeo_bot.giveaways results)
// Members only (like the leaderboards).

import type { Document } from "mongodb";
import { people } from "./admin-people";
import { badgeById, TIER_NAMES } from "./badges";
import { getBotCollection, getMongoClient } from "./mongodb";

export type Achievement =
  | { kind: "badge"; at: string; userId: string; badgeId: string; name: string; icon: string; shape: string; hue: string; tier: number; tierName: string; upgrade: boolean }
  | { kind: "win"; at: string; userId: string; game: string; won: number; bet: number }
  | { kind: "giveaway"; at: string; userId: string; title: string; prize: string };

export type AchievementFeed = {
  items: Achievement[];
  people: Record<string, { name: string; avatar: string | null }>;
  /** The most-earned badges this week, for the "Trending" strip */
  trending: { badgeId: string; name: string; icon: string; shape: string; hue: string; count: number }[];
  stats: { badges: number; bigWins: number; biggestWin: number };
};

const BIG_WIN = 5_000;
const DAYS = 14;
const idOf = (v: unknown) => (typeof v === "bigint" ? v.toString() : v && typeof v === "object" && "toString" in v ? String(v) : String(v ?? ""));
const num = (v: unknown) => (typeof v === "bigint" ? Number(v) : typeof v === "number" ? v : Number(v ?? 0) || 0);

let cache: { at: number; feed: AchievementFeed } | null = null;

export async function achievementFeed(): Promise<AchievementFeed> {
  if (cache && Date.now() - cache.at < 60_000) return cache.feed;
  const since = new Date(Date.now() - DAYS * 86_400_000);
  const client = await getMongoClient();
  const history = client.db(process.env.MONGODB_DB ?? "website").collection("badge_history");

  const [badgeEvents, wins, giveaways] = await Promise.all([
    history
      .aggregate([{ $unwind: "$events" }, { $match: { "events.at": { $gte: since } } }, { $sort: { "events.at": -1 } }, { $limit: 120 }, { $project: { _id: 1, e: "$events" } }])
      .toArray()
      .catch(() => [] as Document[]),
    getBotCollection("gambling_logs")
      .then((c) => c.find({ timestamp: { $gte: since }, won: { $gte: BIG_WIN } }, { projection: { discordId: 1, won: 1, spent: 1, game: 1, timestamp: 1 }, useBigInt64: true }).sort({ timestamp: -1 }).limit(40).toArray())
      .catch(() => [] as Document[]),
    getBotCollection("giveaways")
      .then((c) => c.find({ status: "ended", endedAt: { $gte: since } }, { projection: { title: 1, prize: 1, results: 1, endedAt: 1 } }).sort({ endedAt: -1 }).limit(20).toArray())
      .catch(() => [] as Document[]),
  ]);

  const items: Achievement[] = [];
  const trendCount = new Map<string, number>();
  for (const d of badgeEvents) {
    const e = d.e as { id: string; from: number; to: number; at: Date };
    if (e.to <= e.from) continue; // dropped a tier: not an achievement
    const def = badgeById(e.id);
    if (!def) continue;
    items.push({ kind: "badge", at: new Date(e.at).toISOString(), userId: String(d._id), badgeId: e.id, name: def.name, icon: def.icon, shape: def.shape, hue: def.hue, tier: e.to, tierName: TIER_NAMES[e.to - 1] ?? "", upgrade: e.from > 0 });
    trendCount.set(e.id, (trendCount.get(e.id) ?? 0) + 1);
  }
  for (const w of wins) {
    items.push({ kind: "win", at: new Date(w.timestamp).toISOString(), userId: idOf(w.discordId), game: String(w.game ?? "slots"), won: num(w.won), bet: num(w.spent) });
  }
  for (const g of giveaways) {
    const prize = g.prize?.type === "leaves" ? `${num(g.prize.amount).toLocaleString()} Leaves` : g.prize?.type === "item" ? String(g.prize.itemName ?? "a store item") : String(g.prize?.text ?? "a prize");
    for (const r of (g.results ?? []) as { userId: string }[]) items.push({ kind: "giveaway", at: new Date(g.endedAt).toISOString(), userId: String(r.userId), title: String(g.title ?? "a giveaway"), prize });
  }
  items.sort((a, b) => b.at.localeCompare(a.at));
  const shown = items.slice(0, 80);
  const who = await people(shown.map((i) => i.userId)).catch(() => ({}) as Record<string, { name: string; avatar: string | null }>);

  const trending = Array.from(trendCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([badgeId, count]) => {
      const def = badgeById(badgeId)!;
      return { badgeId, name: def.name, icon: def.icon, shape: def.shape, hue: def.hue, count };
    });

  const feed: AchievementFeed = {
    items: shown,
    people: Object.fromEntries(Object.entries(who).map(([id, p]) => [id, { name: p.name, avatar: p.avatar }])),
    trending,
    stats: {
      badges: items.filter((i) => i.kind === "badge").length,
      bigWins: items.filter((i) => i.kind === "win").length,
      biggestWin: Math.max(0, ...items.filter((i): i is Extract<Achievement, { kind: "win" }> => i.kind === "win").map((i) => i.won)),
    },
  };
  cache = { at: Date.now(), feed };
  return feed;
}
