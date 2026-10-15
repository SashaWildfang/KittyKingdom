// Admin → Database cleanups: members who left long ago, old log records, and leftovers nothing points to.
// Every cleanup is previewed first, backed up (30 days) and logged. Safety records are never touched.

import { BSON, Long, type Document } from "mongodb";
import type { PanelUser } from "../admin";
import { postChannelMessage } from "../discord-member";
import { idForms, memberSteps, type StepKind } from "../owner-wipe";
import { OWNER_DISCORD_ID } from "../ticket-delete";
import { CATALOG, LEAVER_KINDS, infoFor, type DbName } from "./catalog";
import { DbmError, audit, backupAndDelete, backupDocs, dbFor, deleteWithFiles, startBatch } from "./server";

const { EJSON } = BSON;
const DAY = 86_400_000;
const STAFF_LOG_CHANNEL_ID = "1360344042705256660";
const MAX_MEMBERS_PER_RUN = 500;


// ---------- Last seen ----------

type Seen = { lastSeen: Date | null; from: string | null; leftAt: Date | null; leftKnown: boolean; joinedAt: Date | null; hasAccount: boolean };

function later(a: { at: Date | null; from: string | null }, at: unknown, from: string) {
  const d = at instanceof Date ? at : typeof at === "string" || typeof at === "number" ? new Date(at) : null;
  if (!d || Number.isNaN(d.getTime()) || d.getTime() > Date.now() + DAY) return a;
  return !a.at || d > a.at ? { at: d, from } : a;
}

/** When the member list started noticing leavers: earlier leavers have no real leave date */
async function trackingStart() {
  const site = await dbFor("website");
  const first = await site.collection("member_directory").find({ leftAt: { $type: "date" } }, { projection: { leftAt: 1 } }).sort({ leftAt: 1 }).limit(1).next();
  return first?.leftAt instanceof Date ? new Date(first.leftAt.getTime() + 6 * 3_600_000) : null;
}

/** The last sign of life for each member: messages, voice, applications, logins, and their leave date when it's real */
export async function lastSeenFor(ids: string[], directory?: Map<string, Document>): Promise<Map<string, Seen>> {
  const [site, bot] = await Promise.all([dbFor("website"), dbFor("bot")]);
  const longs = ids.map((id) => Long.fromString(id));
  const tracking = await trackingStart();
  const [dir, activity, index, economy, apps, voice, accounts] = await Promise.all([
    directory ? Promise.resolve(Array.from(directory.values())) : site.collection("member_directory").find({ _id: { $in: ids } } as Document).toArray(),
    bot.collection("member_activity").find({ _id: { $in: ids } } as Document, { projection: { lastMessageAt: 1 } }).toArray(),
    bot
      .collection("message_index")
      .aggregate([{ $match: { a: { $in: longs } } }, { $group: { _id: "$a", t: { $max: "$t" } } }], { maxTimeMS: 30_000 })
      .toArray(),
    bot.collection("users").find({ discordId: idForms(ids) }, { projection: { discordId: 1, last_message: 1, lastMessage: 1 } }).toArray(),
    bot
      .collection("join_applications")
      .aggregate([{ $match: { discordId: { $in: ids } } }, { $group: { _id: "$discordId", t: { $max: "$submittedAt" } } }])
      .toArray(),
    site
      .collection("vc_rewards")
      .aggregate([{ $match: { userId: { $in: ids } } }, { $group: { _id: "$userId", t: { $max: "$ts" } } }])
      .toArray(),
    site.collection("users").find({ discordId: { $in: ids } }, { projection: { discordId: 1, lastLoginAt: 1 } }).toArray(),
  ]);
  const seen = new Map<string, { at: Date | null; from: string | null }>();
  const bump = (id: unknown, at: unknown, from: string) => {
    const key = String(id);
    seen.set(key, later(seen.get(key) ?? { at: null, from: null }, at, from));
  };
  const out = new Map<string, Seen>();
  for (const id of ids) out.set(id, { lastSeen: null, from: null, leftAt: null, leftKnown: false, joinedAt: null, hasAccount: false });
  for (const d of dir) {
    const o = out.get(String(d._id));
    if (!o) continue;
    o.leftAt = d.leftAt instanceof Date ? d.leftAt : null;
    o.leftKnown = !!(o.leftAt && tracking && o.leftAt > tracking);
    o.joinedAt = d.joinedAt instanceof Date ? d.joinedAt : null;
    if (o.leftKnown) bump(d._id, o.leftAt, "left the server");
    bump(d._id, o.joinedAt, "joined the server");
  }
  for (const a of activity) bump(a._id, a.lastMessageAt, "last message");
  for (const m of index) bump(m._id, m.t, "last message");
  for (const u of economy) {
    bump(u.discordId, u.last_message, "last message");
    bump(u.discordId, u.lastMessage, "last message");
  }
  for (const a of apps) bump(a._id, a.t, "join application");
  for (const v of voice) bump(v._id, v.t, "voice chat");
  for (const a of accounts) {
    const o = out.get(String(a.discordId));
    if (o) o.hasAccount = true;
    bump(a.discordId, a.lastLoginAt, "website sign-in");
  }
  for (const [id, s] of Array.from(seen)) {
    const o = out.get(id);
    if (o) {
      o.lastSeen = s.at;
      o.from = s.from;
    }
  }
  return out;
}

