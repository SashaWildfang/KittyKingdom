// Punishments (bans, kicks, mutes, warns, unbans...) written by the bot's moderation commands and
// AutoMod. The two write slightly different shapes (user_discord_id vs discordId, etc.), so every
// query first normalizes them into one shape.

import type { Document } from "mongodb";
import { getBotCollection, getMongoClient } from "./mongodb";
import { DISCORD_API, botToken, guildId } from "./discord-member";
import { userTimeZone } from "./timezone";

export type PunishmentSource = "automod" | "manual";
export type PunishmentStatus = "active" | "ended" | "none";

export type Punishment = {
  id: string;
  action: string;
  userId: string | null;
  issuerId: string | null;
  reason: string;
  timestamp: string;
  durationSeconds: number | null;
  expiresAt: string | null;
  extraInfo: string | null;
  messageContent: string | null;
  source: PunishmentSource;
  status: PunishmentStatus;
};

export type PunishmentQuery = {
  actions?: string[];
  search?: string;
  /** Exact reason (ignoring case and surrounding spaces), for the "top reasons" drill-down */
  reason?: string;
  userId?: string;
  issuerId?: string;
  source?: PunishmentSource | "all";
  status?: PunishmentStatus | "all";
  from?: Date | null;
  to?: Date | null;
  sort?: "timestamp" | "action" | "userId" | "issuerId";
  order?: "asc" | "desc";
  page?: number;
  pageSize?: number;
  /** Also count reasons, issuers and sources across every match (not just this page) */
  summary?: boolean;
};

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// ==========================================
// Discord lookups (cached)
// ==========================================
let botUserId: { id: string | null; at: number } | null = null;
let banCache: { ids: Set<string>; at: number } | null = null;

async function discordGet<T>(path: string): Promise<T | null> {
  const token = botToken();
  if (!token) return null;
  try {
    const response = await fetch(`${DISCORD_API}${path}`, { headers: { Authorization: `Bot ${token}` }, cache: "no-store" });
    return response.ok ? ((await response.json()) as T) : null;
  } catch {
    return null;
  }
}

/** The bot's own user id; punishments it issued came from AutoMod or automatic checks. */
export async function getBotUserId() {
  if (botUserId && Date.now() - botUserId.at < 3_600_000) return botUserId.id;
  const me = await discordGet<{ id: string }>("/users/@me");
  botUserId = { id: me?.id ?? null, at: Date.now() };
  return botUserId.id;
}

/** Everyone currently banned from the server (cached for a minute). Null if Discord can't be reached. */
export async function getCurrentBans(): Promise<Set<string> | null> {
  if (banCache && Date.now() - banCache.at < 60_000) return banCache.ids;
  const guild = await guildId();
  if (!guild) return null;
  const ids = new Set<string>();
  let after = "0";
  for (let page = 0; page < 20; page += 1) {
    const bans = await discordGet<{ user: { id: string } }[]>(`/guilds/${guild}/bans?limit=1000&after=${after}`);
    if (!bans) return banCache?.ids ?? null;
    for (const ban of bans) ids.add(ban.user.id);
    if (bans.length < 1000) break;
    after = bans[bans.length - 1].user.id;
  }
  banCache = { ids, at: Date.now() };
  return ids;
}

// ==========================================
// Normalizing
// ==========================================
const asId = (a: string, b: string) => ({
  $cond: [{ $eq: [{ $ifNull: [a, b] }, null] }, null, { $toString: { $ifNull: [a, b] } }],
});

