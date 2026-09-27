// Turns the raw Discord mentions in punishment reasons (<#channel>, <@&role>, <@user>) into names.
// Custom emojis (<:name:id>) don't need a lookup; the page loads them from Discord's CDN.

import { DISCORD_API, botToken, getGuildRoles, guildId } from "./discord-member";

let channelCache: { names: Map<string, string>; at: number } | null = null;

async function guildChannels(): Promise<Map<string, string>> {
  if (channelCache && Date.now() - channelCache.at < 5 * 60_000) return channelCache.names;
  const guild = await guildId();
  const token = botToken();
  if (!guild || !token) return new Map();
  try {
    const response = await fetch(`${DISCORD_API}/guilds/${guild}/channels`, { headers: { Authorization: `Bot ${token}` }, cache: "no-store" });
    if (!response.ok) return channelCache?.names ?? new Map();
    const channels = (await response.json()) as { id: string; name: string }[];
    channelCache = { names: new Map(channels.map((c) => [c.id, c.name])), at: Date.now() };
    return channelCache.names;
  } catch {
    return channelCache?.names ?? new Map();
  }
}

export type Mentions = {
  channels: Record<string, string>;
  roles: Record<string, { name: string; color: string | null }>;
};

/** Names for every channel and role mentioned in these texts, plus the user ids mentioned. */
export async function resolveMentions(texts: (string | null | undefined)[]): Promise<{ mentions: Mentions; userIds: string[] }> {
  const joined = texts.filter(Boolean).join("\n");
  const channelIds = Array.from(new Set(Array.from(joined.matchAll(/<#(\d{15,21})>/g), (m) => m[1])));
  const roleIds = Array.from(new Set(Array.from(joined.matchAll(/<@&(\d{15,21})>/g), (m) => m[1])));
  const userIds = Array.from(new Set(Array.from(joined.matchAll(/<@!?(\d{15,21})>/g), (m) => m[1])));

  const mentions: Mentions = { channels: {}, roles: {} };
  if (channelIds.length) {
    const names = await guildChannels();
    for (const id of channelIds) if (names.has(id)) mentions.channels[id] = names.get(id)!;
  }
  if (roleIds.length) {
    const roles = await getGuildRoles();
    for (const id of roleIds) {
      const role = roles.get(id);
      if (role) mentions.roles[id] = { name: role.name, color: role.colors[0] ?? null };
    }
  }
  return { mentions, userIds };
}
