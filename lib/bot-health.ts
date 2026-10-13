// Admin → Bots → Consoles: how each bot is doing over time, and the problems it has printed.
//   zeo_bot.bot_health  {bot, at, rss, cpu, threads, latencyMs, lagMaxMs, lagAvgMs, tasks, uptimeS, …}  every minute, 14 days
//   zeo_bot.bot_issues  {_id: "<bot>:<fingerprint>", bot, level, title, detail, count, firstAt, lastAt, resolved}  30 days
// Both are written by each bot's events/health.py (console problems are spotted by db/issues.py).
//
// Server-only.

import type { Document } from "mongodb";
import { BOT_SERVERS, type ServerStatus } from "./bot-console";
import { getBotCollection } from "./mongodb";

const MB = 1048576;
const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : typeof v === "string" ? v : null);

export type HealthPoint = { t: string; rss: number | null; rssMax: number | null; cpu: number | null; cpuMax: number | null; lag: number | null; latency: number | null };
export type Advice = { tone: "bad" | "warn" | "good" | "info"; title: string; text: string };
export type BotHealth = {
  key: string;
  name: string;
  samples: number;
  points: HealthPoint[];
  memPeak: number | null;
  memP95: number | null;
  memAvg: number | null;
  memLimit: number | null;
  cpuP95: number | null;
  cpuAvg: number | null;
  cpuLimit: number | null;
  lagP95: number | null;
  lagMax: number | null;
  latencyAvg: number | null;
  restarts: number;
  growthPct: number | null;
  suggestedMemory: number | null;
  advice: Advice[];
};

function percentile(values: number[], p: number) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
}
const avg = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : null);
const roundUp = (bytes: number, step = 128 * MB) => Math.ceil(bytes / step) * step;
const mb = (bytes: number) => `${Math.round(bytes / MB)} MB`;

