// Looks up a member's Discord roles with the bot token so the account page can show
// their highest rank (with its color, including two/three-color gradient roles).

const STAFF_TEAM_ROLE_ID = "1358470109965979859";
// Overridable only so local tests can point at a stand-in Discord API
export const DISCORD_API = process.env.DISCORD_API_BASE ?? "https://discord.com/api/v10";
const inviteCode = process.env.DISCORD_INVITE_CODE ?? "M9XKHFdYQV";

type DiscordRole = {
  id: string;
  name: string;
  position: number;
  managed?: boolean;
  color?: number;
  colors?: { primary_color?: number; secondary_color?: number | null; tertiary_color?: number | null };
  icon?: string | null;
  unicode_emoji?: string | null;
};

export type MemberRank = {
  name: string;
  /** One color for a normal role, two or three for gradient / holographic roles. */
  colors: string[];
};

export type MemberRoleSummary = {
  /** Server nickname and Discord username (for the display-name fallback). */
  nick?: string | null;
  username?: string | null;
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
  const empty: MemberRoleSummary = { rank: null, isStaff: false };
  const token = botToken();
  if (!discordId || !token) return empty;

  const guild = await guildId();
  if (!guild) return empty;

  const [member, roles] = await Promise.all([
    discordGet<{ roles?: string[]; nick?: string | null; user?: { username?: string } }>(`/guilds/${guild}/members/${String(discordId)}`, token, 120),
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
    nick: member.nick ?? null,
    username: member.user?.username ?? null,
  };
}

// ==========================================
// Uncached calls used by the website store (roles, member search, DMs, log channels)
// ==========================================
async function discordRequest<T>(method: string, path: string, body?: unknown): Promise<{ ok: boolean; status: number; data: T | null }> {
  const token = botToken();
  if (!token) return { ok: false, status: 0, data: null };
  // Discord rate limits (429) and brief hiccups (5xx / network) get a couple of quick retries
  for (let attempt = 0; attempt < 3; attempt += 1) {
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
      if ((response.status === 429 || response.status >= 500) && attempt < 2) {
        const wait = Number((data as { retry_after?: number } | null)?.retry_after ?? response.headers.get("retry-after") ?? 0.5);
        await new Promise((r) => setTimeout(r, Math.min(3000, Math.max(250, wait * 1000))));
        continue;
      }
      return { ok: response.ok, status: response.status, data };
    } catch {
      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, 300));
        continue;
      }
      return { ok: false, status: 0, data: null };
    }
  }
  return { ok: false, status: 0, data: null };
}

export type GuildRole = {
  id: string;
  name: string;
  colors: string[];
  position: number;
  managed: boolean;
  /** Role icon image (boosted servers) or its emoji, when it has one. */
  icon?: string | null;
  emoji?: string | null;
};

/** Current role ids of a member (fresh, not cached), or null if they're not in the server. */
/**
 * A member's roles, and whether Discord actually answered: `definitive` is true for a real answer
 * (roles, or "not in the server"), false when Discord couldn't be reached.
 */
export async function memberRolesChecked(discordId: string): Promise<{ roles: string[] | null; definitive: boolean }> {
  const guild = await guildId();
  if (!guild) return { roles: null, definitive: false };
  const res = await discordRequest<{ roles?: string[]; code?: number }>("GET", `/guilds/${guild}/members/${discordId}`);
  if (res.ok && res.data?.roles) return { roles: res.data.roles, definitive: true };
  if (res.status === 404) return { roles: null, definitive: true };
  return { roles: null, definitive: false };
}

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
  return new Map(
    (roles ?? []).map((r) => [
      r.id,
      {
        id: r.id,
        name: r.name,
        colors: roleColors(r),
        position: r.position,
        managed: Boolean(r.managed),
        icon: r.icon ? `https://cdn.discordapp.com/role-icons/${r.id}/${r.icon}.webp?size=96&quality=lossless` : null,
        emoji: r.unicode_emoji ?? null,
      },
    ]),
  );
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

// ==========================================
// Channels and permissions (Live Chat)
// ==========================================
export type RawOverwrite = { id: string; type: 0 | 1; allow: string; deny: string };
export type RawChannel = { id: string; name: string; type: number; parent_id: string | null; position: number; nsfw?: boolean; permission_overwrites?: RawOverwrite[] };
type RawRole = { id: string; permissions: string };

/** Every channel in the server with its permission overwrites (cached a minute). */
export async function getGuildChannelsRaw(): Promise<RawChannel[]> {
  const guild = await guildId();
  const token = botToken();
  if (!guild || !token) return [];
  return (await discordGet<RawChannel[]>(`/guilds/${guild}/channels`, token, 60)) ?? [];
}

