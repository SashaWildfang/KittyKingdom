// Everything for a member's "My stats" page: level and XP, leaves and economy, where and when they
// chat, their server bestie and circle, voice time and VC buddies, emojis and reactions, tickets.
//
// Sources: the bot's users record (level, XP, leaves, total messages, voice time, bumps), the
// activity tracker's member_activity record (main_bot/events/activity_stats.py: channels, hours,
// replies, conversations, reactions, voice by channel and with whom), plus store, gift, gambling,
// QOTD and ticket records, and the member's Discord profile.

import { Long, type Document } from "mongodb";
import { monthlyBumps, monthlyVcSeconds } from "./bumps";
import { people, type Person } from "./admin-people";
import { getGuildChannelsRaw, getGuildRoles, getMemberProfile, guildId } from "./discord-member";
import { inServerIds } from "./member-directory";
import { TOPICS } from "./topics";
import { voiceHistory, type VoiceHistory } from "./voice-history";
import { getBotCollection } from "./mongodb";
import { zoneOffsetMinutes } from "./timezone";

// Level roles, lowest first (same as the bot's stats.py)
const LEVEL_ROLES: [number, string][] = [
  [0, "1361677978421035180"], [5, "1361678583713759363"], [11, "1361678717197221968"],
  [21, "1361678760327512185"], [31, "1361679050632073398"], [41, "1361679477700038828"],
  [51, "1361680109953876049"], [61, "1361680599672422540"], [71, "1361680699563966605"],
  [81, "1361680852064407683"], [91, "1361681482946576504"],
];
const PATREON = [
  { id: "1362502871639396362", name: "Legendary Neko", bonus: 0.4 },
  { id: "1362502662721114245", name: "Kitten Guardian", bonus: 0.2 },
  { id: "1362102163693633818", name: "Royal Kitten", bonus: 0.1 },
];
const BOOSTER_ROLE = "1360260086500561237";
const STAFF_TEAM_ROLE = "1358470109965979859";
const DISCORD_EPOCH = BigInt("1420070400000");

/** XP needed to go from `level` to the next one (same as xp_required_for in economy/leveling.py). */
export const xpForLevel = (level: number) => (level <= 1 ? 100 : Math.floor(100 * level ** 1.2));

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "bigint" ? Number(v) : v instanceof Long ? v.toNumber() : 0);
const iso = (v: unknown) => (v instanceof Date && !Number.isNaN(v.getTime()) ? v.toISOString() : null);
const cleanRoleName = (name: string) => name.replace(/\s*\[.*?\]\s*/g, " ").trim();
const idFilter = (discordId: string) => ({ discordId: { $in: [Long.fromString(discordId), discordId] } });

function entries(map: unknown): [string, number][] {
  if (!map || typeof map !== "object") return [];
  return Object.entries(map as Record<string, unknown>).map(([k, v]) => [k, num(v)] as [string, number]).filter(([, v]) => v > 0);
}

function top(map: unknown, n: number) {
  return entries(map).sort((a, b) => b[1] - a[1]).slice(0, n);
}

// Channel names change rarely: keep them for 10 minutes
let channelCache: { at: number; names: Map<string, { name: string; type: number }> } | null = null;
async function channelNames() {
  if (channelCache && Date.now() - channelCache.at < 10 * 60 * 1000) return channelCache.names;
  const list = await getGuildChannelsRaw().catch(() => []);
  const names = new Map(list.map((c) => [c.id, { name: c.name, type: c.type }]));
  if (names.size) channelCache = { at: Date.now(), names };
  return names;
}

let memberIdsCache: { at: number; ids: (Long | string)[] | null } | null = null;
async function memberIdFilter() {
  if (!memberIdsCache || Date.now() - memberIdsCache.at > 5 * 60 * 1000) {
    const ids = await inServerIds().catch(() => null);
    memberIdsCache = { at: Date.now(), ids: ids ? ids.flatMap((id) => [Long.fromString(id), id]) : null };
  }
  return memberIdsCache.ids ? { discordId: { $in: memberIdsCache.ids } } : {};
}

function emojiView(key: string, count: number) {
  const custom = /^(\w+):(\d{15,21})$/.exec(key);
  return custom
    ? { key, count, name: custom[1], url: `https://cdn.discordapp.com/emojis/${custom[2]}.webp?size=64&animated=true` }
    : { key, count, name: key, url: null };
}