// ---------- Members who left ----------

export type LeaverOptions = { days: number; kinds: StepKind[]; includeNoActivity: boolean; includeAccounts: boolean };

export function parseLeaverOptions(body: Document): LeaverOptions {
  const days = Math.round(Number(body.days));
  if (!Number.isFinite(days) || days < 30 || days > 3650) throw new DbmError("Pick between 30 and 3650 days.");
  const allowed = new Set<string>(LEAVER_KINDS.map((k) => k.kind));
  const kinds = (Array.isArray(body.kinds) ? body.kinds : []).map(String).filter((k: string) => allowed.has(k as StepKind)) as StepKind[];
  if (!kinds.length) throw new DbmError("Pick at least one kind of data to remove.");
  return { days, kinds, includeNoActivity: body.includeNoActivity !== false, includeAccounts: body.includeAccounts === true };
}

async function leaverCandidates(opts: LeaverOptions) {
  const site = await dbFor("website");
  const dirDocs = await site
    .collection("member_directory")
    .find({ inServer: false, _id: { $regex: /^\d{15,21}$/ } } as Document, { projection: { username: 1, displayName: 1, avatar: 1, leftAt: 1, joinedAt: 1 } })
    .toArray();
  const directory = new Map(dirDocs.filter((d) => String(d._id) !== OWNER_DISCORD_ID).map((d) => [String(d._id), d]));
  const ids = Array.from(directory.keys());
  const seen = ids.length ? await lastSeenFor(ids, directory) : new Map<string, Seen>();
  const cutoff = new Date(Date.now() - opts.days * DAY);
  const rows = ids.map((id) => {
    const d = directory.get(id)!;
    const s = seen.get(id)!;
    const reason = s.hasAccount && !opts.includeAccounts ? "has a website account" : s.lastSeen ? (s.lastSeen < cutoff ? null : "seen recently") : opts.includeNoActivity ? null : "no activity on record";
    return {
      id,
      name: String(d.displayName ?? d.username ?? id),
      username: d.username ? String(d.username) : null,
      avatar: d.avatar ? String(d.avatar) : null,
      leftAt: s.leftAt,
      leftKnown: s.leftKnown,
      lastSeen: s.lastSeen,
      lastSeenFrom: s.from,
      hasAccount: s.hasAccount,
      qualifies: reason === null,
      skipped: reason,
    };
  });
  return rows;
}

function stepsFor(ids: string[], kinds: StepKind[]) {
  const steps = memberSteps(ids).filter((s) => kinds.includes(s.kind));
  // The economy record itself (the member wipe resets it; for leavers it goes)
  if (kinds.includes("economy")) steps.unshift({ kind: "economy", db: "bot", collection: "users", label: "Leaves, level and XP", filter: { discordId: idForms(ids) } });
  return steps;
}

