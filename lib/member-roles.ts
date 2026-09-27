// A member's Discord roles for My Account: the self-assignable ones from the bot's role selectors
// (which they can add and remove), shop color roles, and everything else shown read-only.

import { Long } from "mongodb";
import { addMemberRole, getGuildRoles, getMemberRoleIds, removeMemberRole, type GuildRole } from "./discord-member";
import { getBotCollection } from "./mongodb";
import { ADULT_ROLE_IDS, ROLE_CATEGORIES, SELF_ROLE_IDS } from "./role-catalog";
import { getOwnedColorRoles, getShopColorRoles } from "./store";

export const STATUS_ROLES = [
  { key: "adult", id: "1358469974552870913", label: "18+ Verified", icon: "🔞" },
  { key: "member", id: "1358469854725931038", label: "Member", icon: "✅" },
  { key: "media", id: "1502679664894677063", label: "Media Perms", icon: "📷" },
  { key: "vc", id: "1503200525527810269", label: "VC Perms", icon: "🎙️" },
  { key: "patreon", id: "1360260086500561237", label: "Patreon", icon: "💎" },
] as const;

const STATUS_IDS = new Set<string>(STATUS_ROLES.map((r) => r.id));
const ADULT_VERIFIED_ID = "1358469974552870913";
// Level roles are named like "Maple Leaf [41-50]"
const LEVEL_ROLE = /\[\s*\d+\s*(?:[-–]\s*\d+|\+)?\s*\]/;

export class RoleError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

export type RoleState = {
  inServer: boolean;
  isAdult: boolean;
  level: number | null;
  status: { key: string; label: string; icon: string; has: boolean }[];
  categories: {
    key: string;
    title: string;
    description: string;
    color: string;
    adult: boolean;
    locked: boolean;
    roles: { id: string; name: string; emoji: string; description: string; has: boolean; exists: boolean }[];
  }[];
  colorRoles: { itemId: string; name: string; roleId: string; colors: string[]; equipped: boolean }[];
  /** Every color role the shop sells, for the "unlocked" progress. */
  colorRoleTotal: number;
  /** All color roles: owned ones first, then the rest (greyed out), with whether they're in the shop now */
  colorCatalog: { itemId: string; name: string; colors: string[]; owned: boolean; equipped: boolean; inShop: boolean; price: number; rotation: string }[];
  levelRoles: { id: string; name: string; colors: string[] }[];
  otherRoles: { id: string; name: string; colors: string[] }[];
};

async function memberLevel(discordId: string) {
  const users = await getBotCollection("users");
  const doc = await users.findOne({ discordId: { $in: [Long.fromString(discordId), discordId] } } as never, { projection: { level: 1 } });
  const level = doc?.level;
  return typeof level === "number" ? level : level ? Number(level) : null;
}

export async function getRoleState(discordId: string): Promise<RoleState> {
  const [memberRoles, guildRoles, owned, level, shopRoles] = await Promise.all([
    getMemberRoleIds(discordId),
    getGuildRoles(),
    getOwnedColorRoles(discordId).catch(() => []),
    memberLevel(discordId).catch(() => null),
    getShopColorRoles().catch(() => []),
  ]);
  const colorRoleTotal = shopRoles.length;
  const has = new Set(memberRoles ?? []);
  const isAdult = has.has(ADULT_VERIFIED_ID);
  const colorRoleIds = new Set(owned.map((o) => o.roleId));
  const colorsOf = (id: string) => guildRoles.get(id)?.colors ?? [];

  const levelRoles: GuildRole[] = [];
  const otherRoles: GuildRole[] = [];
  for (const id of Array.from(has)) {
    const role = guildRoles.get(id);
    if (!role || SELF_ROLE_IDS.has(id) || STATUS_IDS.has(id) || colorRoleIds.has(id)) continue;
    (LEVEL_ROLE.test(role.name) ? levelRoles : otherRoles).push(role);
  }

  return {
    inServer: memberRoles !== null,
    isAdult,
    level,
    status: STATUS_ROLES.map((r) => ({ key: r.key, label: r.label, icon: r.icon, has: has.has(r.id) })),
    categories: ROLE_CATEGORIES.map((c) => ({
      key: c.key,
      title: c.title,
      description: c.description,
      color: c.color,
      adult: c.adult,
      locked: c.adult && !isAdult,
      roles: c.roles.map((r) => ({ ...r, has: has.has(r.id), exists: guildRoles.size === 0 || guildRoles.has(r.id) })),
    })),
    colorRoles: owned.map((o) => ({ ...o, colors: colorsOf(o.roleId), equipped: has.has(o.roleId) })),
    colorRoleTotal: Math.max(colorRoleTotal, owned.length),
    colorCatalog: shopRoles
      .map((r) => ({
        itemId: r.itemId,
        name: r.name,
        colors: colorsOf(r.roleId),
        owned: owned.some((o) => o.itemId === r.itemId),
        equipped: has.has(r.roleId),
        inShop: r.inShop,
        price: r.price,
        rotation: r.rotation,
      }))
      .sort((a, b) => Number(b.owned) - Number(a.owned) || Number(b.inShop) - Number(a.inShop) || a.name.localeCompare(b.name)),
    levelRoles: levelRoles.map((r) => ({ id: r.id, name: r.name, colors: r.colors })),
    otherRoles: otherRoles.map((r) => ({ id: r.id, name: r.name, colors: r.colors })),
  };
}

/** Adds or removes one of the selector roles. Anything outside the selectors is refused. */
export async function setSelfRole(discordId: string, roleId: string, add: boolean) {
  if (!SELF_ROLE_IDS.has(roleId)) throw new RoleError("That role can't be changed from the website.", 403);
  const memberRoles = await getMemberRoleIds(discordId);
  if (!memberRoles) throw new RoleError("Join the Kitty Kingdom Discord server to pick roles.", 403);
  if (ADULT_ROLE_IDS.has(roleId) && !memberRoles.includes(ADULT_VERIFIED_ID)) {
    throw new RoleError("18+ roles are available once you're ID verified in the Discord server.", 403);
  }
  if (add === memberRoles.includes(roleId)) return; // already how they want it
  const ok = add ? await addMemberRole(discordId, roleId) : await removeMemberRole(discordId, roleId);
  if (!ok) throw new RoleError("Discord didn't accept that change. Please try again in a moment.", 502);
}
