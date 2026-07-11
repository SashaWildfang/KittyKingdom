import { NextResponse } from "next/server";
import { getCurrentUser } from "../../../lib/auth";
import {
  getBotUsersCollection,
  getUsersCollection,
} from "../../../lib/mongodb";

export const dynamic = "force-dynamic";
export const maxDuration = 10;

type SortKey =
  | "balance"
  | "level"
  | "messages"
  | "bumps"
  | "monthly_bumps"
  | "total_vc_time"
  | "monthly_vc_time";

type Order = "asc" | "desc";

type LeaderboardRow = {
  _id: string;
  discordId: string | null;
  name: string;
  username: string | null;
  balance: number;
  level: number;
  messages: number;
  bumps: number;
  monthly_bumps: number;
  total_vc_time: number;
  monthly_vc_time: number;
  isCurrentUser: boolean;
};

const sortFields: Record<SortKey, string[]> = {
  balance: ["balance", "leafs", "leaves", "wallet.balance", "economy.balance"],
  level: ["level", "rank.level", "xp.level"],
  messages: ["messages", "message_count", "messageCount", "total_messages", "totalMessages"],
  bumps: ["bumps", "total_bumps", "totalBumps"],
  monthly_bumps: ["monthly_bumps", "monthlyBumps"],
  total_vc_time: ["total_vc_time", "totalVcTime", "vc_time", "vcTime", "voice.total"],
  monthly_vc_time: ["monthly_vc_time", "monthlyVcTime", "voice.monthly"],
};

const botProjection = {
  email: 0,
  passwordHash: 0,
  passwordSalt: 0,
  emailVerificationTokenHash: 0,
  session: 0,
};

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getPathValue(source: Record<string, unknown> | undefined, path: string) {
  if (!source) return undefined;
  return path.split(".").reduce<unknown>((value, key) => {
    if (!value || typeof value !== "object") return undefined;
    return (value as Record<string, unknown>)[key];
  }, source);
}

