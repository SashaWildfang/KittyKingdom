// Voice history for the stats page, from what the server already records:
// - the VC log channel (mirrored into website.bot_logs): joins, leaves with the session length,
//   switches, AFK moves, camera and mute changes, since the logs started;
// - the "🎧 VC Rewards Claimed!" messages in the notifications channel, which list how long the
//   session was, what it earned and who they were in VC with (mirrored into website.vc_rewards).

import type { Document } from "mongodb";
import { syncLogChannel } from "./bot-logs";
import { DISCORD_API, botToken } from "./discord-member";
import { getMongoClient } from "./mongodb";

export const NOTIFICATIONS_CHANNEL_ID = "1358485891361804358";
const SYNC_EVERY_MS = 15_000;
const NEW_PAGES = 5;
const BACKFILL_PAGES = 6;
const MAX_SEGMENT_S = 18 * 3600; // a join with no leave can't count for more than this

async function db() {
  const client = await getMongoClient();
  return client.db(process.env.MONGODB_DB ?? "website");
}

/** "1h 2m 3s", "45m 10s", "9s" -> seconds */
export function parseDuration(text: string | null | undefined) {
  if (!text) return null;
  let total = 0;
  let found = false;
  for (const m of Array.from(text.matchAll(/(\d+)\s*([dhms])/gi))) {
    found = true;
    total += Number(m[1]) * ({ d: 86400, h: 3600, m: 60, s: 1 } as Record<string, number>)[m[2].toLowerCase()];
  }
  return found ? total : null;
}

type RawMessage = {
  id: string;
  content: string;
  timestamp: string;
  author: { bot?: boolean };
  embeds: { title?: string; description?: string; fields?: { name: string; value: string }[] }[];
};

type Reward = { _id: string; userId: string; ts: Date; seconds: number; with: string[]; leaves: number | null; xp: number | null };

function toReward(m: RawMessage): Reward | null {
  const embed = m.embeds?.find((e) => /vc rewards/i.test(e.title ?? ""));
  if (!embed) return null;
  const userId = /<@!?(\d{15,21})>/.exec(`${m.content} ${embed.description ?? ""}`)?.[1];
  if (!userId) return null;
  const field = (re: RegExp) => embed.fields?.find((f) => re.test(f.name))?.value ?? "";
  const withText = field(/in vc with/i);
  const earned = field(/earned/i);
  const num = (re: RegExp) => {
    const hit = re.exec(earned);
    return hit ? Number(hit[1].replace(/,/g, "")) : null;
  };
  return {
    _id: m.id,
    userId,
    ts: new Date(m.timestamp),
    seconds: parseDuration(field(/duration/i)) ?? 0,
    with: Array.from(withText.matchAll(/<@!?(\d{15,21})>/g)).map((x) => x[1]).filter((id) => id !== userId),
    // "**+123 <:leaf:…>**\n**+45 ✨**" (✨ is XP)
    leaves: num(/([\d,]+)\s*(?:<a?:leaf\w*:\d+>|leaves?\b)/i),
    xp: num(/([\d,]+)\s*(?:✨|xp\b)/i),
  };
}

async function fetchPage(params: string): Promise<RawMessage[] | null> {
  const token = botToken();
  if (!token) return null;
  const response = await fetch(`${DISCORD_API}/channels/${NOTIFICATIONS_CHANNEL_ID}/messages?limit=100${params}`, {
    headers: { Authorization: `Bot ${token}` },
    cache: "no-store",
  });
  if (response.status === 429) return [];
  return response.ok ? ((await response.json()) as RawMessage[]) : null;
}

const big = (id: string) => BigInt(id);

