// Admin → Patreon: everyone the main bot's Patreon sync knows about, manual grants, titles and custom roles,
// plus admin actions. Actions are requests the main bot carries out (Main_Bot events/patreon_sync.py and
// custom_roles.py): a grant/revoke changes patreon_overrides and asks for a sync, removing a custom role
// flags it for the bot to delete.

import { people } from "./admin-people";
import { getBotCollection } from "./mongodb";
import { TIERS, type TierKey } from "./perks";

export class PatreonAdminError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

export type PatronRow = {
  key: string;
  discordId: string | null;
  name: string;
  avatar: string | null;
  inServer: boolean;
  tier: TierKey | null;
  title: string | null;
  source: "patreon" | "manual";
  pledge: number;
  status: string | null;
  lastChargeStatus: string | null;
  lastChargeDate: string | null;
  nextChargeDate: string | null;
  since: string | null;
  grantedBy: string | null;
  customRole: { name: string; style: string; color: string; color2: string | null; icon: string | null; status: string; error: string | null } | null;
};

export type PatreonOverview = {
  sync: { at: string | null; ok: boolean | null; error: string | null; members: number; active: number; linked: number; requested: boolean; configured: boolean };
  counts: Record<TierKey, number>;
  active: number;
  unlinked: number;
  manual: number;
  monthlyUsd: number;
  rows: PatronRow[];
};

const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : v ? String(v) : null);
const tierKey = (v: unknown): TierKey | null => (TIERS.some((t) => t.key === v) ? (v as TierKey) : null);