async function sizeOf(db: DbName, name: string) {
  const c = (await dbFor(db)).collection(name);
  const s = await c.aggregate([{ $collStats: { storageStats: {} } }]).next().catch(() => null);
  return Number(s?.storageStats?.avgObjSize ?? 0);
}

export async function previewLeavers(opts: LeaverOptions) {
  const rows = await leaverCandidates(opts);
  const ids = rows.filter((r) => r.qualifies).map((r) => r.id);
  const steps = ids.length ? stepsFor(ids, opts.kinds) : [];
  const counts = await Promise.all(
    steps.map(async (s) => {
      const c = (await dbFor(s.db)).collection(s.collection);
      const count = await c.countDocuments(s.filter, { maxTimeMS: 20_000 }).catch(() => 0);
      let bytes = count * (await sizeOf(s.db, s.collection));
      // Photos: their data pieces are the big part
      if (s.collection === "dating_media.files" && count) {
        const len = await c.aggregate([{ $match: s.filter }, { $group: { _id: null, n: { $sum: "$length" } } }]).next().catch(() => null);
        bytes += Number(len?.n ?? 0);
      }
      return { db: s.db, coll: s.collection, label: s.label, kind: s.kind, count, bytes: Math.round(bytes) };
    }),
  );
  return {
    members: rows
      .sort((a, b) => Number(b.qualifies) - Number(a.qualifies) || (a.lastSeen?.getTime() ?? 0) - (b.lastSeen?.getTime() ?? 0))
      .slice(0, 3000),
    totalLeft: rows.length,
    qualifying: ids.length,
    rows: counts.filter((c) => c.count > 0),
    records: counts.reduce((n, c) => n + c.count, 0),
    bytes: counts.reduce((n, c) => n + c.bytes, 0),
    tracking: await trackingStart(),
  };
}

export async function runLeavers(opts: LeaverOptions, chosen: unknown, actor: PanelUser) {
  const picked = new Set<string>((Array.isArray(chosen) ? chosen : []).map(String));
  if (!picked.size) throw new DbmError("Pick at least one member.");
  // Checked again on the server: only members who still qualify right now
  const rows = await leaverCandidates(opts);
  const ids = rows.filter((r) => r.qualifies && picked.has(r.id)).map((r) => r.id).slice(0, MAX_MEMBERS_PER_RUN);
  if (!ids.length) throw new DbmError("None of the picked members qualify any more.", 409);
  const batch = await startBatch("leavers", `Cleaned ${ids.length} member${ids.length === 1 ? "" : "s"} who left (${opts.days}+ days)`, actor);
  const removed: { label: string; count: number }[] = [];
  for (const s of stepsFor(ids, opts.kinds)) {
    const n = await deleteWithFiles(batch, s.db, s.collection, s.filter, undefined, 200_000);
    if (n) removed.push({ label: s.label, count: n });
  }
  if (opts.kinds.includes("social")) {
    // Their likes and passes inside other members' records (whole records backed up first)
    const bot = await dbFor("bot");
    const forms = idForms(ids);
    const likes = bot.collection("profile_likes");
    const likeFilter = { $or: [{ "likes.liker_id": forms }, { historical_likers: forms }] } as Document;
    await backupDocs(batch, "bot", "profile_likes", await likes.find(likeFilter).toArray());
    const l = await likes.updateMany(likeFilter, { $pull: { likes: { liker_id: forms }, historical_likers: forms } } as Document);
    const passes = bot.collection("profile_passes");
    const passFilter = { $or: [{ "passed_users.user_id": forms }, { passed_users: forms }] } as Document;
    await backupDocs(batch, "bot", "profile_passes", await passes.find(passFilter).toArray());
    await passes.updateMany(passFilter, { $pull: { passed_users: { user_id: forms } } } as Document).catch(() => undefined);
    await passes.updateMany(passFilter, { $pull: { passed_users: forms } } as Document).catch(() => undefined);
    if (l.modifiedCount) removed.push({ label: "Their likes on other profiles", count: l.modifiedCount });
  }
  const total = removed.reduce((n, r) => n + r.count, 0);
  await audit(actor, "db-clean-leavers", { members: ids.length, days: opts.days, kinds: opts.kinds, removed, batch: String(batch) });
  await postChannelMessage(STAFF_LOG_CHANNEL_ID, {
    embeds: [
      {
        title: "🧹 Old member data cleaned",
        color: 0xd56300,
        description: `**${ids.length}** member${ids.length === 1 ? "" : "s"} who left and weren't seen for **${opts.days}+ days**.\n\n${removed.map((r) => `• ${r.label}: **${r.count.toLocaleString()}**`).join("\n").slice(0, 3000) || "Nothing was stored for them."}`,
        fields: [
          { name: "Cleaned by", value: `<@${actor.discordId}>`, inline: true },
          { name: "Undo", value: "Admin → Database → Backups (30 days)", inline: true },
        ],
        timestamp: new Date().toISOString(),
      },
    ],
  }).catch(() => false);
  return { members: ids.length, removed, total, batch: String(batch), more: rows.filter((r) => r.qualifies).length - ids.length };
}