/** Pipeline stage that gives every punishment the same field names. */
function normalizeStages(botId: string | null): Document[] {
  return [
    {
      $addFields: {
        n_user: asId("$user_discord_id", "$discordId"),
        n_issuer: asId("$issuer_discord_id", "$issuerId"),
        n_duration: { $ifNull: ["$duration_seconds", "$durationSeconds"] },
        n_expires: { $ifNull: ["$expires_at", "$expiresAt"] },
        n_extra: { $ifNull: ["$extra_info", "$extraInfo"] },
        n_action: { $toLower: { $ifNull: ["$action", "unknown"] } },
        // Automatic: AutoMod tags every record it writes (it runs on the separate moderation bot, so the
        // issuer isn't the main bot), or issued by the main bot itself (automatic kicks), or a reason
        // that says AutoMod
        n_source: {
          $cond: [
            {
              $or: [
                { $eq: [{ $ifNull: ["$extra_info", "$extraInfo"] }, "AutoMod"] },
                { $and: [{ $ne: [botId, null] }, { $eq: [asId("$issuer_discord_id", "$issuerId"), botId] }] },
                { $regexMatch: { input: { $toString: { $ifNull: ["$reason", ""] } }, regex: "automod", options: "i" } },
              ],
            },
            "automod",
            "manual",
          ],
        },
      },
    },
  ];
}

function toPunishment(doc: Document, bans: Set<string> | null): Punishment {
  const action = String(doc.n_action);
  // AutoMod's records keep the strike's decay in expiresAt; for its mutes the mute itself ends at muteEndsAt
  // (or after its duration). Tempmutes and muzzles end at expiresAt.
  const strike = doc.extraInfo !== undefined;
  const muteLike = ["mute", "tempmute", "timeout", "muzzle"].includes(action);
  const fromLength = doc.timestamp instanceof Date && Number(doc.n_duration) > 0 ? new Date(doc.timestamp.getTime() + Number(doc.n_duration) * 1000) : null;
  const expires =
    strike && muteLike
      ? doc.muteEndsAt instanceof Date
        ? doc.muteEndsAt
        : fromLength
      : doc.n_expires instanceof Date
        ? doc.n_expires
        : null;
  const userId = doc.n_user ? String(doc.n_user) : null;
  let status: PunishmentStatus = "none";
  if (action === "ban" || action === "tempban") {
    status = bans && userId ? (bans.has(userId) ? "active" : "ended") : "none";
  } else if (["mute", "tempmute", "timeout", "warn", "muzzle"].includes(action) && expires) {
    status = expires.getTime() > Date.now() && doc.active !== false ? "active" : "ended";
  }
  return {
    id: String(doc._id),
    action,
    userId,
    issuerId: doc.n_issuer ? String(doc.n_issuer) : null,
    reason: String(doc.reason ?? ""),
    timestamp: (doc.timestamp instanceof Date ? doc.timestamp : new Date(0)).toISOString(),
    // Older mutes didn't save a length: work it out from when it was given and when it ends
    durationSeconds:
      typeof doc.n_duration === "number"
        ? doc.n_duration
        : doc.n_duration
          ? Number(doc.n_duration)
          : expires && doc.timestamp instanceof Date && expires.getTime() > doc.timestamp.getTime()
            ? Math.round((expires.getTime() - doc.timestamp.getTime()) / 1000)
            : null,
    expiresAt: expires ? expires.toISOString() : null,
    extraInfo: doc.n_extra ? String(doc.n_extra) : null,
    messageContent: doc.messageContent ? String(doc.messageContent) : null,
    source: doc.n_source === "automod" ? "automod" : "manual",
    status,
  };
}

/** Discord ids of members whose name matches the search (from the cached member directory). */
async function idsMatchingName(search: string): Promise<string[]> {
  if (search.length < 2) return [];
  const client = await getMongoClient();
  const regex = new RegExp(escapeRegex(search), "i");
  const docs = await client
    .db(process.env.MONGODB_DB ?? "website")
    .collection("member_directory")
    .find({ $or: [{ username: regex }, { displayName: regex }] }, { projection: { _id: 1 } })
    .limit(200)
    .toArray();
  return docs.map((d) => String(d._id));
}