const VIEW_CHANNEL = BigInt(1 << 10);
const ADMINISTRATOR = BigInt(1 << 3);

/**
 * Ids of the channels this member can see in Discord, worked out the same way Discord does:
 * @everyone + their roles, then the channel's @everyone, role and member overwrites.
 */
export async function viewableChannelIds(discordId: string): Promise<Set<string>> {
  const guild = await guildId();
  const token = botToken();
  if (!guild || !token) return new Set();
  const [channels, roles, info, memberRoles] = await Promise.all([
    getGuildChannelsRaw(),
    discordGet<RawRole[]>(`/guilds/${guild}/roles`, token, 60),
    discordGet<{ owner_id?: string }>(`/guilds/${guild}`, token, 300),
    getMemberRoleIds(discordId),
  ]);
  if (!memberRoles || !roles) return new Set();
  const perms = new Map(roles.map((r) => [r.id, BigInt(r.permissions)]));
  const mine = new Set([guild, ...memberRoles]);
  let base = BigInt(0);
  mine.forEach((id) => {
    base |= perms.get(id) ?? BigInt(0);
  });
  const all = info?.owner_id === discordId || (base & ADMINISTRATOR) === ADMINISTRATOR;

  const visible = new Set<string>();
  for (const channel of channels) {
    if (all) {
      visible.add(channel.id);
      continue;
    }
    let p = base;
    const overwrites = channel.permission_overwrites ?? [];
    const everyone = overwrites.find((o) => o.id === guild);
    if (everyone) p = (p & ~BigInt(everyone.deny)) | BigInt(everyone.allow);
    let allow = BigInt(0);
    let deny = BigInt(0);
    for (const o of overwrites) {
      if (o.type === 0 && o.id !== guild && mine.has(o.id)) {
        allow |= BigInt(o.allow);
        deny |= BigInt(o.deny);
      }
    }
    p = (p & ~deny) | allow;
    const member = overwrites.find((o) => o.type === 1 && o.id === discordId);
    if (member) p = (p & ~BigInt(member.deny)) | BigInt(member.allow);
    if ((p & VIEW_CHANNEL) === VIEW_CHANNEL) visible.add(channel.id);
  }
  return visible;
}

/** Deletes a message as the bot, with a note in Discord's audit log. */
export async function deleteChannelMessage(channelId: string, messageId: string, reason: string) {
  const token = botToken();
  if (!token) return { ok: false, status: 0 };
  try {
    const response = await fetch(`${DISCORD_API}/channels/${channelId}/messages/${messageId}`, {
      method: "DELETE",
      headers: { Authorization: `Bot ${token}`, "X-Audit-Log-Reason": encodeURIComponent(reason.slice(0, 400)) },
      cache: "no-store",
    });
    return { ok: response.ok || response.status === 404, status: response.status };
  } catch {
    return { ok: false, status: 0 };
  }
}

const membershipCache = new Map<string, { inServer: boolean; at: number }>();

/**
 * Whether someone is in the server: true / false, or null if Discord couldn't say (errors never
 * count as "left"). Cached for a few minutes.
 */
export async function isInServer(discordId: string): Promise<boolean | null> {
  const cached = membershipCache.get(discordId);
  if (cached && Date.now() - cached.at < 5 * 60_000) return cached.inServer;
  const guild = await guildId();
  if (!guild) return null;
  const res = await discordRequest<{ code?: number }>("GET", `/guilds/${guild}/members/${discordId}`);
  // 404 "Unknown Member" (10007) is the only answer that means they're not here
  const inServer = res.ok ? true : res.status === 404 && (res.data?.code === 10007 || res.data?.code === undefined) ? false : null;
  if (inServer !== null) membershipCache.set(discordId, { inServer, at: Date.now() });
  return inServer;
}

export type MemberProfile = {
  nick: string | null;
  username: string;
  globalName: string | null;
  joinedAt: string | null;
  boostingSince: string | null;
  roles: string[];
};

/** A member's server profile (join date, roles, nickname), cached for two minutes. */
export async function getMemberProfile(discordId: string): Promise<MemberProfile | null> {
  const guild = await guildId();
  const token = botToken();
  if (!guild || !token || !/^\d{15,21}$/.test(discordId)) return null;
  const m = await discordGet<{
    nick?: string | null;
    joined_at?: string | null;
    premium_since?: string | null;
    roles?: string[];
    user?: { username: string; global_name?: string | null };
  }>(`/guilds/${guild}/members/${discordId}`, token, 120);
  if (!m?.user) return null;
  return {
    nick: m.nick ?? null,
    username: m.user.username,
    globalName: m.user.global_name ?? null,
    joinedAt: m.joined_at ?? null,
    boostingSince: m.premium_since ?? null,
    roles: m.roles ?? [],
  };
}