// ---------- Old records ----------

export function retentionTargets() {
  return Object.entries(CATALOG)
    .filter(([, info]) => info.retention)
    .map(([key, info]) => {
      const [db, ...rest] = key.split(".");
      return { db: db as DbName, coll: rest.join("."), label: info.label, group: info.group, field: info.retention!.field, days: info.retention!.days, filter: info.retention!.filter ?? {} };
    });
}

function retentionFilter(t: ReturnType<typeof retentionTargets>[number], days: number) {
  return { ...t.filter, [t.field]: { $lt: new Date(Date.now() - days * DAY) } } as Document;
}

export async function previewRetention(overrides: Record<string, number>) {
  return Promise.all(
    retentionTargets().map(async (t) => {
      const key = `${t.db}.${t.coll}`;
      const days = Math.max(7, Math.round(Number(overrides[key] ?? t.days)));
      const c = (await dbFor(t.db)).collection(t.coll);
      const [total, old, oldest, avg] = await Promise.all([
        c.estimatedDocumentCount().catch(() => 0),
        c.countDocuments(retentionFilter(t, days), { maxTimeMS: 20_000 }).catch(() => 0),
        c
          .find({ [t.field]: { $type: "date" } }, { projection: { [t.field]: 1 }, sort: { [t.field]: 1 }, limit: 1 })
          .next()
          .catch(() => null),
        sizeOf(t.db, t.coll),
      ]);
      return { key, db: t.db, coll: t.coll, label: t.label, group: t.group, field: t.field, days, defaultDays: t.days, total, old, oldest: oldest?.[t.field] ?? null, bytes: Math.round(old * avg) };
    }),
  );
}

export async function runRetention(targets: unknown, actor: PanelUser) {
  const list = (Array.isArray(targets) ? targets : []) as { key?: unknown; days?: unknown }[];
  const known = new Map(retentionTargets().map((t) => [`${t.db}.${t.coll}`, t]));
  const picked = list.map((x) => ({ t: known.get(String(x.key)), days: Math.round(Number(x.days)) })).filter((x) => x.t);
  if (!picked.length) throw new DbmError("Pick at least one kind of record.");
  if (picked.some((x) => !Number.isFinite(x.days) || x.days < 7)) throw new DbmError("Keep at least 7 days of every record.");
  const batch = await startBatch("retention", `Removed old records from ${picked.map((x) => x.t!.label).join(", ")}`.slice(0, 300), actor);
  const removed: { label: string; count: number; days: number }[] = [];
  for (const { t, days } of picked) {
    const n = await backupAndDelete(batch, t!.db, t!.coll, retentionFilter(t!, days), 100_000);
    removed.push({ label: t!.label, count: n, days });
  }
  await audit(actor, "db-clean-old", { removed, batch: String(batch) });
  return { removed, total: removed.reduce((n, r) => n + r.count, 0), batch: String(batch) };
}

