// Patreon supporters for the homepage thank-you section ("The Royal Court"). Who's active comes from the main
// bot's Patreon sync (zeo_bot.patreon_members) plus tiers granted by hand (patreon_overrides); titles come from
// supporter_prefs (King or Queen and so on). Names and avatars come from the member directory.

import { getBotCollection } from "./mongodb";
import { loadDirectory } from "./member-directory";
import { TIERS, type TierKey } from "./perks";

export type Patron = { discordId: string; name: string; avatar: string; title: string };
export type PatronGroup = { tier: TierKey; name: string; patrons: Patron[] };

let cache: { at: number; groups: PatronGroup[] } | null = null;

export async function patronWall(): Promise<PatronGroup[]> {
  if (cache && Date.now() - cache.at < 10 * 60_000) return cache.groups;
  const [members, overrides] = await Promise.all([
    getBotCollection("patreon_members").then((c) => c.find({ tier: { $ne: null }, discordId: { $ne: null } }, { projection: { discordId: 1, tier: 1 } }).toArray()),
    getBotCollection("patreon_overrides").then((c) => c.find({}, { projection: { discordId: 1, tier: 1 } }).toArray()),
  ]);
  // Highest tier per person
  const rank = (k: string) => TIERS.findIndex((t) => t.key === k);
  const tierOf = new Map<string, TierKey>();
  for (const d of [...members, ...overrides]) {
    const id = String(d.discordId ?? "");
    const key = String(d.tier ?? "") as TierKey;
    if (!id || rank(key) < 0) continue;
    const prev = tierOf.get(id);
    if (!prev || rank(key) > rank(prev)) tierOf.set(id, key);
  }
  const ids = Array.from(tierOf.keys());
  const [dir, prefs] = await Promise.all([
    ids.length ? loadDirectory(ids) : Promise.resolve({ entries: new Map(), complete: false }),
    ids.length ? getBotCollection("supporter_prefs").then((c) => c.find({ _id: { $in: ids } } as never).toArray()) : Promise.resolve([]),
  ]);
  const variant = new Map(prefs.map((p) => [String(p._id), p.variant === 1 ? 1 : 0]));
  const groups: PatronGroup[] = [...TIERS].reverse().map((t) => ({ tier: t.key, name: t.name, patrons: [] }));
  for (const [id, key] of Array.from(tierOf.entries())) {
    const entry = dir.entries.get(id);
    if (entry && entry.inServer === false) continue;
    const tier = TIERS.find((t) => t.key === key)!;
    groups.find((g) => g.tier === key)!.patrons.push({
      discordId: id,
      name: entry?.nick || entry?.displayName || entry?.username || "A supporter",
      avatar: entry?.avatar ?? `/api/discord/avatar/${id}`,
      title: tier.titles[variant.get(id) ?? 0],
    });
  }
  for (const g of groups) g.patrons.sort((a, b) => a.name.localeCompare(b.name));
  cache = { at: Date.now(), groups };
  return groups;
}
