// Admin → Members → Discord Members (/api/admin/members/all): every member of the server with their roles, joined with the bot's
// stats (level, messages, leaves) and whether they have a website account and a Social profile.
//
// The whole list is pulled from Discord in bulk (1,000 members per call) and kept in memory for a minute,
// so the page gets everything in one request and all filtering, counting and sorting happens instantly in
// the browser. Roles are sent once and members refer to them by index to keep the payload small.

import { Long, type Document } from "mongodb";
import type { PanelUser } from "./admin";
import { assignableRoles } from "./admin-roles";
import { addMemberRole, discordRequest, getGuildRoles, guildId, postChannelMessage, removeMemberRole } from "./discord-member";
import { getBotCollection, getMongoClient, getUsersCollection } from "./mongodb";
import { ROLE_CATEGORIES } from "./role-catalog";

const CACHE_MS = 60_000;
const STAFF_LOG_CHANNEL_ID = "1360344042705256660";

type RawMember = {
  nick?: string | null;
  avatar?: string | null;
  roles: string[];
  joined_at?: string | null;
  premium_since?: string | null;
  pending?: boolean;
  communication_disabled_until?: string | null;
  user: { id: string; username: string; global_name?: string | null; avatar?: string | null; bot?: boolean };
};

export type MMRole = { id: string; name: string; color: string | null; position: number; managed: boolean; emoji: string | null; category: string | null; adult: boolean };
export type MMMember = {
  id: string;
  name: string;
  username: string;
  avatar: string | null;
  bot: boolean;
  /** Indexes into `roles` */
  r: number[];
  joinedAt: number | null;
  createdAt: number;
  boosting: number | null;
  pending: boolean;
  timedOut: boolean;
  level: number | null;
  messages: number | null;
  balance: number | null;
  xp: number | null;
  account: "verified" | "unverified" | null;
  social: boolean;
};
export type MMSnapshot = {
  at: number;
  guildId: string | null;
  roles: MMRole[];
  members: MMMember[];
  categories: { key: string; title: string; adult: boolean; roleIds: string[] }[];
};

let cache: { at: number; data: MMSnapshot } | null = null;
let inflight: Promise<MMSnapshot> | null = null;

const num = (v: unknown) => (typeof v === "number" ? v : v instanceof Long ? v.toNumber() : typeof v === "bigint" ? Number(v) : v == null ? null : Number(v) || 0);
/** Discord ids carry their creation time */
const createdAt = (id: string) => Number((BigInt(id) >> BigInt(22)) + BigInt(1420070400000));

async function build(): Promise<MMSnapshot> {
  const guild = await guildId();
  const raw: RawMember[] = [];
  if (guild) {
    let after = "0";
    for (let page = 0; page < 50; page++) {
      const res = await discordRequest<RawMember[]>("GET", `/guilds/${guild}/members?limit=1000&after=${after}`);
      if (!res.ok || !res.data) {
        if (!raw.length) throw new Error("Discord didn't send the member list. Check the bot token and its Server Members intent.");
        break;
      }
      raw.push(...res.data);
      if (res.data.length < 1000) break;
      after = res.data[res.data.length - 1].user.id;
    }
  }

  const guildRoles = await getGuildRoles();
  const categoryOf = new Map<string, { key: string; adult: boolean }>();
  for (const c of ROLE_CATEGORIES) for (const r of c.roles) categoryOf.set(r.id, { key: c.key, adult: c.adult });
  const roles: MMRole[] = Array.from(guildRoles.values())
    .filter((r) => r.id !== guild)
    .sort((a, b) => b.position - a.position)
    .map((r) => ({ id: r.id, name: r.name, color: r.colors[0] ?? null, position: r.position, managed: r.managed, emoji: r.emoji ?? null, category: categoryOf.get(r.id)?.key ?? null, adult: categoryOf.get(r.id)?.adult ?? false }));
  const index = new Map(roles.map((r, i) => [r.id, i]));

  // Bot stats, website accounts and Social profiles for everyone in one query each
  const ids = raw.map((m) => m.user.id);
  const longs = ids.map((id) => Long.fromString(id));
  const [botUsers, accounts, profiles] = await Promise.all([
    getBotCollection("users").then((c) => c.find({ discordId: { $in: [...longs, ...ids] } } as Document, { projection: { discordId: 1, level: 1, msgCount: 1, balance: 1, totalXp: 1 } }).toArray()),
    getUsersCollection().then((c) => c.find({ discordId: { $in: ids } }, { projection: { discordId: 1, emailVerified: 1 } }).toArray()),
    getBotCollection("dating_profiles").then((c) => c.find({ _id: { $in: [...longs, ...ids] } } as Document, { projection: { _id: 1 } }).toArray()),
  ]);
  const stats = new Map(botUsers.map((u) => [String(u.discordId), u]));
  const account = new Map(accounts.map((a) => [String(a.discordId), a.emailVerified === true ? ("verified" as const) : ("unverified" as const)]));
  const social = new Set(profiles.map((p) => String(p._id)));

  const now = Date.now();
  const members: MMMember[] = raw.map((m) => {
    const s = stats.get(m.user.id);
    return {
      id: m.user.id,
      name: m.nick ?? m.user.global_name ?? m.user.username,
      username: m.user.username,
      avatar: m.user.avatar ? `https://cdn.discordapp.com/avatars/${m.user.id}/${m.user.avatar}.png?size=64` : null,
      bot: Boolean(m.user.bot),
      r: m.roles.map((id) => index.get(id)).filter((i): i is number => i !== undefined),
      joinedAt: m.joined_at ? Date.parse(m.joined_at) : null,
      createdAt: createdAt(m.user.id),
      boosting: m.premium_since ? Date.parse(m.premium_since) : null,
      pending: Boolean(m.pending),
      timedOut: Boolean(m.communication_disabled_until && Date.parse(m.communication_disabled_until) > now),
      level: s ? num(s.level) : null,
      messages: s ? num(s.msgCount) : null,
      balance: s ? num(s.balance) : null,
      xp: s ? num(s.totalXp) : null,
      account: account.get(m.user.id) ?? null,
      social: social.has(m.user.id),
    };
  });

  return {
    at: now,
    guildId: guild,
    roles,
    members,
    categories: ROLE_CATEGORIES.map((c) => ({ key: c.key, title: c.title, adult: c.adult, roleIds: c.roles.map((r) => r.id).filter((id) => index.has(id)) })),
  };
}

