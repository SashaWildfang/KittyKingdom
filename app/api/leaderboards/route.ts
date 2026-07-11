import { NextResponse } from "next/server";
import { getCurrentUser } from "../../../lib/auth";
import { getUsersCollection } from "../../../lib/mongodb";

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

const sortFields: Record<SortKey, string[]> = {
  balance: ["balance", "leafs", "leaves"],
  level: ["level"],
  messages: ["messages", "message_count"],
  bumps: ["bumps", "total_bumps"],
  monthly_bumps: ["monthly_bumps", "monthlyBumps"],
  total_vc_time: ["total_vc_time", "totalVcTime", "vc_time", "vcTime"],
  monthly_vc_time: ["monthly_vc_time", "monthlyVcTime"],
};

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getNumber(source: Record<string, unknown>, fields: string[]) {
  for (const field of fields) {
    const value = source[field];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() !== "") {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return 0;
}

function getText(source: Record<string, unknown>, fields: string[]) {
  for (const field of fields) {
    const value = source[field];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function getDiscord(source: Record<string, unknown>) {
  const discord = source.discord as Record<string, unknown> | undefined;
  const guildMember = discord?.guildMember as Record<string, unknown> | undefined;
  const memberUser = guildMember?.user as Record<string, unknown> | undefined;
  const displayName =
    getText(source, ["discordDisplayName", "displayName", "name"]) ??
    getText(discord ?? {}, ["displayName", "globalName", "global_name", "username"]);

  return {
    id:
      getText(source, ["discordId", "discord_id", "userId", "user_id", "id"]) ??
      getText(discord ?? {}, ["id"]) ??
      getText(memberUser ?? {}, ["id"]),
    displayName: guildMember?.nick
      ? String(guildMember.nick)
      : displayName ?? getText(memberUser ?? {}, ["global_name", "username"]),
    username:
      getText(discord ?? {}, ["username"]) ??
      getText(memberUser ?? {}, ["username"]),
    guildMember,
  };
}

function shouldHideNonMembers(source: Record<string, unknown>) {
  const discord = source.discord as Record<string, unknown> | undefined;
  const knownMembership =
    source.inServer ??
    source.isInServer ??
    source.guildMember ??
    discord?.guildMember ??
    discord?.inServer;

  return knownMembership === false || knownMembership === null;
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

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const search = (url.searchParams.get("search") ?? "").trim().slice(0, 80);
    const sort = (url.searchParams.get("sort") ?? "balance") as SortKey;
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

    const [users, currentUser] = await Promise.all([
      getUsersCollection(),
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
            { "discord.username": { $regex: escapedSearch, $options: "i" } },
            { "discord.globalName": { $regex: escapedSearch, $options: "i" } },
            { "discord.guildMember.nick": { $regex: escapedSearch, $options: "i" } },
          ],
        }
      : {};

    const rawUsers = (await users
      .find(searchQuery)
      .project({
        email: 0,
        passwordHash: 0,
        passwordSalt: 0,
        emailVerificationTokenHash: 0,
        session: 0,
      })
      .limit(500)
      .toArray()) as Record<string, unknown>[];

    const sorted = rawUsers
      .filter((user) => !shouldHideNonMembers(user))
      .map((user) => {
        const discord = getDiscord(user);
        return {
          _id: String(user._id ?? ""),
          discordId: discord.id,
          name:
            discord.displayName ??
            getText(user, ["username", "displayName", "name"]) ??
            discord.id ??
            "Unknown member",
          username: getText(user, ["username"]),
          balance: getNumber(user, sortFields.balance),
          level: getNumber(user, sortFields.level),
          messages: getNumber(user, sortFields.messages),
          bumps: getNumber(user, sortFields.bumps),
          monthly_bumps: getNumber(user, sortFields.monthly_bumps),
          total_vc_time: getNumber(user, sortFields.total_vc_time),
          monthly_vc_time: getNumber(user, sortFields.monthly_vc_time),
          isCurrentUser: currentUser ? String(user._id ?? "") === String(currentUser._id) : false,
        };
      })
      .filter((user) => Boolean(user.discordId))
      .sort((a, b) => b[sortKey] - a[sortKey]);

    const pageRows = sorted.slice((page - 1) * pageSize, page * pageSize);
    const rowsWithDiscord = await Promise.all(
      pageRows.map(async (row) => {
        const liveMember = await getLiveGuildMember(row.discordId);
        if (liveMember === false) return null;
        const liveUser = liveMember?.user as Record<string, unknown> | undefined;
        return {
          ...row,
          name:
            (liveMember?.nick ? String(liveMember.nick) : null) ??
            getText(liveUser ?? {}, ["global_name", "username"]) ??
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
    });
  } catch (error) {
    console.error("Leaderboard lookup failed", error);
    return NextResponse.json(
      { rows: [], total: 0, error: "Leaderboard data is temporarily unavailable." },
      { status: 500 },
    );
  }
}