/** Per-bot history and plain-language advice (with the servers' current limits from SparkedHost). */
export async function botHealth(range: "24h" | "7d", statuses: ServerStatus[]): Promise<{ bots: BotHealth[]; plan: Advice[] }> {
  const hours = range === "7d" ? 168 : 24;
  const since = new Date(Date.now() - hours * 3_600_000);
  const bucketMs = (range === "7d" ? 60 : 10) * 60_000;
  const col = await getBotCollection("bot_health");
  const rows = (await col
    .find({ at: { $gte: since } }, { projection: { bot: 1, at: 1, rss: 1, cpu: 1, lagMaxMs: 1, lagAvgMs: 1, latencyMs: 1, uptimeS: 1 } })
    .sort({ at: 1 })
    .toArray()) as Document[];

  const bots = BOT_SERVERS.map((server): BotHealth => {
    const mine = rows.filter((r) => r.bot === server.key);
    const status = statuses.find((s) => s.key === server.key);
    const rss = mine.map((r) => r.rss).filter((v): v is number => typeof v === "number");
    const cpu = mine.map((r) => r.cpu).filter((v): v is number => typeof v === "number");
    const lag = mine.map((r) => r.lagMaxMs).filter((v): v is number => typeof v === "number");
    const latency = mine.map((r) => r.latencyMs).filter((v): v is number => typeof v === "number");

    // Restarts: uptime going backwards
    let restarts = 0;
    for (let i = 1; i < mine.length; i++) if (typeof mine[i].uptimeS === "number" && typeof mine[i - 1].uptimeS === "number" && mine[i].uptimeS < mine[i - 1].uptimeS) restarts++;

    // Buckets for the chart
    const buckets = new Map<number, Document[]>();
    for (const r of mine) {
      const t = Math.floor(new Date(r.at).getTime() / bucketMs) * bucketMs;
      buckets.set(t, [...(buckets.get(t) ?? []), r]);
    }
    const points: HealthPoint[] = Array.from(buckets, ([t, list]) => {
      const nums = (k: string) => list.map((r) => r[k]).filter((v): v is number => typeof v === "number");
      const rs = nums("rss");
      const cs = nums("cpu");
      return {
        t: new Date(t).toISOString(),
        rss: avg(rs),
        rssMax: rs.length ? Math.max(...rs) : null,
        cpu: avg(cs),
        cpuMax: cs.length ? Math.max(...cs) : null,
        lag: nums("lagMaxMs").length ? Math.max(...nums("lagMaxMs")) : null,
        latency: avg(nums("latencyMs")),
      };
    });

    // Memory creeping up: the last quarter of the range vs the first (only while it stayed up)
    let growthPct: number | null = null;
    if (rss.length >= 120 && restarts === 0) {
      const q = Math.floor(rss.length / 4);
      const first = avg(rss.slice(0, q))!;
      const last = avg(rss.slice(-q))!;
      growthPct = first ? Math.round(((last - first) / first) * 100) : null;
    }

    const memPeak = rss.length ? Math.max(...rss) : null;
    const memP95 = percentile(rss, 95);
    const memLimit = status?.memoryLimit ?? null;
    const cpuP95 = percentile(cpu, 95);
    const cpuLimit = status?.cpuLimit ?? null;
    const lagP95 = percentile(lag, 95);
    const lagMax = lag.length ? Math.max(...lag) : null;
    const latencyAvg = avg(latency);

    const advice: Advice[] = [];
    let suggestedMemory: number | null = null;
    if (rss.length < 30) {
      advice.push({ tone: "info", title: "Not enough data yet", text: "Advice appears after the bot has reported for about half an hour (it needs the new events/health.py)." });
    } else {
      if (memLimit && memPeak !== null && memP95 !== null) {
        const use = memP95 / memLimit;
        if (use > 0.85 || memPeak > memLimit * 0.92) {
          suggestedMemory = roundUp(memPeak * 1.5);
          advice.push({ tone: "bad", title: "Needs more RAM", text: `It uses up to ${mb(memPeak)} of its ${mb(memLimit)}. Running out makes SparkedHost kill it. Give it about ${mb(suggestedMemory)}.` });
        } else if (use < 0.35 && memLimit - roundUp(Math.max(memPeak * 1.6, 256 * MB)) >= 256 * MB) {
          suggestedMemory = roundUp(Math.max(memPeak * 1.6, 256 * MB));
          advice.push({ tone: "good", title: "Has spare RAM", text: `It never went above ${mb(memPeak)} of its ${mb(memLimit)}. ${mb(suggestedMemory)} would be plenty, so ${mb(memLimit - suggestedMemory)} could go to another bot.` });
        } else {
          advice.push({ tone: "good", title: "RAM is about right", text: `Peak ${mb(memPeak)} of ${mb(memLimit)} (${Math.round(use * 100)}% most of the time).` });
        }
      }
      if (growthPct !== null && growthPct >= 30)
        advice.push({ tone: "warn", title: "Memory keeps growing", text: `Up ${growthPct}% over this range without a restart. Something may be keeping data it doesn't need (a cache or list that never shrinks).` });
      if (cpuP95 !== null) {
        const cap = cpuLimit ?? 100;
        if (cpuP95 > cap * 0.8) advice.push({ tone: "bad", title: "CPU is maxed out", text: `It often uses ${Math.round(cpuP95)}% of its ${cap}% CPU. Give it more CPU, or look for heavy work in loops.` });
        else if (cpuP95 > cap * 0.5) advice.push({ tone: "warn", title: "CPU is busy at times", text: `Busy moments reach ${Math.round(cpuP95)}% of its ${cap}%.` });
      }
      const frozen = lag.filter((v) => v > 500).length;
      if ((lagP95 !== null && lagP95 > 250) || frozen >= 5)
        advice.push({
          tone: frozen > lag.length * 0.05 ? "bad" : "warn",
          title: "Gets stuck at times",
          text: `The bot froze for over half a second in ${frozen.toLocaleString()} of ${lag.length.toLocaleString()} minutes (worst ${Math.round(lagMax ?? 0)} ms). Commands feel slow then: usually slow code that blocks (big loops, file reads, image work). Issues may show what it was doing.`,
        });
      if (latencyAvg !== null && latencyAvg > 400) advice.push({ tone: "warn", title: "Slow connection to Discord", text: `About ${Math.round(latencyAvg)} ms to Discord on average. That's the host's network, not the code.` });
      if (restarts > 0) advice.push({ tone: restarts > 3 ? "bad" : "info", title: `Restarted ${restarts} time${restarts === 1 ? "" : "s"}`, text: "Check Issues for errors just before each restart, or the console for an out-of-memory kill." });
    }

    return { key: server.key, name: server.name, samples: mine.length, points, memPeak, memP95, memAvg: avg(rss), memLimit, cpuP95, cpuAvg: avg(cpu), cpuLimit, lagP95, lagMax, latencyAvg, restarts, growthPct, suggestedMemory, advice };
  });

  // Across the plan: move spare RAM to the bots that need it
  const plan: Advice[] = [];
  const short = bots.filter((b) => b.suggestedMemory && b.memLimit && b.suggestedMemory > b.memLimit);
  const spare = bots.filter((b) => b.suggestedMemory && b.memLimit && b.suggestedMemory < b.memLimit);
  const need = short.reduce((n, b) => n + (b.suggestedMemory! - b.memLimit!), 0);
  const free = spare.reduce((n, b) => n + (b.memLimit! - b.suggestedMemory!), 0);
  if (short.length && spare.length) {
    // Take only what's needed, from the bots with the most to spare first
    let left = need;
    const takes: string[] = [];
    for (const b of [...spare].sort((x, y) => y.memLimit! - y.suggestedMemory! - (x.memLimit! - x.suggestedMemory!))) {
      if (left <= 0) break;
      const take = Math.min(left, b.memLimit! - b.suggestedMemory!);
      takes.push(`${mb(take)} from the ${b.name}`);
      left -= take;
    }
    plan.push({
      tone: left <= 0 ? "good" : "warn",
      title: left <= 0 ? "You can fix this by moving RAM around" : "Moving RAM helps, but isn't quite enough",
      text: `Take ${takes.join(" and ")}, and give ${short.map((b) => `${mb(b.suggestedMemory! - b.memLimit!)} to the ${b.name}`).join(" and ")}.${left <= 0 ? "" : ` That still leaves ${mb(left)} short: upgrade the plan for that.`}`,
    });
  }
  else if (short.length) plan.push({ tone: "bad", title: "More RAM needed", text: `${short.map((b) => b.name).join(" and ")} need${short.length === 1 ? "s" : ""} about ${mb(need)} more in total, and no bot has spare. Upgrade the plan.` });
  else if (bots.some((b) => b.samples >= 30)) plan.push({ tone: "good", title: "No bot is short of RAM", text: free ? `There's about ${mb(free)} spare across the bots if you ever need it.` : "Every bot has the room it needs." });
  return { bots, plan };
}

