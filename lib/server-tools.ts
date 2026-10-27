// Server tools for admins: "who can do what where" (worked out like Discord does, with the reason for each
// answer), and channels nobody talks in any more (from the Moderation Bot's message index).

import { botToken, discordGet, getGuildChannelsRaw, getMemberRoleIds, guildId, type RawChannel } from "./discord-member";
import { Long } from "mongodb";
import { getBotCollection } from "./mongodb";

export const PERMISSIONS: { key: string; label: string; bit: bigint; voice?: boolean }[] = [
  { key: "view", label: "See the channel", bit: BigInt(1) << BigInt(10) },
  { key: "send", label: "Send messages", bit: BigInt(1) << BigInt(11) },
  { key: "threads", label: "Send in threads", bit: BigInt(1) << BigInt(38) },
  { key: "attach", label: "Attach files", bit: BigInt(1) << BigInt(15) },
  { key: "embed", label: "Embed links", bit: BigInt(1) << BigInt(14) },
  { key: "react", label: "Add reactions", bit: BigInt(1) << BigInt(6) },
  { key: "history", label: "Read message history", bit: BigInt(1) << BigInt(16) },
  { key: "everyone", label: "Mention @everyone and roles", bit: BigInt(1) << BigInt(17) },
  { key: "manage", label: "Manage messages", bit: BigInt(1) << BigInt(13) },
  { key: "commands", label: "Use app commands", bit: BigInt(1) << BigInt(31) },
  { key: "connect", label: "Connect (voice)", bit: BigInt(1) << BigInt(20), voice: true },
  { key: "speak", label: "Speak (voice)", bit: BigInt(1) << BigInt(21), voice: true },
];
const VIEW = BigInt(1) << BigInt(10);
const ADMIN = BigInt(1) << BigInt(3);
const CONNECT = BigInt(1) << BigInt(20);
const SPEAK = BigInt(1) << BigInt(21);
const SEND = BigInt(1) << BigInt(11);
const ATTACH = BigInt(1) << BigInt(15);
const EMBED = BigInt(1) << BigInt(14);
const MENTION = BigInt(1) << BigInt(17);
const TYPE_NAME: Record<number, string> = { 0: "text", 2: "voice", 4: "category", 5: "announcement", 13: "stage", 15: "forum", 16: "media" };

type RawRole = { id: string; name: string; position: number; permissions?: string; managed?: boolean };

export type PermRow = { channelId: string; name: string; type: string; category: string | null; allowed: boolean; why: string };

/** For a member (their roles) or a single role (plus @everyone): can they do `perm` in each channel, and why. */
export async function permissionCheck(input: { memberId?: string | null; roleId?: string | null; perm: string }) {
  const perm = PERMISSIONS.find((p) => p.key === input.perm);
  if (!perm) throw new Error("Unknown permission.");
  const guild = await guildId();
  const token = botToken();
  if (!guild || !token) throw new Error("The website can't reach Discord right now.");
  const [channels, roles, info] = await Promise.all([getGuildChannelsRaw(), discordGet<RawRole[]>(`/guilds/${guild}/roles`, token, 60), discordGet<{ owner_id?: string }>(`/guilds/${guild}`, token, 300)]);
  if (!roles) throw new Error("Couldn't load the server's roles.");
  const roleName = new Map(roles.map((r) => [r.id, r.id === guild ? "@everyone" : `@${r.name}`]));

  let who: Set<string>;
  let label: string;
  if (input.memberId) {
    const mr = await getMemberRoleIds(input.memberId);
    if (!mr) throw new Error("That member isn't in the server.");
    who = new Set([guild, ...mr]);
    label = "member";
  } else if (input.roleId && roles.some((r) => r.id === input.roleId)) {
    who = new Set([guild, input.roleId]);
    label = "role";
  } else {
    who = new Set([guild]);
    label = "everyone";
  }

  // Server-wide permissions from their roles
  let base = BigInt(0);
  let baseFrom: string | null = null;
  for (const r of roles) {
    if (!who.has(r.id)) continue;
    const p = BigInt(r.permissions ?? 0);
    if (p & perm.bit && !baseFrom) baseFrom = roleName.get(r.id) ?? null;
    base |= p;
  }
  const owner = Boolean(input.memberId && info?.owner_id === input.memberId);
  const admin = owner || (base & ADMIN) === ADMIN;
  const adminFrom = owner ? "server owner" : roles.filter((r) => who.has(r.id) && BigInt(r.permissions ?? 0) & ADMIN).map((r) => roleName.get(r.id))[0] ?? "";

  const byId = new Map(channels.map((c) => [c.id, c]));
  const rows: PermRow[] = [];
  const sorted = [...channels].filter((c) => c.type !== 4).sort((a, b) => (byId.get(a.parent_id ?? "")?.position ?? -1) - (byId.get(b.parent_id ?? "")?.position ?? -1) || a.position - b.position);
  for (const c of sorted) {
    if (perm.voice && ![2, 13].includes(c.type)) continue;
    const category = c.parent_id ? byId.get(c.parent_id)?.name ?? null : null;
    if (admin) {
      rows.push({ channelId: c.id, name: c.name, type: TYPE_NAME[c.type] ?? "channel", category, allowed: true, why: `Administrator (${adminFrom})` });
      continue;
    }
    const { allowed, why } = channelPerm(c, guild, who, input.memberId ?? null, base, baseFrom, perm.bit, roleName);
    rows.push({ channelId: c.id, name: c.name, type: TYPE_NAME[c.type] ?? "channel", category, allowed, why });
  }
  return { rows, label, admin, perm: perm.label };
}

