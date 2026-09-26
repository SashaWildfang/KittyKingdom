// Looks up a member's Discord roles with the bot token so the account page can show
// their highest rank (with its color, including two/three-color gradient roles).

const STAFF_TEAM_ROLE_ID = "1358470109965979859";
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

function botToken() {
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
    const response = await fetch(`https://discord.com/api/v10${path}`, {
      headers: token ? { Authorization: `Bot ${token}` } : { Accept: "application/json" },
      next: { revalidate },
    });
    return response.ok ? ((await response.json()) as T) : null;
  } catch {
    return null;
  }
}

async function guildId(): Promise<string | null> {
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