// ---------- Leftovers ----------

type Orphan = { key: string; label: string; about: string; db: DbName; coll: string; filter: Document };

async function orphanSets(): Promise<Orphan[]> {
  const [site, bot] = await Promise.all([dbFor("website"), dbFor("bot")]);
  const [profileDocs, draftDocs, fileIds, chunkFileIds, convIds] = await Promise.all([
    bot.collection("dating_profiles").find({}).toArray(),
    bot.collection("profile_drafts").find({}).toArray(),
    site.collection("dating_media.files").distinct("_id"),
    site.collection("dating_media.chunks").distinct("files_id"),
    site.collection("dating_conversations").distinct("_id"),
  ]);
  const owners = Array.from(new Set(profileDocs.map((d) => String(d._id))));
  // Photos are used as profile photos, banners and fursona art: anything a profile or draft mentions is kept
  const used = new Set<string>();
  for (const d of [...profileDocs, ...draftDocs]) for (const m of EJSON.stringify(d).match(/[0-9a-f]{24}/g) ?? []) used.add(m);
  const unused = fileIds.filter((id) => !used.has(String(id)));
  const files = new Set(fileIds.map(String));
  const lostChunks = chunkFileIds.filter((id) => !files.has(String(id)));
  const profileForms = idForms(owners.length ? owners : ["0"]);
  return [
    {
      key: "photos",
      label: "Social photos nothing uses",
      about: "Photos no profile or draft shows any more (replaced, removed, or the profile was deleted). Only photos older than a day.",
      db: "website",
      coll: "dating_media.files",
      filter: { _id: { $in: unused }, uploadDate: { $lt: new Date(Date.now() - DAY) } },
    },
    { key: "chunks", label: "Photo data with no photo", about: "Pieces of photos that were already deleted", db: "website", coll: "dating_media.chunks", filter: { files_id: { $in: lostChunks } } },
    { key: "vectors", label: "Matching data with no profile", about: "Rebuilt automatically if they make a profile again", db: "bot", coll: "dating_vectors", filter: { _id: { $nin: (profileForms as { $in: unknown[] }).$in } } },
    { key: "likes", label: "Likes on deleted profiles", about: "Likes received by profiles that no longer exist", db: "bot", coll: "profile_likes", filter: { _id: { $nin: (profileForms as { $in: unknown[] }).$in } } },
    { key: "messages", label: "Social messages with no chat", about: "Messages left behind by deleted chats", db: "website", coll: "dating_messages", filter: { conv: { $nin: convIds } } },
  ];
}

export async function previewOrphans() {
  const sets = await orphanSets();
  return Promise.all(
    sets.map(async (o) => {
      const c = (await dbFor(o.db)).collection(o.coll);
      const count = await c.countDocuments(o.filter, { maxTimeMS: 20_000 }).catch(() => 0);
      let bytes = count * (await sizeOf(o.db, o.coll));
      if (o.coll === "dating_media.files" && count) {
        const len = await c.aggregate([{ $match: o.filter }, { $group: { _id: null, n: { $sum: "$length" } } }]).next().catch(() => null);
        bytes += Number(len?.n ?? 0);
      }
      return { key: o.key, label: o.label, about: o.about, db: o.db, coll: o.coll, count, bytes: Math.round(bytes), filter: EJSON.stringify(o.filter, { relaxed: false }) };
    }),
  );
}

export async function runOrphans(keys: unknown, actor: PanelUser) {
  const wanted = new Set((Array.isArray(keys) ? keys : []).map(String));
  const sets = (await orphanSets()).filter((o) => wanted.has(o.key));
  if (!sets.length) throw new DbmError("Pick at least one kind of leftover.");
  const batch = await startBatch("orphans", `Removed leftovers: ${sets.map((o) => o.label).join(", ")}`.slice(0, 300), actor);
  const removed: { label: string; count: number }[] = [];
  for (const o of sets) {
    const n = await deleteWithFiles(batch, o.db, o.coll, o.filter, undefined, 100_000);
    removed.push({ label: o.label, count: n });
  }
  await audit(actor, "db-clean-orphans", { removed, batch: String(batch) });
  return { removed, total: removed.reduce((n, r) => n + r.count, 0), batch: String(batch) };
}

