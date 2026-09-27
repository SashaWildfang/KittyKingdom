// Admins adding or removing a member's Discord roles from the member drawer.
// Follows Discord's own rules: only roles below both the admin's highest role and the bot's
// highest role, never bot-managed roles or @everyone. Every change is logged.

import type { PanelUser } from "./admin";
import { addMemberRole, getGuildRoles, getMemberRoleIds, guildId, postChannelMessage, removeMemberRole, type GuildRole } from "./discord-member";
import { getBotUserId } from "./moderation";
import { getMongoClient } from "./mongodb";

const STAFF_LOG_CHANNEL_ID = "1360344042705256660";

export class RoleChangeError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

function topPosition(roleIds: string[] | null, roles: Map<string, GuildRole>) {
  return Math.max(0, ...(roleIds ?? []).map((id) => roles.get(id)?.position ?? 0));
}

/** Roles this admin is allowed to hand out or take away, highest first. */
export async function assignableRoles(actorDiscordId: string) {
  const [roles, guild, botId, actorRoles] = await Promise.all([getGuildRoles(), guildId(), getBotUserId(), getMemberRoleIds(actorDiscordId)]);
  const botRoles = botId ? await getMemberRoleIds(botId) : null;
  const ceiling = Math.min(topPosition(actorRoles, roles), botRoles ? topPosition(botRoles, roles) : Number.POSITIVE_INFINITY);
  return Array.from(roles.values())
    .filter((r) => r.id !== guild && !r.managed && r.position < ceiling)
    .sort((a, b) => b.position - a.position);
}

export async function changeMemberRole(actor: PanelUser, targetId: string, roleId: string, add: boolean) {
  const allowed = await assignableRoles(actor.discordId);
  const role = allowed.find((r) => r.id === roleId);
  if (!role) throw new RoleChangeError("You can't manage that role (it's above your highest role or the bot's).", 403);

  const current = await getMemberRoleIds(targetId);
  if (!current) throw new RoleChangeError("That member isn't in the server.", 404);
  if (add === current.includes(roleId)) return { message: add ? "They already have that role." : "They don't have that role." };

  const ok = add ? await addMemberRole(targetId, roleId) : await removeMemberRole(targetId, roleId);
  if (!ok) throw new RoleChangeError("Discord didn't accept that change. Check the bot's role position.", 502);

  const client = await getMongoClient();
  await client
    .db(process.env.MONGODB_DB ?? "website")
    .collection("admin_audit")
    .insertOne({ at: new Date(), action: add ? "role-add" : "role-remove", targetDiscordId: targetId, roleId, roleName: role.name, adminDiscordId: actor.discordId, adminName: actor.name });

  await postChannelMessage(STAFF_LOG_CHANNEL_ID, {
    embeds: [
      {
        title: add ? "➕ Role added from the website" : "➖ Role removed from the website",
        color: add ? 0x46a758 : 0xe5484d,
        fields: [
          { name: "Member", value: `<@${targetId}>\n\`${targetId}\``, inline: true },
          { name: "Role", value: `<@&${roleId}>`, inline: true },
          { name: "By", value: `<@${actor.discordId}>`, inline: true },
        ],
        timestamp: new Date().toISOString(),
      },
    ],
  }).catch(() => false);

  return { message: `${add ? "Added" : "Removed"} ${role.name}.` };
}