/** The member snapshot (at most a minute old unless `fresh`). */
export async function membersSnapshot(fresh = false) {
  if (!fresh && cache && Date.now() - cache.at < CACHE_MS) return cache.data;
  inflight ??= build().finally(() => {
    inflight = null;
  });
  const data = await inflight;
  cache = { at: Date.now(), data };
  return data;
}

export class BulkRoleError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

export const BULK_BATCH = 25;
export const BULK_MAX = 1000;

/**
 * Adds or removes one role for a batch of members (the page sends batches of 25 so a big change shows
 * progress). Same rules as the member drawer: only roles below the admin's and the bot's highest role.
 */
export async function bulkRoleBatch(actor: PanelUser, roleId: string, add: boolean, rawIds: unknown) {
  const ids = (Array.isArray(rawIds) ? rawIds : []).map(String).filter((id) => /^\d{15,21}$/.test(id));
  if (!ids.length) throw new BulkRoleError("No members picked.");
  if (ids.length > BULK_BATCH) throw new BulkRoleError(`At most ${BULK_BATCH} members per request.`);
  const role = (await assignableRoles(actor.discordId)).find((r) => r.id === roleId);
  if (!role) throw new BulkRoleError("You can't manage that role (it's above your highest role or the bot's, or it's managed by an integration).", 403);

  const done: string[] = [];
  const failed: string[] = [];
  for (const id of ids) {
    const ok = add ? await addMemberRole(id, roleId) : await removeMemberRole(id, roleId);
    (ok ? done : failed).push(id);
  }
  // Keep the cached list in step so the page's next refresh shows the change
  if (cache) {
    const i = cache.data.roles.findIndex((r) => r.id === roleId);
    for (const m of cache.data.members) {
      if (!done.includes(m.id) || i < 0) continue;
      m.r = add ? Array.from(new Set([...m.r, i])) : m.r.filter((x) => x !== i);
    }
  }
  const client = await getMongoClient();
  await client
    .db(process.env.MONGODB_DB ?? "website")
    .collection("admin_audit")
    .insertOne({ at: new Date(), action: add ? "bulk-role-add" : "bulk-role-remove", roleId, roleName: role.name, members: done, failed, adminDiscordId: actor.discordId, adminName: actor.name });
  return { done: done.length, failed };
}

/** One message in the bot logs when a bulk change finishes (not one per batch). */
export async function bulkRoleSummary(actor: PanelUser, roleId: string, add: boolean, done: number, failed: number) {
  const role = (await getGuildRoles()).get(roleId);
  await postChannelMessage(STAFF_LOG_CHANNEL_ID, {
    embeds: [
      {
        title: add ? "➕ Role added to many members (website)" : "➖ Role removed from many members (website)",
        color: add ? 0x46a758 : 0xe5484d,
        fields: [
          { name: "Role", value: role ? `<@&${roleId}>` : `\`${roleId}\``, inline: true },
          { name: "Members", value: `${done.toLocaleString()} changed${failed ? ` · ${failed} failed` : ""}`, inline: true },
          { name: "By", value: `<@${actor.discordId}>`, inline: true },
        ],
        footer: { text: "Admin → Members → Discord Members" },
        timestamp: new Date().toISOString(),
      },
    ],
  }).catch(() => undefined);
}