/** Mirrors new VC reward messages (and a few more pages of history) — one request at a time. */
export async function syncVcRewards() {
  const d = await db();
  const rewards = d.collection<Reward>("vc_rewards");
  const meta = d.collection<{ _id: string; newestId?: string; oldestId?: string; backfillDone?: boolean; syncedAt?: Date; lockedUntil?: Date }>("vc_rewards_meta");
  const now = new Date();
  await meta.updateOne({ _id: "sync" }, { $setOnInsert: { syncedAt: new Date(0) } }, { upsert: true });
  const state = await meta.findOneAndUpdate(
    { _id: "sync", syncedAt: { $lt: new Date(now.getTime() - SYNC_EVERY_MS) }, $or: [{ lockedUntil: { $lt: now } }, { lockedUntil: { $exists: false } }] },
    { $set: { lockedUntil: new Date(now.getTime() + 20_000) } },
  );
  if (!state) return;
  let newestId = state.newestId;
  let oldestId = state.oldestId;
  let backfillDone = Boolean(state.backfillDone);
  const save = async (page: RawMessage[]) => {
    if (!page.length) return;
    const found = page.map(toReward).filter((r): r is Reward => Boolean(r));
    if (found.length) await rewards.bulkWrite(found.map((r) => ({ replaceOne: { filter: { _id: r._id }, replacement: r, upsert: true } })), { ordered: false });
    const ids = page.map((m) => m.id);
    const hi = ids.reduce((a, b) => (big(b) > big(a) ? b : a));
    const lo = ids.reduce((a, b) => (big(b) < big(a) ? b : a));
    newestId = newestId && big(newestId) > big(hi) ? newestId : hi;
    oldestId = oldestId && big(oldestId) < big(lo) ? oldestId : lo;
  };
  try {
    for (let i = 0; i < NEW_PAGES; i++) {
      const page = await fetchPage(newestId ? `&after=${newestId}` : "");
      if (!page) break;
      await save(page);
      if (page.length < 100 || !newestId) break;
    }
    for (let i = 0; i < BACKFILL_PAGES && !backfillDone && oldestId; i++) {
      const page = await fetchPage(`&before=${oldestId}`);
      if (!page) break;
      await save(page);
      if (page.length < 100) backfillDone = true;
    }
  } finally {
    await meta.updateOne({ _id: "sync" }, { $set: { newestId, oldestId, backfillDone, syncedAt: new Date() }, $unset: { lockedUntil: "" } });
  }
}

export type VoiceHistory = {
  sessions: number;
  totalSeconds: number;
  longestSession: number;
  channels: Record<string, number>;
  /** UTC weekday*24+hour (Monday = 0) -> joins, the same keys the activity tracker uses */
  joinHours: Record<string, number>;
  cameraSeconds: number;
  mutedSeconds: number;
  afkMoves: number;
  since: string | null;
  rewards: { count: number; solo: number; withOthers: number; seconds: number; withOthersSeconds: number; leaves: number; xp: number };
  /** member id -> seconds in VC together (from reward messages, both directions) */
  buddies: Record<string, number>;
  buddySessions: Record<string, number>;
};

const cache = new Map<string, { at: number; value: VoiceHistory }>();