/** Consecutive days with messages: the current run (ending today or yesterday) and the longest. */
function streaks(days: [string, number][]) {
  const set = new Set(days.map(([d]) => d));
  const sorted = Array.from(set).sort();
  let longest = 0;
  let run = 0;
  let prev: number | null = null;
  for (const d of sorted) {
    const t = Date.parse(`${d}T00:00:00Z`);
    run = prev !== null && t - prev === 86400000 ? run + 1 : 1;
    longest = Math.max(longest, run);
    prev = t;
  }
  const dayKey = (offset: number) => new Date(Date.now() - offset * 86400000).toISOString().slice(0, 10);
  let current = 0;
  const start = set.has(dayKey(0)) ? 0 : set.has(dayKey(1)) ? 1 : -1;
  if (start >= 0) while (set.has(dayKey(start + current))) current++;
  return { current, longest };
}

export async function memberStats(discordId: string, timeZone: string) {
  const [users, activityCol, gambling, sales, gifts, inventory, qotd, active, resolved, boosters, globals, gamblingLogs, catalogCol] = await Promise.all([
    getBotCollection("users"),
    getBotCollection("member_activity"),
    getBotCollection("gambling"),
    getBotCollection("store_sales"),
    getBotCollection("gift_log"),
    getBotCollection("user_inventory"),
    getBotCollection("qotdAnswers"),
    getBotCollection("activeTickets"),
    getBotCollection("resolvedTickets"),
    getBotCollection("temporary_boosters"),
    getBotCollection("globals"),
    getBotCollection("gambling_logs"),
    getBotCollection("store_inventory"),
  ]);

  const [user, activity, meta, gamble, salesAgg, giftsSent, giftsReceived, items, qotdCount, openTickets, closedTickets, booster, global, profile, roles, channels, inServer] =
    await Promise.all([
      users.findOne(idFilter(discordId)) as Promise<Document | null>,
      activityCol.findOne({ _id: discordId } as never) as Promise<Document | null>,
      activityCol.findOne({ _id: "__meta" } as never) as Promise<Document | null>,
      gambling.findOne(idFilter(discordId)) as Promise<Document | null>,
      sales.aggregate([{ $match: { buyerId: discordId } }, { $group: { _id: null, n: { $sum: 1 }, spent: { $sum: "$price_paid" } } }]).toArray(),
      gifts.countDocuments({ sender_id: discordId }),
      gifts.countDocuments({ recipient_id: discordId }),
      inventory.countDocuments({ discordId }),
      qotd.countDocuments({ user_id: { $in: [Long.fromString(discordId), discordId] } } as never),
      active.find({ opened_by: discordId }, { projection: { ticket_type: 1, created: 1 } }).toArray(),
      resolved.find({ opened_by: discordId }, { projection: { ticket_type: 1, created: 1 } }).toArray(),
      boosters.findOne({ discordId }) as Promise<Document | null>,
      globals.findOne({}) as Promise<Document | null>,
      getMemberProfile(discordId).catch(() => null),
      getGuildRoles().catch(() => new Map()),
      channelNames(),
      memberIdFilter(),
    ]);

  // ---------- Store, gifts and games details ----------
  const [boughtAgg, lastSale, giftTo, giftFrom, recentGames, catalogDocs] = await Promise.all([
    sales.aggregate([{ $match: { buyerId: discordId } }, { $group: { _id: "$item_id", n: { $sum: 1 }, spent: { $sum: "$price_paid" } } }, { $sort: { n: -1, spent: -1 } }, { $limit: 3 }]).toArray(),
    sales.find({ buyerId: discordId }).sort({ timestamp: -1 }).limit(1).toArray(),
    gifts.aggregate([{ $match: { sender_id: discordId } }, { $group: { _id: "$recipient_id", n: { $sum: 1 } } }, { $sort: { n: -1 } }, { $limit: 1 }]).toArray(),
    gifts.aggregate([{ $match: { recipient_id: discordId } }, { $group: { _id: "$sender_id", n: { $sum: 1 } } }, { $sort: { n: -1 } }, { $limit: 1 }]).toArray(),
    gamblingLogs.find(idFilter(discordId)).sort({ timestamp: -1 }).limit(8).toArray(),
    catalogCol.find({}, { projection: { item_id: 1, name: 1 } }).toArray(),
  ]);
  const itemName = new Map(catalogDocs.map((d) => [String(d.item_id), String(d.name ?? d.item_id)]));

  // ---------- Level & XP ----------
  const level = Math.max(1, num(user?.level) || 1);
  const xp = num(user?.xp);
  const needed = xpForLevel(level);
  const balance = num(user?.balance);
  const msgCount = num(user?.msgCount);
  const [levelRank, balanceRank, messageRank, ranked, averages] = await Promise.all([
    users.countDocuments({ ...inServer, $or: [{ level: { $gt: level } }, { level, xp: { $gt: xp } }] } as never),
    users.countDocuments({ ...inServer, balance: { $gt: balance } } as never),
    users.countDocuments({ ...inServer, msgCount: { $gt: msgCount } } as never),
    users.countDocuments(inServer as never),
    users
      .aggregate([
        { $match: inServer },
        { $group: { _id: null, messages: { $avg: "$msgCount" }, level: { $avg: "$level" }, balance: { $avg: "$balance" }, voice: { $avg: "$vc_time_total" } } },
      ])
      .toArray()
      .then((r) => r[0] ?? null),
  ]);
  const currentRole = [...LEVEL_ROLES].reverse().find(([min]) => level >= min);
  const nextRole = LEVEL_ROLES.find(([min]) => min > level);
  const roleName = (id?: string) => (id && roles.get(id) ? cleanRoleName(roles.get(id).name) : null);
  // XP from level 1 to the start of each level
  const xpToReach = (target: number) => {
    let total = 0;
    for (let l = 1; l < target; l++) total += xpForLevel(l);
    return total;
  };
  const journey = LEVEL_ROLES.map(([min, id], i) => {
    const role = roles.get(id);
    const next = LEVEL_ROLES[i + 1]?.[0] ?? null;
    return {
      level: Math.max(1, min),
      until: next ? next - 1 : null,
      name: roleName(id) ?? `Level ${min}+`,
      colors: (role?.colors ?? []) as string[],
      icon: (role?.icon ?? null) as string | null,
      emoji: (role?.emoji ?? null) as string | null,
      reached: level >= min,
      current: currentRole?.[1] === id,
      xpToReach: xpToReach(Math.max(1, min)),
    };
  });
  const currentLevelRole = currentRole ? roles.get(currentRole[1]) : null;

  // ---------- Multipliers (same rules as the bot) ----------
  const memberRoles = new Set(profile?.roles ?? []);
  const patreon = PATREON.find((p) => memberRoles.has(p.id)) ?? null;
  const isBooster = memberRoles.has(BOOSTER_ROLE);
  const weekend = global?.isXpWeekend ? num(global.xpWeekendMultiplier) || 1 : 1;
  const globalBoost = global?.isBoosterActive ? num(global.boosterMultiplier) || 1 : 1;
  let xpMultiplier = 1 + (patreon?.bonus ?? 0) + (isBooster ? 0.15 : 0) + (weekend - 1) + (globalBoost - 1);
  let leafMultiplier = 1 + (isBooster ? 0.15 : 0);
  const boosterEnds = booster?.end_time instanceof Date ? booster.end_time : null;
  const consumable = booster && (!boosterEnds || boosterEnds.getTime() > Date.now())
    ? { name: String(booster.item_name ?? "Booster"), endsAt: iso(boosterEnds) }
    : null;
  if (consumable && booster?.item_id === "booster_xp") xpMultiplier *= 2;
  if (consumable && booster?.item_id === "booster_balance") leafMultiplier *= 2;

  // ---------- Activity ----------
  const a = activity ?? {};
  // Voice history from the VC logs and VC reward messages (covers time before the tracker)
  const vh: VoiceHistory | null = await voiceHistory(discordId).catch(() => null);
  const mergeMax = (x: unknown, y: Record<string, number> | undefined) => {
    const out: Record<string, number> = {};
    for (const [k, v] of entries(x)) out[k] = v;
    for (const [k, v] of Object.entries(y ?? {})) out[k] = Math.max(out[k] ?? 0, v);
    return out;
  };
  const voiceBuddiesAll = mergeMax(a.voiceBuddies, vh?.buddies);
  const voiceChannelsAll = mergeMax(a.voiceChannels, vh?.channels);
  const voiceHoursAll = mergeMax(a.voiceHours, vh?.joinHours);
  const tracked = num(a.messages);
  const dayEntries = entries(a.days);
  const { current: currentStreak, longest: longestStreak } = streaks(dayEntries);
  const busiestDay = [...dayEntries].sort((x, y) => y[1] - x[1])[0] ?? null;
  const dayCount = new Map(dayEntries);
  const sumDays = (from: number, to: number) => {
    let n = 0;
    for (let i = from; i < to; i++) n += dayCount.get(new Date(Date.now() - i * 86400000).toISOString().slice(0, 10)) ?? 0;
    return n;
  };
  const trends = {
    last7: sumDays(0, 7),
    prev7: sumDays(7, 14),
    last30: sumDays(0, 30),
    prev30: sumDays(30, 60),
    spark: Array.from({ length: 14 }, (_, i) => dayCount.get(new Date(Date.now() - (13 - i) * 86400000).toISOString().slice(0, 10)) ?? 0),
  };
  const monthTotals = new Map<string, number>();
  for (const [d, n] of dayEntries) monthTotals.set(d.slice(0, 7), (monthTotals.get(d.slice(0, 7)) ?? 0) + n);
  const busiestMonth = Array.from(monthTotals.entries()).sort((x, y) => y[1] - x[1])[0] ?? null;
  const sumMap = (map: unknown) => entries(map).reduce((acc, [, v]) => acc + v, 0);

  // Every counted day, oldest first (dates are UTC)
  const allDays = [...dayEntries].sort((x, y) => (x[0] < y[0] ? -1 : 1));
  const monthKeys = Array.from({ length: 12 }, (_, i) => {
    const d = new Date();
    d.setUTCDate(1);
    d.setUTCMonth(d.getUTCMonth() - (11 - i));
    return d.toISOString().slice(0, 7);
  });
  let longestGap = 0;
  for (let i = 1; i < allDays.length; i++) {
    const gap = Math.round((Date.parse(`${allDays[i][0]}T00:00:00Z`) - Date.parse(`${allDays[i - 1][0]}T00:00:00Z`)) / 86400000) - 1;
    longestGap = Math.max(longestGap, gap);
  }
  const lastDay = allDays[allDays.length - 1]?.[0] ?? null;
  // Occasions: chatting on (or through) special days, any year
  const md = (d: string) => d.slice(5);
  const onDate = (mmdd: string) => allDays.some(([d]) => md(d) === mmdd);
  const inMonths = (months: number[]) => allDays.filter(([d]) => months.includes(Number(d.slice(5, 7)))).length;
  const events = {
    christmas: onDate("12-25"),
    halloween: onDate("10-31"),
    newYear: onDate("01-01"),
    valentines: onDate("02-14"),
    stPatricks: onDate("03-17"),
    aprilFools: onDate("04-01"),
    leapDay: onDate("02-29"),
    fridayThe13th: allDays.some(([d]) => d.endsWith("-13") && new Date(`${d}T12:00:00Z`).getUTCDay() === 5),
    october: inMonths([10]),
    december: inMonths([12]),
    june: inMonths([6]),
    summer: inMonths([6, 7, 8]),
    spring: inMonths([3, 4, 5]),
  };

  // Hours are stored in UTC (Monday = 0); shift them into the viewer's zone
  const shift = Math.round(zoneOffsetMinutes(timeZone) / 60);
  const toLocal = (map: unknown) => {
    const heat = Array.from({ length: 7 }, () => Array(24).fill(0) as number[]);
    for (const [k, v] of entries(map)) {
      const utc = Number(k);
      if (!Number.isInteger(utc) || utc < 0 || utc >= 168) continue;
      const local = (((utc + shift) % 168) + 168) % 168;
      heat[Math.floor(local / 24)][local % 24] += v;
    }
    return heat;
  };
  const heat = toLocal(a.hours);
  const hours = Array.from({ length: 24 }, (_, h) => heat.reduce((s, row) => s + row[h], 0));
  const weekdays = heat.map((row) => row.reduce((s, v) => s + v, 0));

  // Last 52 weeks of daily counts for the calendar
  const calendar: { date: string; n: number }[] = [];
  const dayMap = new Map(dayEntries);
  for (let i = 363; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    calendar.push({ date: d, n: dayMap.get(d) ?? 0 });
  }

  const channelTotal = entries(a.channels).reduce((s, [, v]) => s + v, 0);
  const topChannels = top(a.channels, 8).map(([id, n]) => ({ id, name: channels.get(id)?.name ?? "deleted-channel", n, share: channelTotal ? n / channelTotal : 0 }));

  // ---------- Bestie & circle ----------
  const scores = new Map<string, { score: number; replies: number; mentions: number; conversations: number; reactions: number; voiceSeconds: number }>();
  const add = (map: unknown, field: "replies" | "mentions" | "conversations" | "reactions" | "voiceSeconds", weight: number) => {
    for (const [id, v] of entries(map)) {
      if (id === discordId) continue;
      const s = scores.get(id) ?? { score: 0, replies: 0, mentions: 0, conversations: 0, reactions: 0, voiceSeconds: 0 };
      s[field] += v;
      s.score += v * weight;
      scores.set(id, s);
    }
  };
  add(a.repliesTo, "replies", 3);
  add(a.repliesFrom, "replies", 3);
  add(a.mentionsTo, "mentions", 2);
  add(a.mentionsFrom, "mentions", 2);
  add(a.conversations, "conversations", 1);
  add(a.reactedBy, "reactions", 0.5);
  add(a.reactedTo, "reactions", 0.5);
  add(voiceBuddiesAll, "voiceSeconds", 1 / 600); // 10 minutes in VC together = 1 point

  const topVoiceChannels = top(voiceChannelsAll, 5);
  const topBuddies = top(voiceBuddiesAll, 5);
  const reactedBy = top(a.reactedBy, 1);
  const circleIds = Array.from(scores.entries()).sort((x, y) => y[1].score - x[1].score).slice(0, 20).map(([id]) => id);

  // Everyone they interact with, both directions (you → them and them → you)
  const dir = new Map<string, { out: Record<string, number>; in: Record<string, number>; both: Record<string, number> }>();
  const put = (map: unknown, side: "out" | "in" | "both", key: string) => {
    for (const [id, v] of entries(map)) {
      if (id === discordId) continue;
      const d = dir.get(id) ?? { out: {}, in: {}, both: {} };
      d[side][key] = (d[side][key] ?? 0) + v;
      dir.set(id, d);
    }
  };
  put(a.repliesTo, "out", "replies");
  put(a.mentionsTo, "out", "mentions");
  put(a.reactedTo, "out", "reactions");
  put(a.repliesFrom, "in", "replies");
  put(a.mentionsFrom, "in", "mentions");
  put(a.reactedBy, "in", "reactions");
  put(a.conversations, "both", "conversations");
  put(voiceBuddiesAll, "both", "voiceSeconds");
  const everyoneIds = Array.from(dir.keys())
    .sort((x, y) => (scores.get(y)?.score ?? 0) - (scores.get(x)?.score ?? 0))
    .slice(0, 200);
  // A few candidates per leader so a deleted account can be skipped once names are known
  const leader = (map: unknown) => top(map, 6).filter(([id]) => id !== discordId);
  const leaders = {
    repliesTo: leader(a.repliesTo),
    repliesFrom: leader(a.repliesFrom),
    mentionsTo: leader(a.mentionsTo),
    mentionsFrom: leader(a.mentionsFrom),
    reactedTo: leader(a.reactedTo),
    reactedBy: leader(a.reactedBy),
    conversations: leader(a.conversations),
    voice: leader(voiceBuddiesAll),
  };
  const giftToId = giftTo[0]?._id ? String(giftTo[0]._id) : null;
  const giftFromId = giftFrom[0]?._id ? String(giftFrom[0]._id) : null;
  const who = await people([
    ...circleIds,
    ...everyoneIds,
    ...topBuddies.map(([id]) => id),
    ...reactedBy.map(([id]) => id),
    ...Object.values(leaders).flatMap((l) => l.map(([id]) => id)),
    giftToId,
    giftFromId,
  ]).catch(() => ({} as Record<string, Person>));
  const person = (id: string) => ({ id, name: who[id]?.name ?? "Unknown member", avatar: who[id]?.avatar ?? null, inServer: who[id]?.inServer ?? false });
  // Deleted Discord accounts never show up in the social stats
  const alive = (id: string) => !who[id]?.deleted;
  const firstAlive = (list: [string, number][]) => list.find(([id]) => alive(id)) ?? null;
  // Prefer people still in the server
  const circle = circleIds
    .filter(alive)
    .map((id) => ({ ...person(id), ...scores.get(id)! }))
    .sort((x, y) => Number(y.inServer) - Number(x.inServer) || y.score - x.score)
    .slice(0, 6)
    .map((c) => ({ ...c, score: Math.round(c.score), voiceSeconds: Math.round(c.voiceSeconds) }));

  // ---------- Tickets ----------
  const tickets = [...openTickets, ...closedTickets];
  const byType = new Map<string, number>();
  let lastTicket: Date | null = null;
  for (const t of tickets) {
    const type = String(t.ticket_type ?? "other").replace(/[_-]/g, " ");
    byType.set(type, (byType.get(type) ?? 0) + 1);
    if (t.created instanceof Date && (!lastTicket || t.created > lastTicket)) lastTicket = t.created;
  }

  const created = new Date(Number((BigInt(discordId) >> BigInt(22)) + DISCORD_EPOCH)).toISOString();
  const words = num(a.words);
  const trackingSince = iso(meta?.trackingStartedAt);
  const backfillDays = num(meta?.backfillDays);

  return {
    generatedAt: new Date().toISOString(),
    timeZone,
    hasActivity: Boolean(activity),
    trackingSince,
    countedSince: backfillDays && trackingSince ? new Date(Date.parse(trackingSince) - backfillDays * 86400000).toISOString() : trackingSince,
    profile: {
      avatar: `/api/discord/avatar/${discordId}`,
      discordCreated: created,
      joinedServer: profile?.joinedAt ?? null,
      boostingSince: profile?.boostingSince ?? null,
      isStaff: memberRoles.has(STAFF_TEAM_ROLE),
      inServer: Boolean(profile),
    },
    level: {
      level,
      xp,
      needed,
      totalXp: num(user?.totalXp),
      rank: levelRank + 1,
      of: ranked,
      role: roleName(currentRole?.[1]),
      icon: (currentLevelRole?.icon ?? null) as string | null,
      emoji: (currentLevelRole?.emoji ?? null) as string | null,
      journey,
      startXp: xpToReach(level),
      // The level role's color (two or three stops for gradient roles), for the level badge
      color: (currentRole && roles.get(currentRole[1])?.colors?.length ? roles.get(currentRole[1]).colors : null) as string[] | null,
      nextRole: nextRole ? { name: roleName(nextRole[1]) ?? `Level ${nextRole[0]} role`, level: nextRole[0] } : null,
    },
    multipliers: { xp: Math.round(xpMultiplier * 100) / 100, leaves: Math.round(leafMultiplier * 100) / 100, patreon: patreon?.name ?? null, booster: isBooster, xpWeekend: weekend > 1, globalBooster: globalBoost > 1, consumable },
    compare: averages
      ? {
          messages: Math.round(num(averages.messages)),
          level: Math.round(num(averages.level) * 10) / 10,
          balance: Math.round(num(averages.balance)),
          voiceSeconds: Math.round(num(averages.voice)),
        }
      : null,
    trends,
    activity: (() => {
      const monthly = new Map<string, number>();
      for (const [d, n] of allDays) monthly.set(d.slice(0, 7), (monthly.get(d.slice(0, 7)) ?? 0) + n);
      const partsOf = (from: number, to: number) => hours.slice(from, to).reduce((acc, v) => acc + v, 0);
      const joined = profile?.joinedAt ? Date.parse(profile.joinedAt) : null;
      const daysInServer = joined ? Math.max(1, Math.floor((Date.now() - joined) / 86400000)) : null;
      const activeDays = allDays.length;
      const quietest = allDays.length ? [...allDays].sort((x, y) => x[1] - y[1])[0] : null;
      const weekend = weekdays[5] + weekdays[6];
      const allWeek = weekdays.reduce((acc, v) => acc + v, 0);
      return {
        months: monthKeys.map((k) => ({ month: k, n: monthly.get(k) ?? 0 })),
        parts: { night: partsOf(0, 6), morning: partsOf(6, 12), afternoon: partsOf(12, 18), evening: partsOf(18, 24) },
        weekendShare: allWeek ? weekend / allWeek : 0,
        perActiveDay: activeDays ? Math.round((tracked / activeDays) * 10) / 10 : 0,
        perDayInServer: daysInServer ? Math.round((msgCount / daysInServer) * 10) / 10 : null,
        daysInServer,
        activeShare: daysInServer ? Math.min(1, activeDays / Math.min(daysInServer, Math.max(1, (Date.now() - Date.parse(`${allDays[0]?.[0] ?? new Date().toISOString().slice(0, 10)}T00:00:00Z`)) / 86400000 + 1))) : null,
        longestGap,
        daysSinceLast: lastDay ? Math.max(0, Math.floor((Date.now() - Date.parse(`${lastDay}T00:00:00Z`)) / 86400000)) : null,
        quietestDay: quietest ? { date: quietest[0], n: quietest[1] } : null,
        channelsUsed: entries(a.channels).length,
        charsPerMessage: tracked ? Math.round(num(a.characters) / tracked) : 0,
        emojisPerMessage: tracked ? Math.round((num(a.emojiTotal) / tracked) * 100) / 100 : 0,
        mediaShare: tracked ? num(a.attachments) / tracked : 0,
        pagesWritten: Math.round(num(a.words) / 300),
        typingMinutes: Math.round(num(a.characters) / 200),
        voiceNightShare: (() => {
          const vh = Array.from({ length: 24 }, (_, h) => toLocal(voiceHoursAll).reduce((acc, row) => acc + row[h], 0));
          const all = vh.reduce((acc, v) => acc + v, 0);
          return all ? Math.round(((vh.slice(0, 5).reduce((acc, v) => acc + v, 0) + vh[22] + vh[23]) / all) * 100) : 0;
        })(),
        witchingShare: (() => {
          const all = hours.reduce((acc, v) => acc + v, 0);
          return all >= 50 ? Math.round(((hours[3] + hours[4]) / all) * 1000) / 10 : 0;
        })(),
      };
    })(),
    topics: (() => {
      const counts = entries(a.topics).filter(([key]) => TOPICS[key]).sort((x, y) => y[1] - x[1]);
      const words = entries(a.topicWords);
      const total = counts.reduce((acc, [, n]) => acc + n, 0);
      return {
        total,
        list: counts.map(([key, n]) => {
          const def = TOPICS[key];
          const own = def ? words.filter(([w]) => def.words.includes(w)).sort((x, y) => y[1] - x[1]).slice(0, 12) : [];
          return { key, label: def?.label ?? key, group: def?.group ?? "life", color: def?.color ?? "#f59b2a", icon: def?.icon ?? "Hash", n, share: total ? n / total : 0, words: own.map(([w, c]) => ({ word: w, n: c })) };
        }),
        topWords: [...words].sort((x, y) => y[1] - x[1]).slice(0, 40).map(([w, c]) => ({ word: w, n: c })),
      };
    })(),
    events,
    server: await (async () => {
      const gid = await guildId().catch(() => null);
      if (!gid || !/^\d{15,21}$/.test(gid)) return null;
      const created = new Date(Number((BigInt(gid) >> BigInt(22)) + DISCORD_EPOCH)).toISOString();
      return { created };
    })(),
    records: {
      longestMessage: num(a.longestMessage),
      questions: num(a.questions),
      mentionsSent: sumMap(a.mentionsTo),
      mentionsReceived: sumMap(a.mentionsFrom),
      conversations: sumMap(a.conversations),
      people: new Set([...entries(a.conversations), ...entries(a.repliesTo), ...entries(a.repliesFrom), ...entries(a.mentionsTo)].map(([id]) => id)).size,
      busiestMonth: busiestMonth ? { month: busiestMonth[0], n: busiestMonth[1] } : null,
      commandsUsed: num(a.commandsUsed),
      commands: top(a.commands, 5).map(([name, n]) => ({ name, n })),
      commandCounts: Object.fromEntries(entries(a.commands)) as Record<string, number>,
    },
    store: {
      topItems: boughtAgg.map((b) => ({ name: itemName.get(String(b._id)) ?? String(b._id), n: num(b.n), spent: num(b.spent) })),
      lastPurchase: lastSale[0] ? { name: itemName.get(String(lastSale[0].item_id)) ?? String(lastSale[0].item_id), at: iso(lastSale[0].timestamp), price: num(lastSale[0].price_paid) } : null,
      giftsMostTo: giftToId ? { ...person(giftToId), n: num(giftTo[0].n) } : null,
      giftsMostFrom: giftFromId ? { ...person(giftFromId), n: num(giftFrom[0].n) } : null,
    },
    games: {
      recent: recentGames.map((g) => ({ game: String(g.game ?? "slots"), spent: num(g.spent), won: num(g.won), net: num(g.net), symbols: g.symbols ? String(g.symbols) : null, at: iso(g.timestamp) })),
    },
    economy: {
      balance,
      rank: balanceRank + 1,
      of: ranked,
      dailyStreak: num(user?.streak),
      bumps: num(user?.bumps),
      monthlyBumps: monthlyBumps(user as Record<string, unknown> | null),
      purchases: num(salesAgg[0]?.n),
      spent: num(salesAgg[0]?.spent),
      giftsSent,
      giftsReceived,
      items,
      qotdAnswers: qotdCount,
      gambling: gamble
        ? {
            spins: num(gamble.total_spins),
            spent: num(gamble.total_spent),
            won: num(gamble.total_won),
            net: num(gamble.net_profit),
            biggestWin: num(gamble.biggest_win),
            biggestLoss: num(gamble.biggest_loss),
          }
        : null,
    },
    messages: {
      total: msgCount,
      rank: messageRank + 1,
      of: ranked,
      tracked,
      words,
      avgWords: tracked ? Math.round((words / tracked) * 10) / 10 : 0,
      characters: num(a.characters),
      attachments: num(a.attachments),
      images: num((a.media as Document | undefined)?.image),
      videos: num((a.media as Document | undefined)?.video),
      audio: num((a.media as Document | undefined)?.audio),
      gifs: num(a.gifs),
      links: num(a.links),
      stickers: num(a.stickers),
      edited: num(a.edited),
      emojis: num(a.emojiTotal),
      repliesSent: num(a.repliesSent),
      repliesReceived: num(a.repliesReceived),
      first: iso(a.firstMessageAt),
      last: iso(a.lastMessageAt),
      activeDays: dayEntries.length,
      currentStreak,
      longestStreak,
      busiestDay: busiestDay ? { date: busiestDay[0], n: busiestDay[1] } : null,
    },
    when: { hours, weekdays, heat },
    calendar,
    channels: topChannels,
    circle,
    social: (() => {
      const everyone = everyoneIds.filter(alive).slice(0, 150).map((id) => {
        const d = dir.get(id)!;
        const outN = (d.out.replies ?? 0) + (d.out.mentions ?? 0) + (d.out.reactions ?? 0);
        const inN = (d.in.replies ?? 0) + (d.in.mentions ?? 0) + (d.in.reactions ?? 0);
        const shared = (d.both.conversations ?? 0) + (d.both.voiceSeconds ?? 0);
        return {
          ...person(id),
          score: Math.round(scores.get(id)?.score ?? 0),
          conversations: d.both.conversations ?? 0,
          voiceSeconds: Math.round(d.both.voiceSeconds ?? 0),
          out: { replies: d.out.replies ?? 0, mentions: d.out.mentions ?? 0, reactions: d.out.reactions ?? 0 },
          in: { replies: d.in.replies ?? 0, mentions: d.in.mentions ?? 0, reactions: d.in.reactions ?? 0 },
          // Who reaches out: both ways, mostly you, or mostly them
          balance: outN && inN ? "mutual" : outN ? "you" : inN ? "them" : shared ? "mutual" : "none",
        };
      });
      const lead = (l: [string, number] | null) => (l ? { ...person(l[0]), n: Math.round(l[1]) } : null);
      const totalScore = everyone.reduce((acc, p) => acc + p.score, 0);
      return {
        everyone,
        count: dir.size - everyoneIds.filter((id) => !alive(id)).length,
        mutual: everyone.filter((p) => p.balance === "mutual").length,
        youReach: everyone.filter((p) => p.balance === "you").length,
        theyReach: everyone.filter((p) => p.balance === "them").length,
        topThreeShare: totalScore ? everyone.slice(0, 3).reduce((acc, p) => acc + p.score, 0) / totalScore : 0,
        starts: num(a.conversationStarts),
        avgReplySeconds: num(a.replyDelayCount) ? Math.round(num(a.replyDelaySum) / num(a.replyDelayCount)) : null,
        replyRatio: num(a.repliesSent) ? Math.round((num(a.repliesReceived) / num(a.repliesSent)) * 100) / 100 : null,
        leaders: {
          repliesTo: lead(firstAlive(leaders.repliesTo)),
          repliesFrom: lead(firstAlive(leaders.repliesFrom)),
          mentionsTo: lead(firstAlive(leaders.mentionsTo)),
          mentionsFrom: lead(firstAlive(leaders.mentionsFrom)),
          reactedTo: lead(firstAlive(leaders.reactedTo)),
          reactedBy: lead(firstAlive(leaders.reactedBy)),
          conversations: lead(firstAlive(leaders.conversations)),
          voice: lead(firstAlive(leaders.voice)),
        },
      };
    })(),
    voice: {
      totalSeconds: Math.max(num(user?.vc_time_total), num(a.voiceSeconds), vh?.totalSeconds ?? 0),
      monthSeconds: monthlyVcSeconds(user as Record<string, unknown> | null),
      trackedSeconds: Math.max(num(a.voiceSeconds), vh?.rewards.seconds ?? 0),
      withOthersSeconds: num(a.voiceSeconds) >= (vh?.rewards.seconds ?? 0) ? num(a.voiceWithOthersSeconds) : vh?.rewards.withOthersSeconds ?? 0,
      longestSession: Math.max(num(a.voiceLongestSession), vh?.longestSession ?? 0),
      sessions: Math.max(num(a.voiceSessions), vh?.sessions ?? 0),
      streamSeconds: num(a.streamSeconds),
      cameraSeconds: Math.max(num(a.cameraSeconds), vh?.cameraSeconds ?? 0),
      mutedSeconds: vh?.mutedSeconds ?? 0,
      afkMoves: vh?.afkMoves ?? 0,
      historySince: vh?.since ?? null,
      rewards: vh?.rewards ?? null,
      buddySessions: vh?.buddySessions ?? {},
      hours: toLocal(voiceHoursAll).map((row) => row.reduce((acc, v) => acc + v, 0)),
      byHour: Array.from({ length: 24 }, (_, h) => toLocal(voiceHoursAll).reduce((acc, row) => acc + row[h], 0)),
      joins: Math.max(num(a.voiceJoins), vh?.sessions ?? 0),
      channels: topVoiceChannels.map(([id, s]) => ({ id, name: channels.get(id)?.name ?? "deleted channel", seconds: Math.round(s) })),
      buddies: topBuddies.filter(([id]) => alive(id)).map(([id, s]) => ({ ...person(id), seconds: Math.round(s) })),
    },
    emojis: {
      top: top(a.emojis, 10).map(([k, n]) => emojiView(k, n)),
      reactionsGiven: num(a.reactionsGiven),
      reactionsReceived: num(a.reactionsReceived),
      topGiven: top(a.reactionEmojis, 6).map(([k, n]) => emojiView(k, n)),
      topReceived: top(a.reactionsReceivedEmojis, 6).map(([k, n]) => emojiView(k, n)),
      biggestFan: reactedBy[0] ? { ...person(reactedBy[0][0]), n: reactedBy[0][1] } : null,
    },
    tickets: {
      total: tickets.length,
      open: openTickets.length,
      closed: closedTickets.length,
      byType: Array.from(byType.entries()).sort((x, y) => y[1] - x[1]).map(([type, n]) => ({ type, n })),
      last: iso(lastTicket),
    },
  };
}

export type MemberStats = Awaited<ReturnType<typeof memberStats>>;