// ---------- Issues ----------
export type BotIssue = { id: string; bot: string; level: "error" | "warning"; title: string; detail: string; count: number; firstAt: string | null; lastAt: string | null; resolved: boolean; resolvedBy: string | null };

export async function listIssues(opts: { bot?: string | null; open?: boolean; limit?: number }) {
  const col = await getBotCollection("bot_issues");
  const q: Document = {};
  if (opts.bot) q.bot = opts.bot;
  if (opts.open) q.resolved = { $ne: true };
  const [rows, counts] = await Promise.all([
    // limit 0 = counts only (Mongo would read 0 as "no limit")
    opts.limit === 0 ? Promise.resolve([]) : col.find(q).sort({ resolved: 1, lastAt: -1 }).limit(opts.limit ?? 100).toArray(),
    col.aggregate([{ $match: { resolved: { $ne: true } } }, { $group: { _id: { bot: "$bot", level: "$level" }, n: { $sum: 1 } } }]).toArray(),
  ]);
  const open: Record<string, { errors: number; warnings: number }> = {};
  for (const c of counts as Document[]) {
    const b = String(c._id?.bot ?? "");
    open[b] ??= { errors: 0, warnings: 0 };
    if (c._id?.level === "error") open[b].errors += c.n as number;
    else open[b].warnings += c.n as number;
  }
  const issues: BotIssue[] = (rows as Document[]).map((d) => ({
    id: String(d._id),
    bot: String(d.bot ?? ""),
    level: d.level === "warning" ? "warning" : "error",
    title: String(d.title ?? ""),
    detail: String(d.detail ?? ""),
    count: Number(d.count) || 1,
    firstAt: iso(d.firstAt),
    lastAt: iso(d.lastAt),
    resolved: Boolean(d.resolved),
    resolvedBy: d.resolvedBy ? String(d.resolvedBy) : null,
  }));
  return { issues, open };
}

/** Mark issues as fixed (they reopen, and alert again, if they happen again). */
export async function resolveIssues(target: { id?: string; bot?: string; level?: string }, by: string) {
  const col = await getBotCollection("bot_issues");
  const q: Document = { resolved: { $ne: true } };
  if (target.id) q._id = target.id;
  else if (target.bot) q.bot = target.bot;
  else return 0;
  if (target.level === "error" || target.level === "warning") q.level = target.level;
  const res = await col.updateMany(q as never, { $set: { resolved: true, resolvedBy: by, resolvedAt: new Date() } });
  return res.modifiedCount;
}