/** Everything above for one member (cached for 20 seconds). */
export async function voiceHistory(userId: string): Promise<VoiceHistory> {
  const hit = cache.get(userId);
  if (hit && Date.now() - hit.at < 20_000) return hit.value;
  await Promise.all([syncLogChannel("vc").catch(() => undefined), syncVcRewards().catch(() => undefined)]);

  const d = await db();
  const [logs, mine, withMe] = await Promise.all([
    d.collection("bot_logs").find({ channel: "vc", subjectId: userId }, { projection: { ts: 1, type: 1, description: 1 } }).sort({ ts: 1 }).toArray(),
    d.collection<Reward>("vc_rewards").find({ userId }).toArray(),
    d.collection<Reward>("vc_rewards").find({ with: userId }).toArray(),
  ]);

  // ---- Sessions from the VC logs ----
  const channels: Record<string, number> = {};
  const joinHours: Record<string, number> = {};
  let sessions = 0;
  let longest = 0;
  let total = 0;
  let camera = 0;
  let muted = 0;
  let afkMoves = 0;
  let open: { channel: string; since: number } | null = null;
  let sessionStart: number | null = null;
  let cameraOn: number | null = null;
  let muteOn: number | null = null;
  const chan = (text: string, which = 0) => Array.from(text.matchAll(/<#(\d{15,21})>/g))[which]?.[1] ?? null;
  const closeSegment = (at: number, fallback: number | null, channelId: string | null) => {
    if (open) {
      const len = Math.min(MAX_SEGMENT_S, Math.max(0, (at - open.since) / 1000));
      channels[open.channel] = (channels[open.channel] ?? 0) + len;
      open = null;
      return len;
    }
    // Joined before the logs started: use the length the log reports
    if (fallback && channelId) channels[channelId] = (channels[channelId] ?? 0) + fallback;
    return fallback ?? 0;
  };
  const endSession = (at: number, fallback: number | null) => {
    const length = sessionStart !== null ? Math.min(MAX_SEGMENT_S, (at - sessionStart) / 1000) : fallback ?? 0;
    if (length > 0) {
      sessions += 1;
      total += length;
      longest = Math.max(longest, length);
    }
    sessionStart = null;
    if (cameraOn !== null) camera += Math.min(MAX_SEGMENT_S, (at - cameraOn) / 1000);
    if (muteOn !== null) muted += Math.min(MAX_SEGMENT_S, (at - muteOn) / 1000);
    cameraOn = null;
    muteOn = null;
  };
  for (const l of logs as Document[]) {
    const at = new Date(l.ts).getTime();
    const text = String(l.description ?? "");
    const reported = parseDuration(/after\s+\*\*([^*]+)\*\*/i.exec(text)?.[1]);
    switch (l.type) {
      case "Joined VC":
      case "Returned from AFK": {
        const c = chan(text);
        if (open) closeSegment(at, null, null);
        if (c) open = { channel: c, since: at };
        if (sessionStart === null) {
          sessionStart = at;
          const dt = new Date(at);
          const key = String(((dt.getUTCDay() + 6) % 7) * 24 + dt.getUTCHours());
          joinHours[key] = (joinHours[key] ?? 0) + 1;
        }
        break;
      }
      case "Switched VC": {
        const to = chan(text, 1);
        closeSegment(at, null, null);
        if (to) open = { channel: to, since: at };
        if (sessionStart === null) sessionStart = at;
        break;
      }
      case "Left VC": {
        const c = chan(text);
        closeSegment(at, reported, c);
        endSession(at, reported);
        break;
      }
      case "Moved to AFK": {
        afkMoves += 1;
        closeSegment(at, reported, null);
        endSession(at, reported);
        break;
      }
      case "State Changed": {
        if (/turned camera on/i.test(text)) cameraOn = cameraOn ?? at;
        else if (/turned camera off/i.test(text) && cameraOn !== null) {
          camera += Math.min(MAX_SEGMENT_S, (at - cameraOn) / 1000);
          cameraOn = null;
        } else if (/self-mute:\s*\*\*muted/i.test(text)) muteOn = muteOn ?? at;
        else if (/self-mute:\s*\*\*unmuted/i.test(text) && muteOn !== null) {
          muted += Math.min(MAX_SEGMENT_S, (at - muteOn) / 1000);
          muteOn = null;
        }
        break;
      }
      default:
        break;
    }
  }

  // ---- Buddies and rewards from the VC reward messages ----
  const buddies: Record<string, number> = {};
  const buddySessions: Record<string, number> = {};
  const addBuddy = (id: string, seconds: number) => {
    buddies[id] = (buddies[id] ?? 0) + seconds;
    buddySessions[id] = (buddySessions[id] ?? 0) + 1;
  };
  let solo = 0;
  let rewardSeconds = 0;
  let withOthersSeconds = 0;
  let leaves = 0;
  let xp = 0;
  for (const r of mine) {
    rewardSeconds += r.seconds;
    leaves += r.leaves ?? 0;
    xp += r.xp ?? 0;
    if (r.with.length) {
      withOthersSeconds += r.seconds;
      for (const id of r.with) addBuddy(id, r.seconds);
    } else solo += 1;
  }
  // Their reward messages that list this member count too (unless this member's own message already did)
  const counted = new Set(mine.map((r) => `${Math.round(r.ts.getTime() / 60000)}`));
  for (const r of withMe) {
    if (r.userId === userId) continue;
    if (counted.has(`${Math.round(r.ts.getTime() / 60000)}`) && (buddies[r.userId] ?? 0) > 0) continue;
    addBuddy(r.userId, r.seconds);
  }

  const value: VoiceHistory = {
    sessions,
    totalSeconds: Math.round(total),
    longestSession: Math.round(longest),
    channels: Object.fromEntries(Object.entries(channels).map(([k, v]) => [k, Math.round(v)])),
    joinHours,
    cameraSeconds: Math.round(camera),
    mutedSeconds: Math.round(muted),
    afkMoves,
    since: logs.length ? new Date(logs[0].ts).toISOString() : null,
    rewards: { count: mine.length, solo, withOthers: mine.length - solo, seconds: rewardSeconds, withOthersSeconds, leaves, xp },
    buddies,
    buddySessions,
  };
  cache.set(userId, { at: Date.now(), value });
  if (cache.size > 200) cache.delete(cache.keys().next().value as string);
  return value;
}