// ---------- One member ----------

/** Everything stored about one member, per collection, with filters for the Browse view */
export async function memberReport(discordId: string) {
  if (!/^\d{15,21}$/.test(discordId)) throw new DbmError("That isn't a Discord id.");
  const forms = idForms(discordId);
  const site = await dbFor("website");
  const [dir, account, seen] = await Promise.all([
    site.collection("member_directory").findOne({ _id: discordId } as Document),
    site.collection("users").findOne({ discordId }, { projection: { _id: 1, username: 1, createdAt: 1, lastLoginAt: 1, emailVerified: 1 } }),
    lastSeenFor([discordId]),
  ]);
  const steps: { db: DbName; collection: string; label: string; filter: Document; kind: string; safety?: boolean }[] = [
    { db: "bot", collection: "users", label: "Leaves, level and XP", filter: { discordId: forms }, kind: "economy" },
    ...memberSteps([discordId]),
    { db: "bot", collection: "message_index", label: "Message index", filter: { a: Long.fromString(discordId) }, kind: "activity" },
    ...(account
      ? [
          { db: "website" as DbName, collection: "users", label: "Website account", filter: { discordId }, kind: "account" },
          { db: "website" as DbName, collection: "sessions", label: "Signed-in devices", filter: { userId: account._id }, kind: "account" },
        ]
      : []),
    // Kept for safety (never cleaned)
    { db: "bot", collection: "punishments", label: "Punishments", filter: { discordId: forms }, kind: "safety", safety: true },
    { db: "bot", collection: "automod_events", label: "AutoMod catches", filter: { userId: discordId }, kind: "safety", safety: true },
    { db: "bot", collection: "resolvedTickets", label: "Closed tickets", filter: { opened_by: { $in: [discordId] } }, kind: "safety", safety: true },
    { db: "bot", collection: "activeTickets", label: "Open tickets", filter: { opened_by: { $in: [discordId] } }, kind: "safety", safety: true },
    { db: "bot", collection: "join_applications", label: "Join applications", filter: { discordId }, kind: "safety", safety: true },
    { db: "bot", collection: "vc_signatures", label: "Voice rules signature", filter: { discordId: forms }, kind: "safety", safety: true },
    { db: "bot", collection: "cleanup_archive_messages", label: "Archived messages", filter: { userId: discordId }, kind: "safety", safety: true },
    { db: "website", collection: "bot_logs", label: "Bot log entries", filter: { userIds: discordId }, kind: "safety", safety: true },
  ];
  const rows = await Promise.all(
    steps.map(async (s) => ({
      db: s.db,
      coll: s.collection,
      label: s.label,
      kind: s.kind,
      safety: !!s.safety,
      collLabel: infoFor(s.db, s.collection).label,
      count: await (await dbFor(s.db)).collection(s.collection).countDocuments(s.filter, { maxTimeMS: 15_000 }).catch(() => 0),
      filter: EJSON.stringify(s.filter, { relaxed: false }),
    })),
  );
  const s = seen.get(discordId)!;
  return {
    id: discordId,
    name: dir ? String(dir.displayName ?? dir.username ?? discordId) : null,
    username: dir?.username ?? null,
    avatar: dir?.avatar ?? null,
    inServer: dir ? dir.inServer !== false : null,
    joinedAt: dir?.joinedAt ?? null,
    leftAt: s.leftAt,
    leftKnown: s.leftKnown,
    lastSeen: s.lastSeen,
    lastSeenFrom: s.from,
    account: account ? { username: account.username ?? null, createdAt: account.createdAt ?? null, lastLoginAt: account.lastLoginAt ?? null } : null,
    rows,
  };
}
