// Everything for a member's "My stats" page: level and XP, leaves and economy, where and when they
// chat, their server bestie and circle, voice time and VC buddies, emojis and reactions, tickets.
//
// Sources: the bot's users record (level, XP, leaves, total messages, voice time, bumps), the
// activity tracker's member_activity record (main_bot/events/activity_stats.py: channels, hours,
// replies, conversations, reactions, voice by channel and with whom), plus store, gift, gambling,
// QOTD and ticket records, and the member's Discord profile.

import { Long, type Document } from "mongodb";
import { people, type Person } from "./admin-people";
import { getGuildChannelsRaw, getGuildRoles, getMemberProfile } from "./discord-member";
import { inServerIds } from "./member-directory";
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
  { id: "1362502662721114245", name: "Feral Guardian", bonus: 0.2 },
  { id: "1362102163693633818", name: "Royal Kitten", bonus: 0.1 },
];
const BOOSTER_ROLE = "1360260086500561237";
const STAFF_TEAM_ROLE = "1358470109965979859";
const DISCORD_EPOCH = BigInt("1420070400000");

/** XP needed to go from `level` to the next one (the bot's curve: 100 × level^1.2). */
export const xpForLevel = (level: number) => Math.floor(100 * Math.max(1, level) ** 1.2);

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
  const [users, activityCol, gambling, sales, gifts, inventory, qotd, active, resolved, boosters, globals] = await Promise.all([
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

  // ---------- Level & XP ----------
  const level = Math.max(1, num(user?.level) || 1);
  const xp = num(user?.xp);
  const needed = xpForLevel(level);
  const balance = num(user?.balance);
  const msgCount = num(user?.msgCount);
  const [levelRank, balanceRank, messageRank, ranked] = await Promise.all([
    users.countDocuments({ ...inServer, $or: [{ level: { $gt: level } }, { level, xp: { $gt: xp } }] } as never),
    users.countDocuments({ ...inServer, balance: { $gt: balance } } as never),
    users.countDocuments({ ...inServer, msgCount: { $gt: msgCount } } as never),
    users.countDocuments(inServer as never),
  ]);
  const currentRole = [...LEVEL_ROLES].reverse().find(([min]) => level >= min);
  const nextRole = LEVEL_ROLES.find(([min]) => min > level);
  const roleName = (id?: string) => (id && roles.get(id) ? cleanRoleName(roles.get(id).name) : null);

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
  const tracked = num(a.messages);
  const dayEntries = entries(a.days);
  const { current: currentStreak, longest: longestStreak } = streaks(dayEntries);
  const busiestDay = dayEntries.sort((x, y) => y[1] - x[1])[0] ?? null;

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

  // Last 26 weeks of daily counts for the calendar
  const calendar: { date: string; n: number }[] = [];
  const dayMap = new Map(dayEntries);
  for (let i = 181; i >= 0; i--) {
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
  add(a.voiceBuddies, "voiceSeconds", 1 / 600); // 10 minutes in VC together = 1 point

  const topVoiceChannels = top(a.voiceChannels, 5);
  const topBuddies = top(a.voiceBuddies, 5);
  const reactedBy = top(a.reactedBy, 1);
  const circleIds = Array.from(scores.entries()).sort((x, y) => y[1].score - x[1].score).slice(0, 12).map(([id]) => id);
  const who = await people([...circleIds, ...topBuddies.map(([id]) => id), ...reactedBy.map(([id]) => id)]).catch(() => ({} as Record<string, Person>));
  const person = (id: string) => ({ id, name: who[id]?.name ?? "Unknown member", avatar: who[id]?.avatar ?? null, inServer: who[id]?.inServer ?? false });
  // Prefer people still in the server
  const circle = circleIds
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
      nextRole: nextRole ? { name: roleName(nextRole[1]) ?? `Level ${nextRole[0]} role`, level: nextRole[0] } : null,
    },
    multipliers: { xp: Math.round(xpMultiplier * 100) / 100, leaves: Math.round(leafMultiplier * 100) / 100, patreon: patreon?.name ?? null, booster: isBooster, xpWeekend: weekend > 1, globalBooster: globalBoost > 1, consumable },
    economy: {
      balance,
      rank: balanceRank + 1,
      of: ranked,
      dailyStreak: num(user?.streak),
      bumps: num(user?.bumps),
      monthlyBumps: num(user?.monthly_bumps),
      purchases: num(salesAgg[0]?.n),
      spent: num(salesAgg[0]?.spent),
      giftsSent,
      giftsReceived,
      items,
      butterflies: num(user?.butterflies),
      crabs: num(user?.crabs),
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
    voice: {
      totalSeconds: Math.max(num(user?.vc_time_total), num(a.voiceSeconds)),
      monthSeconds: num(user?.vc_time_monthly),
      trackedSeconds: num(a.voiceSeconds),
      withOthersSeconds: num(a.voiceWithOthersSeconds),
      joins: num(a.voiceJoins),
      channels: topVoiceChannels.map(([id, s]) => ({ id, name: channels.get(id)?.name ?? "deleted channel", seconds: Math.round(s) })),
      buddies: topBuddies.map(([id, s]) => ({ ...person(id), seconds: Math.round(s) })),
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