function channelPerm(c: RawChannel, guild: string, who: Set<string>, memberId: string | null, base: bigint, baseFrom: string | null, bit: bigint, roleName: Map<string, string>) {
  const ow = c.permission_overwrites ?? [];
  let p = base;
  let why = p & bit ? `Allowed server-wide${baseFrom ? ` by ${baseFrom}` : ""}` : "Not allowed server-wide";
  const everyone = ow.find((o) => o.id === guild);
  if (everyone) {
    if (BigInt(everyone.deny) & bit) why = "Denied for @everyone in this channel";
    if (BigInt(everyone.allow) & bit) why = "Allowed for @everyone in this channel";
    p = (p & ~BigInt(everyone.deny)) | BigInt(everyone.allow);
  }
  let allow = BigInt(0);
  let deny = BigInt(0);
  const allowBy: string[] = [];
  const denyBy: string[] = [];
  for (const o of ow) {
    if (o.type !== 0 || o.id === guild || !who.has(o.id)) continue;
    if (BigInt(o.allow) & bit) allowBy.push(roleName.get(o.id) ?? "a role");
    if (BigInt(o.deny) & bit) denyBy.push(roleName.get(o.id) ?? "a role");
    allow |= BigInt(o.allow);
    deny |= BigInt(o.deny);
  }
  // Role allows win over role denies (Discord applies denies first, then allows)
  if (denyBy.length && !allowBy.length) why = `Denied for ${denyBy.join(", ")} in this channel`;
  if (allowBy.length) why = `Allowed for ${allowBy.join(", ")} in this channel`;
  p = (p & ~deny) | allow;
  const member = memberId ? ow.find((o) => o.type === 1 && o.id === memberId) : null;
  if (member) {
    if (BigInt(member.deny) & bit) why = "Denied for them personally in this channel";
    if (BigInt(member.allow) & bit) why = "Allowed for them personally in this channel";
    p = (p & ~BigInt(member.deny)) | BigInt(member.allow);
  }
  // Can't do anything in a channel you can't see (or connect to, for voice speaking)
  if (bit !== VIEW && !(p & VIEW)) return { allowed: false, why: "Can't see the channel" };
  // Attaching, embedding and @mentions only matter if you can send at all
  if ((bit === ATTACH || bit === EMBED || bit === MENTION) && !(p & SEND)) return { allowed: false, why: "Can't send messages there" };
  if (bit === SPEAK && !(p & CONNECT)) return { allowed: false, why: "Can't connect to the channel" };
  return { allowed: (p & bit) === bit, why };
}

// ── Dead channels ────────────────────────────────────────────────────────────

export type ChannelActivity = { channelId: string; name: string; type: string; category: string | null; last: string | null; last30: number; note: string | null };

let cache: { at: number; rows: ChannelActivity[] } | null = null;

/** Every text-ish channel with its last message and 30-day message count (cached 10 minutes). */
export async function channelActivity(fresh = false): Promise<ChannelActivity[]> {
  if (!fresh && cache && Date.now() - cache.at < 10 * 60_000) return cache.rows;
  const channels = await getGuildChannelsRaw();
  const byId = new Map(channels.map((c) => [c.id, c]));
  const idx = await getBotCollection("message_index");
  const since = new Date(Date.now() - 30 * 86_400_000);
  const rows: ChannelActivity[] = [];
  const list = channels.filter((c) => [0, 2, 5, 15, 16].includes(c.type));
  for (let i = 0; i < list.length; i += 8) {
    const batch = await Promise.all(
      list.slice(i, i + 8).map(async (c) => {
        const forum = c.type === 15 || c.type === 16;
        const [last, n] = forum
          ? [null, 0]
          : await Promise.all([
              // The Moderation Bot stores channel ids as numbers (older rows may be strings)
              idx.find({ c: { $in: [Long.fromString(c.id), c.id] } } as never, { projection: { t: 1 } }).sort({ t: -1 }).limit(1).next(),
              idx.countDocuments({ c: { $in: [Long.fromString(c.id), c.id] }, t: { $gte: since } } as never),
            ]);
        return {
          channelId: c.id,
          name: c.name,
          type: TYPE_NAME[c.type] ?? "channel",
          category: c.parent_id ? byId.get(c.parent_id)?.name ?? null : null,
          last: last?.t instanceof Date ? last.t.toISOString() : null,
          last30: n,
          note: forum ? "Posts live in threads, so they aren't counted here." : null,
        };
      }),
    );
    rows.push(...batch);
  }
  cache = { at: Date.now(), rows };
  return rows;
}