// ==========================================
// Queries
// ==========================================
export async function queryPunishments(q: PunishmentQuery) {
  const [col, botId, bans] = await Promise.all([getBotCollection("punishments"), getBotUserId(), getCurrentBans()]);
  const match: Document = {};
  if (q.actions?.length) match.n_action = { $in: q.actions.map((a) => a.toLowerCase()) };
  if (q.userId) match.n_user = q.userId;
  if (q.issuerId) match.n_issuer = q.issuerId;
  if (q.reason?.trim()) match.reason = new RegExp(`^\\s*${escapeRegex(q.reason.trim().slice(0, 500))}\\s*$`, "i");
  if (q.source && q.source !== "all") match.n_source = q.source;
  if (q.from || q.to) match.timestamp = { ...(q.from ? { $gte: q.from } : {}), ...(q.to ? { $lte: q.to } : {}) };

  const search = q.search?.trim().slice(0, 100);
  if (search) {
    const regex = new RegExp(escapeRegex(search), "i");
    const nameIds = await idsMatchingName(search);
    match.$or = [
      { n_user: { $regex: regex } },
      { n_issuer: { $regex: regex } },
      { reason: regex },
      { n_extra: regex },
      { messageContent: regex },
      { n_action: regex },
      ...(nameIds.length ? [{ n_user: { $in: nameIds } }, { n_issuer: { $in: nameIds } }] : []),
    ];
  }

  // Ban status comes from Discord, not the database
  const status = q.status && q.status !== "all" ? q.status : null;
  if (status && bans) {
    const banned = Array.from(bans);
    const now = new Date();
    const activeCond = {
      $or: [
        { n_action: { $in: ["ban", "tempban"] }, n_user: { $in: banned } },
        { n_action: { $in: ["mute", "tempmute", "timeout", "warn", "muzzle"] }, n_expires: { $gt: now }, active: { $ne: false } },
      ],
    };
    const endedCond = {
      $or: [
        { n_action: { $in: ["ban", "tempban"] }, n_user: { $nin: banned } },
        { n_action: { $in: ["mute", "tempmute", "timeout", "warn", "muzzle"] }, $or: [{ n_expires: { $lte: now } }, { active: false }] },
      ],
    };
    match.$and = [...(match.$and ?? []), status === "active" ? activeCond : status === "ended" ? endedCond : { n_action: { $nin: ["ban", "tempban", "mute", "tempmute", "timeout", "warn", "muzzle"] } }];
  }

  const sortField = { timestamp: "timestamp", action: "n_action", userId: "n_user", issuerId: "n_issuer" }[q.sort ?? "timestamp"] ?? "timestamp";
  const order = q.order === "asc" ? 1 : -1;
  const pageSize = Math.min(100, Math.max(10, q.pageSize ?? 25));
  const page = Math.max(1, q.page ?? 1);

  const [result] = await col
    .aggregate(
      [
        ...normalizeStages(botId),
        { $match: match },
        {
          $facet: {
            rows: [{ $sort: { [sortField]: order, _id: order } }, { $skip: (page - 1) * pageSize }, { $limit: pageSize }],
            total: [{ $count: "n" }],
            ...(q.summary
              ? {
                  // Grouped ignoring case, shown with the original wording
                  reasons: [
                    { $group: { _id: { $toLower: { $trim: { input: { $toString: { $ifNull: ["$reason", ""] } } } } }, n: { $sum: 1 }, text: { $first: "$reason" } } },
                    { $sort: { n: -1 } },
                    { $limit: 40 },
                  ],
                  issuers: [{ $match: { n_issuer: { $ne: null } } }, { $group: { _id: "$n_issuer", n: { $sum: 1 }, auto: { $max: { $eq: ["$n_source", "automod"] } } } }, { $sort: { n: -1 } }, { $limit: 8 }],
                  sources: [{ $group: { _id: "$n_source", n: { $sum: 1 } } }],
                }
              : {}),
          },
        },
      ],
    )
    .toArray();

  return {
    rows: ((result?.rows ?? []) as Document[]).map((doc) => toPunishment(doc, bans)) as Punishment[],
    total: result?.total?.[0]?.n ?? 0,
    page,
    pageSize,
    summary: q.summary
      ? {
          reasons: ((result?.reasons ?? []) as Document[]).map((d) => ({ reason: d._id ? String(d.text ?? d._id).trim() : "", count: d.n as number })),
          issuers: ((result?.issuers ?? []) as Document[]).map((d) => ({ id: String(d._id), count: d.n as number, automod: d.auto === true || String(d._id) === botId })),
          sources: Object.fromEntries(((result?.sources ?? []) as Document[]).map((d) => [String(d._id), d.n as number])) as Record<string, number>,
        }
      : null,
  };
}