export async function patreonOverview(): Promise<PatreonOverview> {
  const [members, overrides, prefs, roles, cfg] = await Promise.all([
    getBotCollection("patreon_members").then((c) => c.find({}).toArray()),
    getBotCollection("patreon_overrides").then((c) => c.find({}).toArray()),
    getBotCollection("supporter_prefs").then((c) => c.find({}).toArray()),
    getBotCollection("custom_roles").then((c) => c.find({}).toArray()),
    getBotCollection("bot_config").then((c) => c.findOne({ _id: "patreon_sync" } as never)),
  ]);
  const variant = new Map(prefs.map((p) => [String(p._id), p.variant === 1 ? 1 : 0]));
  const roleOf = new Map(roles.map((r) => [String(r._id), r]));
  const ids = Array.from(new Set([...members.map((m) => m.discordId), ...overrides.map((o) => o.discordId)].filter(Boolean).map(String)));
  const who = await people(ids).catch(() => ({}) as Awaited<ReturnType<typeof people>>);

  const toRole = (id: string | null) => {
    const r = id ? roleOf.get(id) : null;
    if (!r) return null;
    const pending = r.version !== r.appliedVersion;
    return {
      name: String(r.name ?? ""), style: String(r.style ?? "solid"), color: String(r.color ?? "#E8622C"),
      color2: r.color2 ? String(r.color2) : null, icon: r.icon ? String(r.icon) : null,
      status: pending ? "pending" : String(r.status ?? "pending"), error: !pending && r.error ? String(r.error) : null,
    };
  };
  const titleFor = (tier: TierKey | null, id: string | null) => {
    const t = TIERS.find((x) => x.key === tier);
    return t ? t.titles[id ? variant.get(id) ?? 0 : 0] : null;
  };

  const rows: PatronRow[] = [];
  const manualIds = new Set(overrides.map((o) => String(o.discordId)));
  for (const m of members) {
    const id = m.discordId ? String(m.discordId) : null;
    const tier = tierKey(m.tier);
    rows.push({
      key: `p:${m._id}`,
      discordId: id,
      name: id ? who[id]?.name ?? "Unknown member" : "Not linked to Discord",
      avatar: id ? who[id]?.avatar ?? null : null,
      inServer: id ? who[id]?.inServer !== false : false,
      tier,
      title: titleFor(tier, id),
      source: "patreon",
      pledge: Number(m.cents ?? 0) / 100,
      status: m.status ? String(m.status) : null,
      lastChargeStatus: m.lastChargeStatus ? String(m.lastChargeStatus) : null,
      lastChargeDate: iso(m.lastChargeDate),
      nextChargeDate: iso(m.nextChargeDate),
      since: iso(m.since),
      grantedBy: null,
      customRole: toRole(id),
    });
  }
  for (const o of overrides) {
    const id = String(o.discordId);
    const tier = tierKey(o.tier);
    rows.push({
      key: `m:${id}`,
      discordId: id,
      name: who[id]?.name ?? "Unknown member",
      avatar: who[id]?.avatar ?? null,
      inServer: who[id]?.inServer !== false,
      tier,
      title: titleFor(tier, id),
      source: "manual",
      pledge: 0,
      status: "manual",
      lastChargeStatus: null,
      lastChargeDate: null,
      nextChargeDate: null,
      since: iso(o.at),
      grantedBy: o.by ? who[String(o.by)]?.name ?? String(o.by) : null,
      customRole: toRole(id),
    });
  }
  const order = (r: PatronRow) => (r.tier ? -TIERS.findIndex((t) => t.key === r.tier) : 1);
  rows.sort((a, b) => order(a) - order(b) || a.name.localeCompare(b.name));

  const activeRows = rows.filter((r) => r.tier && (r.source === "manual" || r.status === "active_patron"));
  const counts = { knight: 0, noble: 0, monarch: 0 } as Record<TierKey, number>;
  for (const r of activeRows) if (r.tier && r.discordId) counts[r.tier]++;
  const requestedAt = cfg?.requestedAt instanceof Date ? cfg.requestedAt : null;
  const handledAt = cfg?.requestHandledAt instanceof Date ? cfg.requestHandledAt : null;
  const at = cfg?.at instanceof Date ? cfg.at : null;
  return {
    sync: {
      at: at?.toISOString() ?? null,
      ok: typeof cfg?.ok === "boolean" ? cfg.ok : null,
      error: cfg?.error ? String(cfg.error) : null,
      members: Number(cfg?.members ?? 0),
      active: Number(cfg?.active ?? 0),
      linked: Number(cfg?.linked ?? 0),
      requested: Boolean(requestedAt && (!handledAt || requestedAt > handledAt)),
      configured: Boolean(at),
    },
    counts,
    active: activeRows.filter((r) => r.discordId).length,
    unlinked: rows.filter((r) => r.source === "patreon" && r.status === "active_patron" && !r.discordId).length,
    manual: manualIds.size,
    monthlyUsd: Math.round(rows.filter((r) => r.source === "patreon" && r.status === "active_patron").reduce((n, r) => n + r.pledge, 0) * 100) / 100,
    rows,
  };
}

/** Ask the main bot to run the Patreon sync now (it checks every few seconds). */
export async function requestSync() {
  await (await getBotCollection("bot_config")).updateOne({ _id: "patreon_sync" } as never, { $set: { requestedAt: new Date() } }, { upsert: true });
}

export async function grantTier(discordId: string, tier: string, by: string) {
  if (!/^\d{15,25}$/.test(discordId)) throw new PatreonAdminError("Enter a valid Discord ID.");
  const key = tierKey(tier);
  if (!key) throw new PatreonAdminError("Pick a tier.");
  await (await getBotCollection("patreon_overrides")).updateOne(
    { discordId },
    { $set: { discordId, tier: key, by, at: new Date(), via: "website" } },
    { upsert: true },
  );
  await requestSync();
}

export async function revokeTier(discordId: string) {
  const res = await (await getBotCollection("patreon_overrides")).deleteOne({ discordId });
  if (!res.deletedCount) throw new PatreonAdminError("They don't have a manual grant.", 404);
  await requestSync();
}

/** Flags a member's custom role for the bot to delete (e.g. an inappropriate name). */
export async function removeCustomRole(discordId: string) {
  const res = await (await getBotCollection("custom_roles")).updateOne(
    { _id: discordId } as never,
    { $set: { remove: true, status: "pending", updatedAt: new Date(), updatedVia: "admin" }, $inc: { version: 1 } },
  );
  if (!res.matchedCount) throw new PatreonAdminError("They don't have a custom role.", 404);
}