function getNumber(source: Record<string, unknown>, fields: string[]) {
  for (const field of fields) {
    const value = getPathValue(source, field);
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() !== "") {
      const parsed = Number(value.replace(/,/g, ""));
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return 0;
}

function getText(source: Record<string, unknown> | undefined, fields: string[]) {
  for (const field of fields) {
    const value = getPathValue(source, field);
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function getDiscord(source: Record<string, unknown>) {
  const discord = source.discord as Record<string, unknown> | undefined;
  const guildMember =
    (source.guildMember as Record<string, unknown> | undefined) ??
    (source.member as Record<string, unknown> | undefined) ??
    (discord?.guildMember as Record<string, unknown> | undefined);
  const memberUser = guildMember?.user as Record<string, unknown> | undefined;

  return {
    id:
      getText(source, ["discordId", "discord_id", "userId", "user_id", "id", "discord.id"]) ??
      getText(memberUser, ["id"]),
    displayName:
      getText(guildMember, ["nick", "displayName"]) ??
      getText(source, ["discordDisplayName", "displayName", "name", "username"]) ??
      getText(discord, ["displayName", "globalName", "global_name", "username"]) ??
      getText(memberUser, ["global_name", "username"]),
    username:
      getText(source, ["username"]) ??
      getText(discord, ["username"]) ??
      getText(memberUser, ["username"]),
  };
}

function knownNonMember(source: Record<string, unknown>) {
  const discord = source.discord as Record<string, unknown> | undefined;
  const knownMembership =
    source.inServer ??
    source.isInServer ??
    source.guildMember ??
    source.member ??
    discord?.guildMember ??
    discord?.inServer;

  return knownMembership === false || knownMembership === null;
}

function matchesSearch(row: LeaderboardRow, search: string) {
  if (!search) return true;
  const haystack = [row.name, row.username, row.discordId].filter(Boolean).join(" ").toLowerCase();
  return haystack.includes(search.toLowerCase());
}

async function getLiveGuildMember(discordId: string | null) {
  const guildId = process.env.DISCORD_GUILD_ID;
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!guildId || !token || !discordId) return null;

  try {
    const response = await fetch(
      `https://discord.com/api/v10/guilds/${guildId}/members/${discordId}`,
      {
        headers: {
          Authorization: `Bot ${token}`,
          Accept: "application/json",
          "User-Agent": "KittyKingdomBot/1.0 (+https://kittykingdom.net)",
        },
        cache: "no-store",
      },
    );

    if (response.status === 404) return false;
    if (!response.ok) return null;
    return (await response.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function toLeaderboardRow(
  source: Record<string, unknown>,
  currentDiscordId: string | null,
  sourcePrefix: string,
): LeaderboardRow | null {
  if (knownNonMember(source)) return null;

  const discord = getDiscord(source);
  if (!discord.id) return null;

  return {
    _id: `${sourcePrefix}:${String(source._id ?? discord.id)}`,
    discordId: discord.id,
    name: discord.displayName ?? discord.id,
    username: discord.username,
    balance: getNumber(source, sortFields.balance),
    level: getNumber(source, sortFields.level),
    messages: getNumber(source, sortFields.messages),
    bumps: getNumber(source, sortFields.bumps),
    monthly_bumps: getNumber(source, sortFields.monthly_bumps),
    total_vc_time: getNumber(source, sortFields.total_vc_time),
    monthly_vc_time: getNumber(source, sortFields.monthly_vc_time),
    isCurrentUser: Boolean(currentDiscordId && discord.id === currentDiscordId),
  };
}

function mergeRows(rows: LeaderboardRow[]) {
  const byDiscordId = new Map<string, LeaderboardRow>();

  for (const row of rows) {
    if (!row.discordId) continue;
    const existing = byDiscordId.get(row.discordId);
    if (!existing) {
      byDiscordId.set(row.discordId, row);
      continue;
    }

    byDiscordId.set(row.discordId, {
      ...existing,
      ...row,
      _id: existing._id,
      name: row.name !== row.discordId ? row.name : existing.name,
      username: row.username ?? existing.username,
      isCurrentUser: existing.isCurrentUser || row.isCurrentUser,
    });
  }

  return [...byDiscordId.values()];
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const search = (url.searchParams.get("search") ?? "").trim().slice(0, 80);
    const sort = (url.searchParams.get("sort") ?? "balance") as SortKey;
    const order = url.searchParams.get("order") === "asc" ? "asc" : "desc";
    const requestedPage = Number(url.searchParams.get("page") ?? "1");
    const requestedPageSize = Number(url.searchParams.get("pageSize") ?? "25");
    const page = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;
    const pageSize = Math.min(
      100,
      Math.max(10, Number.isFinite(requestedPageSize) ? requestedPageSize : 25),
    );
    const sortKey: SortKey = Object.prototype.hasOwnProperty.call(sortFields, sort)
      ? sort
      : "balance";

    const [websiteUsers, botUsers, currentUser] = await Promise.all([
      getUsersCollection(),
      getBotUsersCollection(),
      getCurrentUser(),
    ]);

    const escapedSearch = escapeRegex(search);
    const searchQuery = escapedSearch
      ? {
          $or: [
            { username: { $regex: escapedSearch, $options: "i" } },
            { displayName: { $regex: escapedSearch, $options: "i" } },
            { name: { $regex: escapedSearch, $options: "i" } },
            { discordId: { $regex: escapedSearch, $options: "i" } },
            { discord_id: { $regex: escapedSearch, $options: "i" } },
            { userId: { $regex: escapedSearch, $options: "i" } },
            { user_id: { $regex: escapedSearch, $options: "i" } },
            { "discord.username": { $regex: escapedSearch, $options: "i" } },
            { "discord.globalName": { $regex: escapedSearch, $options: "i" } },
            { "discord.guildMember.nick": { $regex: escapedSearch, $options: "i" } },
            { "guildMember.nick": { $regex: escapedSearch, $options: "i" } },
          ],
        }
      : {};

    const [rawWebsiteUsers, rawBotUsers] = (await Promise.all([
      websiteUsers.find(searchQuery).project(botProjection).limit(500).toArray(),
      botUsers.find(searchQuery).project(botProjection).limit(1000).toArray(),
    ])) as [Record<string, unknown>[], Record<string, unknown>[]];

    const currentDiscordId = getText(currentUser ?? undefined, ["discordId", "discord_id", "discord.id"]);
    const merged = mergeRows([
      ...rawWebsiteUsers.map((user) => toLeaderboardRow(user, currentDiscordId, "site")),
      ...rawBotUsers.map((user) => toLeaderboardRow(user, currentDiscordId, "bot")),
    ].filter(Boolean) as LeaderboardRow[]).filter((row) => matchesSearch(row, search));

    const sorted = merged.sort((a, b) => {
      const comparison = a[sortKey] - b[sortKey];
      return order === "asc" ? comparison : -comparison;
    });

    const currentRank = currentDiscordId
      ? sorted.findIndex((row) => row.discordId === currentDiscordId) + 1
      : 0;
    const currentRow = currentRank > 0 ? sorted[currentRank - 1] : null;

    const pageRows = sorted.slice((page - 1) * pageSize, page * pageSize);
    const rowsWithDiscord = await Promise.all(
      pageRows.map(async (row) => {
        const liveMember = await getLiveGuildMember(row.discordId);
        if (liveMember === false) return null;
        const liveUser = liveMember?.user as Record<string, unknown> | undefined;
        return {
          ...row,
          name:
            getText(liveMember ?? undefined, ["nick", "displayName"]) ??
            getText(liveUser, ["global_name", "username"]) ??
            row.name,
        };
      }),
    );

    const rows = rowsWithDiscord.filter(Boolean);

    return NextResponse.json({
      rows,
      total: sorted.length,
      page,
      pageSize,
      sort: sortKey,
      order: order as Order,
      currentRank,
      currentValue: currentRow ? currentRow[sortKey] : null,
    });
  } catch (error) {
    console.error("Leaderboard lookup failed", error);
    return NextResponse.json(
      { rows: [], total: 0, error: "Leaderboard data is temporarily unavailable." },
      { status: 500 },
    );
  }
}