export type StatsQuery = {
  from?: Date | null;
  to?: Date | null;
  unit: "day" | "week" | "month";
  actions?: string[];
  source?: PunishmentSource | "all";
};

export async function punishmentStats(q: StatsQuery) {
  const [col, botId, bans] = await Promise.all([getBotCollection("punishments"), getBotUserId(), getCurrentBans()]);
  const match: Document = {};
  if (q.from || q.to) match.timestamp = { ...(q.from ? { $gte: q.from } : {}), ...(q.to ? { $lte: q.to } : {}) };
  if (q.actions?.length) match.n_action = { $in: q.actions.map((a) => a.toLowerCase()) };
  if (q.source && q.source !== "all") match.n_source = q.source;

  const [result] = await col
    .aggregate([
      ...normalizeStages(botId),
      { $match: match },
      {
        $facet: {
          byAction: [{ $group: { _id: "$n_action", n: { $sum: 1 } } }, { $sort: { n: -1 } }],
          bySource: [{ $group: { _id: "$n_source", n: { $sum: 1 } } }],
          timeline: [
            { $group: { _id: { t: { $dateTrunc: { date: "$timestamp", unit: q.unit, timezone: userTimeZone() } }, a: "$n_action" }, n: { $sum: 1 } } },
            { $sort: { "_id.t": 1 } },
          ],
          topUsers: [{ $match: { n_user: { $ne: null } } }, { $group: { _id: "$n_user", n: { $sum: 1 }, last: { $max: "$timestamp" } } }, { $sort: { n: -1, last: -1 } }, { $limit: 10 }],
          topIssuers: [{ $match: { n_issuer: { $ne: null } } }, { $group: { _id: "$n_issuer", n: { $sum: 1 }, auto: { $max: { $eq: ["$n_source", "automod"] } } } }, { $sort: { n: -1 } }, { $limit: 10 }],
          // Grouped ignoring case, shown with the original wording
          topReasons: [
            { $group: { _id: { $toLower: { $trim: { input: { $toString: { $ifNull: ["$reason", ""] } } } } }, n: { $sum: 1 }, text: { $first: "$reason" } } },
            { $sort: { n: -1 } },
            { $limit: 8 },
          ],
          hours: [{ $group: { _id: { $hour: { date: "$timestamp", timezone: userTimeZone() } }, n: { $sum: 1 } } }],
          total: [{ $count: "n" }],
        },
      },
    ])
    .toArray();

  return {
    total: result?.total?.[0]?.n ?? 0,
    byAction: (result?.byAction ?? []).map((d: Document) => ({ action: String(d._id), count: d.n as number })),
    bySource: Object.fromEntries((result?.bySource ?? []).map((d: Document) => [String(d._id), d.n as number])),
    timeline: (result?.timeline ?? []).map((d: Document) => ({ bucket: (d._id.t as Date).toISOString(), action: String(d._id.a), count: d.n as number })),
    topUsers: ((result?.topUsers ?? []) as Document[]).map((d) => ({ id: String(d._id), count: d.n as number, last: (d.last as Date)?.toISOString() ?? null })) as { id: string; count: number; last: string | null }[],
    topIssuers: ((result?.topIssuers ?? []) as Document[]).map((d) => ({ id: String(d._id), count: d.n as number, automod: d.auto === true || String(d._id) === botId })) as { id: string; count: number; automod: boolean }[],
    topReasons: ((result?.topReasons ?? []) as Document[]).filter((d) => d._id).map((d) => ({ reason: String(d.text ?? d._id).trim(), count: d.n as number })) as { reason: string; count: number }[],
    hours: Array.from({ length: 24 }, (_, h) => (result?.hours ?? []).find((d: Document) => d._id === h)?.n ?? 0) as number[],
    currentlyBanned: bans?.size ?? null,
  };
}

/** Every action type seen so far, for the filter chips. */
export async function punishmentActions(): Promise<string[]> {
  const col = await getBotCollection("punishments");
  const actions = (await col.distinct("action")) as string[];
  return Array.from(new Set(actions.filter(Boolean).map((a) => a.toLowerCase()))).sort();
}
