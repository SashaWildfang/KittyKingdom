// Each Patreon tier has two Discord roles with the same perks (e.g. "King (Patreon)" and "Queen (Patreon)").
// The first is the tier's original role (lib/perks.ts); the second is created by the main bot, which saves
// both in zeo_bot.bot_config "tier_roles". withTierAliases() adds the original role id for anyone holding
// the second one, so tierFromRoles() and friends work for both titles.

import { getBotCollection } from "./mongodb";

let cache: { at: number; aliases: Map<string, string>; roles: Record<string, [string, string]> } | null = null;

export async function tierRoleConfig() {
  if (cache && Date.now() - cache.at < 60_000) return cache;
  const doc = await (await getBotCollection("bot_config")).findOne({ _id: "tier_roles" } as never).catch(() => null);
  const roles = ((doc?.roles ?? {}) as Record<string, [string, string]>) ?? {};
  const aliases = new Map<string, string>();
  for (const pair of Object.values(roles)) if (pair?.[0] && pair?.[1]) aliases.set(String(pair[1]), String(pair[0]));
  cache = { at: Date.now(), aliases, roles };
  return cache;
}

export async function withTierAliases(roleIds: string[] | null): Promise<string[] | null> {
  if (!roleIds) return roleIds;
  const { aliases } = await tierRoleConfig();
  const extra = roleIds.map((r) => aliases.get(r)).filter((r): r is string => Boolean(r));
  return extra.length ? Array.from(new Set([...roleIds, ...extra])) : roleIds;
}
