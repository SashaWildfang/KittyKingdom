// Looks up a member's Discord roles with the bot token so the account page can show
// their highest rank (with its color, including two/three-color gradient roles).

const STAFF_TEAM_ROLE_ID = "1358470109965979859";
// Overridable only so local tests can point at a stand-in Discord API
const DISCORD_API = process.env.DISCORD_API_BASE ?? "https://discord.com/api/v10";
const inviteCode = process.env.DISCORD_INVITE_CODE ?? "M9XKHFdYQV";

type DiscordRole = {
  id: string;
  name: string;
  position: number;
  color?: number;
  colors?: { primary_color?: number; secondary_color?: number | null; tertiary_color?: number | null };
};

export type MemberRank = {
  name: string;
  /** One color for a normal role, two or three for gradient / holographic roles. */
  colors: string[];
};

export type MemberRoleSummary = {
  rank: MemberRank | null;
  isStaff: boolean;
};

export function botToken() {
  return (
    process.env.DISCORD_BOT_TOKEN ??
    process.env.DISCORD_TOKEN ??
    process.env.BOT_TOKEN ??
    process.env.DISCORDPY_TOKEN ??
    process.env.DISCORD_PY_TOKEN
  );
}

async function discordGet<T>(path: string, token: string | null, revalidate: number): Promise<T | null> {
  try {
    const response = await fetch(`${DISCORD_API}${path}`, {
      headers: token ? { Authorization: `Bot ${token}` } : { Accept: "application/json" },
      next: { revalidate },
    });
    return response.ok ? ((await response.json()) as T) : null;
  } catch {
    return null;
  }
}

export async function guildId(): Promise<string | null> {
  if (process.env.DISCORD_GUILD_ID) return process.env.DISCORD_GUILD_ID;
  // Fall back to the server behind the public invite
  const invite = await discordGet<{ guild?: { id?: string } }>(`/invites/${inviteCode}`, null, 86400);
  return invite?.guild?.id ?? null;
}

function hex(value: number) {
  return `#${value.toString(16).padStart(6, "0")}`;
}

function roleColors(role: DiscordRole): string[] {
  const primary = role.colors?.primary_color ?? role.color ?? 0;
  if (!primary) return [];
  return [primary, role.colors?.secondary_color, role.colors?.tertiary_color]
    .filter((c): c is number => typeof c === "number" && c > 0)
    .map(hex);
}

/** The member's highest colored role (what Discord uses for their name color) and whether they're staff. */
export async function getMemberRoleSummary(discordId: unknown): Promise<MemberRoleSummary> {
  const empty = { rank: null, isStaff: false };
  const token = botToken();
  if (!discordId || !token) return empty;

  const guild = await guildId();
  if (!guild) return empty;

  const [member, roles] = await Promise.all([
    discordGet<{ roles?: string[] }>(`/guilds/${guild}/members/${String(discordId)}`, token, 120),
    discordGet<DiscordRole[]>(`/guilds/${guild}/roles`, token, 300),
  ]);
  if (!member?.roles || !roles) return empty;

  const memberRoleIds = new Set(member.roles);
  const colored = roles
    .filter((role) => memberRoleIds.has(role.id) && role.id !== guild && roleColors(role).length > 0)
    .sort((a, b) => b.position - a.position);

  const top = colored[0];
  return {
    rank: top ? { name: top.name, colors: roleColors(top) } : null,
    isStaff: memberRoleIds.has(STAFF_TEAM_ROLE_ID),
  };
}

// ==========================================
// Uncached calls used by the website store (roles, member search, DMs, log channels)
// ==========================================
async function discordRequest<T>(method: string, path: string, body?: unknown): Promise<{ ok: boolean; status: number; data: T | null }> {
  const token = botToken();
  if (!token) return { ok: false, status: 0, data: null };
  try {
    const response = await fetch(`${DISCORD_API}${path}`, {
      method,
      headers: {
        Authorization: `Bot ${token}`,
        "Content-Type": "application/json",
        "X-Audit-Log-Reason": "Kitty Kingdom website store",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
    });
    const data = response.status === 204 ? null : ((await response.json().catch(() => null)) as T | null);
    return { ok: response.ok, status: response.status, data };
  } catch {
    return { ok: false, status: 0, data: null };
  }
}

export type GuildRole = { id: string; name: string; colors: string[] };

/** Current role ids of a member (fresh, not cached), or null if they're not in the server. */
export async function getMemberRoleIds(discordId: string): Promise<string[] | null> {
  const guild = await guildId();
  if (!guild) return null;
  const res = await discordRequest<{ roles?: string[] }>("GET", `/guilds/${guild}/members/${discordId}`);
  return res.ok && res.data?.roles ? res.data.roles : null;
}

/** All server roles with their display colors (cached a few minutes). */
export async function getGuildRoles(): Promise<Map<string, GuildRole>> {
  const guild = await guildId();
  const token = botToken();
  const roles = guild && token ? await discordGet<DiscordRole[]>(`/guilds/${guild}/roles`, token, 300) : null;
  return new Map((roles ?? []).map((r) => [r.id, { id: r.id, name: r.name, colors: roleColors(r) }]));
}

export async function addMemberRole(discordId: string, roleId: string) {
  const guild = await guildId();
  return guild ? (await discordRequest("PUT", `/guilds/${guild}/members/${discordId}/roles/${roleId}`)).ok : false;
}

export async function removeMemberRole(discordId: string, roleId: string) {
  const guild = await guildId();
  return guild ? (await discordRequest("DELETE", `/guilds/${guild}/members/${discordId}/roles/${roleId}`)).ok : false;
}

export type MemberSearchResult = { id: string; username: string; displayName: string; avatar: string | null; bot: boolean };

/** Members whose username or nickname starts with the query. */
export async function searchMembers(query: string, limit = 10): Promise<MemberSearchResult[]> {
  const guild = await guildId();
  if (!guild || !query.trim()) return [];
  const res = await discordRequest<
    { nick?: string | null; avatar?: string | null; user: { id: string; username: string; global_name?: string | null; avatar?: string | null; bot?: boolean } }[]
  >("GET", `/guilds/${guild}/members/search?query=${encodeURIComponent(query.trim())}&limit=${limit}`);
  return (res.data ?? []).map((m) => ({
    id: m.user.id,
    username: m.user.username,
    displayName: m.nick ?? m.user.global_name ?? m.user.username,
    avatar: m.user.avatar ? `https://cdn.discordapp.com/avatars/${m.user.id}/${m.user.avatar}.png?size=64` : null,
    bot: Boolean(m.user.bot),
  }));
}

/** Sends a message to a channel as the bot. Mentions never ping unless listed in allowUsers. */
export async function postChannelMessage(channelId: string, payload: { content?: string; embeds?: unknown[] }, allowUsers: string[] = []) {
  return (await discordRequest("POST", `/channels/${channelId}/messages`, {
    ...payload,
    allowed_mentions: { parse: [], users: allowUsers },
  })).ok;
}

/** DMs a member as the bot (fails quietly if their DMs are closed). */
export async function sendDirectMessage(discordId: string, payload: { content?: string; embeds?: unknown[] }) {
  const dm = await discordRequest<{ id: string }>("POST", "/users/@me/channels", { recipient_id: discordId });
  return dm.ok && dm.data?.id ? postChannelMessage(dm.data.id, payload) : false;
}

/** One server member by id (fresh), or null if they're not in the server. */
export async function getGuildMember(discordId: string): Promise<MemberSearchResult | null> {
  const guild = await guildId();
  if (!guild || !/^\d{15,21}$/.test(discordId)) return null;
  const res = await discordRequest<{ nick?: string | null; user: { id: string; username: string; global_name?: string | null; avatar?: string | null; bot?: boolean } }>(
    "GET", `/guilds/${guild}/members/${discordId}`);
  if (!res.ok || !res.data) return null;
  const m = res.data;
  return {
    id: m.user.id,
    username: m.user.username,
    displayName: m.nick ?? m.user.global_name ?? m.user.username,
    avatar: m.user.avatar ? `https://cdn.discordapp.com/avatars/${m.user.id}/${m.user.avatar}.png?size=64` : null,
    bot: Boolean(m.user.bot),
  };
}
