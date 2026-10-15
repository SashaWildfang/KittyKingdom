// Admin → Database (server side): stats, browsing, editing and backups for the website and bot databases.
// Anything this changes or deletes is copied to dbm_backups first (kept 30 days) and can be restored.
// Secret fields (passwords, tokens, 2FA) are never sent to the browser and can't be changed here.

import { BSON, Long, ObjectId, type Collection, type Db, type Document } from "mongodb";
import type { PanelUser } from "../admin";
import { getMongoClient } from "../mongodb";
import { CATALOG, HIDDEN, SENSITIVE_KEY, infoFor, type DbName } from "./catalog";

const { EJSON } = BSON;
const BACKUP_DAYS = 30;
const DAY = 86_400_000;
/** Backups are split so one record stays well under MongoDB's 16 MB limit */
const BACKUP_PART_BYTES = 8 * 1024 * 1024;
/** Read-only and never changed from here */
const LOCKED = new Set(["website.admin_audit", "website.dbm_backups", "website.dbm_batches", "website.db_snapshots"]);
/** Editable, but never deleted from here (accounts go through the member wipe, which checks staff) */
const NO_DELETE = new Set(["website.users", "website.panel_access", "bot.bot_settings", "bot.automod_config", "bot.globals"]);

export class DbmError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

export async function dbFor(db: DbName): Promise<Db> {
  const client = await getMongoClient();
  return client.db(db === "website" ? (process.env.MONGODB_DB ?? "website") : (process.env.BOT_MONGODB_DB ?? "zeo_bot"));
}

export function parseDb(value: unknown): DbName {
  if (value === "website" || value === "bot") return value;
  throw new DbmError("Pick the website or bot database.");
}

/** Only collections that really exist (and no system ones) */
export async function collection(db: DbName, name: unknown): Promise<Collection<Document>> {
  const coll = String(name ?? "");
  if (!/^[\w.-]{1,120}$/.test(coll) || coll.startsWith("system.")) throw new DbmError("That isn't a collection.");
  const database = await dbFor(db);
  const found = await database.listCollections({ name: coll }, { nameOnly: true }).toArray();
  if (!found.length) throw new DbmError("That collection doesn't exist.", 404);
  return database.collection(coll);
}

export function isLocked(db: DbName, name: string) {
  return LOCKED.has(`${db}.${name}`);
}

// ---------- Secrets ----------

/** A copy with every secret field replaced by a placeholder */
export function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  // 64-bit numbers (Discord ids) stay exact text: relaxed JSON would round them to the nearest double
  if (value instanceof Long) return { $numberLong: value.toString() };
  if (value && typeof value === "object" && !isBsonValue(value)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = SENSITIVE_KEY.test(k) ? HIDDEN : redact(v);
    return out;
  }
  return value;
}

function isBsonValue(value: object) {
  return value instanceof Date || "_bsontype" in value || value instanceof Uint8Array;
}

/** Puts every secret field of the stored record back (whatever the editor sent for them) */
function restoreSecrets(edited: Document, original: Document): Document {
  const walk = (next: unknown, old: unknown): unknown => {
    if (!next || typeof next !== "object" || Array.isArray(next) || isBsonValue(next as object)) return next;
    const out: Record<string, unknown> = {};
    const prev = old && typeof old === "object" && !Array.isArray(old) ? (old as Record<string, unknown>) : {};
    for (const [k, v] of Object.entries(next as Record<string, unknown>)) {
      if (SENSITIVE_KEY.test(k)) continue;
      out[k] = walk(v, prev[k]);
    }
    for (const [k, v] of Object.entries(prev)) if (SENSITIVE_KEY.test(k)) out[k] = v;
    return out;
  };
  return walk(edited, original) as Document;
}

/** EJSON text for the browser (types like dates and 64-bit ids survive the round trip) */
export function toWire(doc: Document) {
  return EJSON.serialize(redact(doc) as Document, { relaxed: true });
}

// ---------- Filters ----------

const BANNED_OPS = new Set(["$where", "$function", "$accumulator", "$expr"]);

/** A JSON filter typed by an admin: checked for unsafe operators and secret fields */
export function parseFilter(text: unknown): Document {
  const raw = String(text ?? "").trim();
  if (!raw) return {};
  let parsed: unknown;
  try {
    parsed = EJSON.parse(raw, { relaxed: false });
  } catch {
    throw new DbmError("The filter isn't valid JSON.");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new DbmError("The filter must be a JSON object, like {\"field\": \"value\"}.");
  const check = (v: unknown) => {
    if (Array.isArray(v)) return v.forEach(check);
    if (!v || typeof v !== "object" || isBsonValue(v as object)) return;
    for (const [k, inner] of Object.entries(v)) {
      if (BANNED_OPS.has(k)) throw new DbmError(`${k} isn't allowed in filters.`);
      if (SENSITIVE_KEY.test(k)) throw new DbmError("Secret fields can't be searched.");
      check(inner);
    }
  };
  check(parsed);
  return parsed as Document;
}

/** A record id from the browser: EJSON ({"$oid": …}, {"$numberLong": …}) or plain text/number */
export function parseId(text: unknown): unknown {
  const raw = String(text ?? "");
  try {
    return EJSON.parse(raw, { relaxed: false });
  } catch {
    return raw;
  }
}

function safeField(field: unknown) {
  const f = String(field ?? "");
  if (!f) return "";
  if (!/^[\w.]{1,100}$/.test(f) || SENSITIVE_KEY.test(f)) throw new DbmError("You can't sort by that field.");
  return f;
}

// ---------- Overview ----------

type CollStats = { name: string; count: number; size: number; storage: number; indexes: number; indexSize: number; avg: number; ttl: { field: string; days: number }[] };

async function statsFor(database: Db): Promise<CollStats[]> {
  const names = (await database.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name).filter((n) => !n.startsWith("system."));
  return Promise.all(
    names.map(async (name) => {
      const coll = database.collection(name);
      const [stats, indexes] = await Promise.all([
        coll
          .aggregate([{ $collStats: { storageStats: { scale: 1 } } }])
          .next()
          .catch(() => null),
        coll.indexes().catch(() => []),
      ]);
      const s = (stats?.storageStats ?? {}) as Record<string, number>;
      const ttl = indexes
        .filter((i) => typeof i.expireAfterSeconds === "number")
        .map((i) => ({ field: Object.keys(i.key)[0], days: Math.round(((i.expireAfterSeconds as number) / 86400) * 10) / 10 }));
      return {
        name,
        count: Number(s.count ?? 0),
        size: Number(s.size ?? 0),
        storage: Number(s.storageSize ?? 0),
        indexes: Number(s.nindexes ?? indexes.length),
        indexSize: Number(s.totalIndexSize ?? 0),
        avg: Number(s.avgObjSize ?? 0),
        ttl,
      };
    }),
  );
}

/** Sizes of everything, plus a daily snapshot for growth over time */
export async function overview() {
  const [site, bot] = await Promise.all([dbFor("website"), dbFor("bot")]);
  const [siteColls, botColls, siteDb, botDb] = await Promise.all([
    statsFor(site),
    statsFor(bot),
    site.command({ dbStats: 1 }).catch(() => ({})),
    bot.command({ dbStats: 1 }).catch(() => ({})),
  ]);
  const describe = (db: DbName, list: CollStats[]) =>
    list
      .map((c) => {
        const info = infoFor(db, c.name);
        return { ...c, db, label: info.label, group: info.group, about: info.about ?? null, protected: !!info.protected, locked: isLocked(db, c.name), retention: info.retention ?? null, known: !!CATALOG[`${db}.${c.name}`] };
      })
      .sort((a, b) => b.storage + b.indexSize - (a.storage + a.indexSize));
  const collections = [...describe("website", siteColls), ...describe("bot", botColls)];
  const total = (d: Document, list: CollStats[]) => ({
    collections: list.length,
    documents: list.reduce((n, c) => n + c.count, 0),
    data: Number(d.dataSize ?? list.reduce((n, c) => n + c.size, 0)),
    storage: Number(d.storageSize ?? list.reduce((n, c) => n + c.storage, 0)),
    indexes: Number(d.indexSize ?? list.reduce((n, c) => n + c.indexSize, 0)),
  });
  const totals = { website: total(siteDb, siteColls), bot: total(botDb, botColls) };

  // One snapshot a day (the first visit of the day takes it)
  const snaps = site.collection<{ _id: string } & Document>("db_snapshots");
  const today = new Date().toISOString().slice(0, 10);
  await snaps
    .updateOne(
      { _id: today },
      {
        $setOnInsert: {
          at: new Date(),
          totals,
          collections: Object.fromEntries(collections.map((c) => [`${c.db}.${c.name}`.replace(/\./g, "|"), { count: c.count, bytes: c.storage + c.indexSize }])),
        },
      },
      { upsert: true },
    )
    .catch(() => undefined);
  const history = await snaps
    .find({}, { projection: { totals: 1, at: 1 } })
    .sort({ _id: -1 })
    .limit(120)
    .toArray()
    .catch(() => []);
  // Growth per collection since about 30 days ago
  const base = await snaps
    .find({ _id: { $lte: new Date(Date.now() - 30 * DAY).toISOString().slice(0, 10) } })
    .sort({ _id: -1 })
    .limit(1)
    .next()
    .catch(() => null);
  const fallback = base ?? (await snaps.find({}).sort({ _id: 1 }).limit(1).next().catch(() => null));
  const since = fallback && fallback._id !== today ? String(fallback._id) : null;
  const prior = (since ? (fallback?.collections ?? {}) : {}) as Record<string, { count: number; bytes: number }>;
  return {
    totals,
    collections: collections.map((c) => {
      const p = prior[`${c.db}.${c.name}`.replace(/\./g, "|")];
      return { ...c, growth: p ? { count: c.count - p.count, bytes: c.storage + c.indexSize - p.bytes } : null };
    }),
    growthSince: since,
    history: history.reverse().map((h) => ({ day: String(h._id), totals: h.totals })),
  };
}

// ---------- Browse ----------

export async function browse(db: DbName, name: string, opts: { filter?: string; sort?: string; dir?: string; skip?: number; limit?: number }) {
  const coll = await collection(db, name);
  const filter = parseFilter(opts.filter);
  const sortField = safeField(opts.sort);
  const dir = opts.dir === "asc" ? 1 : -1;
  const limit = Math.min(Math.max(Number(opts.limit) || 25, 1), 100);
  const skip = Math.min(Math.max(Number(opts.skip) || 0, 0), 1_000_000);
  // Photo pieces are raw bytes: show which file and where, not the data
  const projection = name.endsWith(".chunks") ? { data: 0 } : undefined;
  const sort: Document = sortField ? { [sortField]: dir, _id: dir } : { _id: dir };
  const [docs, total] = await Promise.all([
    coll.find(filter, { projection, sort, skip, limit, maxTimeMS: 10_000 }).toArray(),
    coll.countDocuments(filter, { maxTimeMS: 10_000 }).catch(() => -1),
  ]);
  // Field list (from a sample) for the sort and filter helpers
  const fields = new Map<string, Set<string>>();
  for (const d of docs.slice(0, 50)) {
    for (const [k, v] of Object.entries(d)) {
      if (SENSITIVE_KEY.test(k)) continue;
      if (!fields.has(k)) fields.set(k, new Set());
      fields.get(k)!.add(typeName(v));
    }
  }
  return {
    docs: docs.map(toWire),
    total,
    skip,
    limit,
    fields: Array.from(fields).map(([field, types]) => ({ field, types: Array.from(types) })),
    locked: isLocked(db, name),
    noDelete: NO_DELETE.has(`${db}.${name}`),
    protected: !!infoFor(db, name).protected,
  };
}

function typeName(v: unknown) {
  if (v === null || v === undefined) return "empty";
  if (v instanceof Date) return "date";
  if (Array.isArray(v)) return "list";
  if (typeof v === "object" && "_bsontype" in (v as object)) {
    const t = String((v as { _bsontype: string })._bsontype);
    return t === "ObjectId" ? "id" : t === "Long" ? "number (64-bit)" : t.toLowerCase();
  }
  if (typeof v === "object") return "object";
  return typeof v;
}

// ---------- Backups ----------

export type BatchKind = "edit" | "delete" | "bulk-delete" | "leavers" | "retention" | "orphans" | "restore";

type Batch = { _id: ObjectId; kind: BatchKind; label: string; at: Date; expireAt: Date; by: { discordId: string; name: string }; counts: Record<string, number>; restoredAt?: Date | null };

async function backupColls() {
  const site = await dbFor("website");
  const batches = site.collection<Batch>("dbm_batches");
  const parts = site.collection("dbm_backups");
  await Promise.all([
    batches.createIndex({ expireAt: 1 }, { expireAfterSeconds: 0 }).catch(() => undefined),
    parts.createIndex({ expireAt: 1 }, { expireAfterSeconds: 0 }).catch(() => undefined),
    parts.createIndex({ batch: 1 }).catch(() => undefined),
  ]);
  return { batches, parts };
}

/** Starts a backup batch: every change in one action shares it, so it can be restored together */
export async function startBatch(kind: BatchKind, label: string, actor: PanelUser) {
  const { batches } = await backupColls();
  const _id = new ObjectId();
  await batches.insertOne({ _id, kind, label, at: new Date(), expireAt: new Date(Date.now() + BACKUP_DAYS * DAY), by: { discordId: actor.discordId, name: actor.name }, counts: {}, restoredAt: null });
  return _id;
}

/** Copies these records into the batch (split into parts under the size limit) */
export async function backupDocs(batch: ObjectId, db: DbName, name: string, docs: Document[]) {
  if (!docs.length) return;
  const { batches, parts } = await backupColls();
  const expireAt = new Date(Date.now() + BACKUP_DAYS * DAY);
  let part: Document[] = [];
  let bytes = 0;
  const flush = async () => {
    if (!part.length) return;
    await parts.insertOne({ batch, db, coll: name, docs: part, count: part.length, bytes, expireAt });
    part = [];
    bytes = 0;
  };
  for (const d of docs) {
    const size = BSON.calculateObjectSize(d);
    if (size > BACKUP_PART_BYTES) throw new DbmError("One record is too big to back up, so nothing was changed.");
    if (bytes + size > BACKUP_PART_BYTES) await flush();
    part.push(d);
    bytes += size;
  }
  await flush();
  await batches.updateOne({ _id: batch }, { $inc: { [`counts.${db}|${name.replace(/\./g, "~")}`]: docs.length } });
}

/** Backs up whatever matches, then deletes exactly those records */
export async function backupAndDelete(batch: ObjectId, db: DbName, name: string, filter: Document, cap = 50_000) {
  const coll = (await dbFor(db)).collection(name);
  let removed = 0;
  // In slices, so big cleanups don't hold everything in memory at once
  while (removed < cap) {
    const docs = await coll.find(filter, { limit: Math.min(2000, cap - removed), maxTimeMS: 20_000 }).toArray();
    if (!docs.length) break;
    await backupDocs(batch, db, name, docs);
    const r = await coll.deleteMany({ _id: { $in: docs.map((d) => d._id) } });
    removed += r.deletedCount;
    if (docs.length < 2000) break;
  }
  return removed;
}

export async function listBackups() {
  const { batches, parts } = await backupColls();
  const list = await batches.find({}).sort({ at: -1 }).limit(100).toArray();
  const sizes = await parts
    .aggregate<{ _id: ObjectId; bytes: number; docs: number }>([{ $match: { batch: { $in: list.map((b) => b._id) } } }, { $group: { _id: "$batch", bytes: { $sum: "$bytes" }, docs: { $sum: "$count" } } }])
    .toArray();
  const byId = new Map(sizes.map((s) => [String(s._id), s]));
  return list.map((b) => ({
    id: String(b._id),
    kind: b.kind,
    label: b.label,
    at: b.at,
    expireAt: b.expireAt,
    by: b.by,
    restoredAt: b.restoredAt ?? null,
    counts: Object.entries(b.counts ?? {}).map(([k, n]) => {
      const [db, coll] = k.split("|");
      return { db, coll: coll.replace(/~/g, "."), count: n };
    }),
    docs: byId.get(String(b._id))?.docs ?? 0,
    bytes: byId.get(String(b._id))?.bytes ?? 0,
  }));
}

/** Puts every record in a batch back exactly as it was (replacing newer versions of the same records) */
export async function restoreBatch(id: string, actor: PanelUser) {
  if (!ObjectId.isValid(id)) throw new DbmError("That backup doesn't exist.", 404);
  const { batches, parts } = await backupColls();
  const batch = await batches.findOne({ _id: new ObjectId(id) });
  if (!batch) throw new DbmError("That backup doesn't exist (backups are kept 30 days).", 404);
  if (batch.restoredAt) throw new DbmError("That backup was already restored.", 409);
  let restored = 0;
  const cursor = parts.find({ batch: batch._id });
  for await (const part of cursor) {
    const coll = (await dbFor(part.db as DbName)).collection(String(part.coll));
    const docs = (part.docs ?? []) as Document[];
    if (!docs.length) continue;
    const r = await coll.bulkWrite(
      docs.map((d) => ({ replaceOne: { filter: { _id: d._id }, replacement: d, upsert: true } })),
      { ordered: false },
    );
    restored += r.upsertedCount + r.matchedCount;
  }
  await batches.updateOne({ _id: batch._id }, { $set: { restoredAt: new Date(), restoredBy: { discordId: actor.discordId, name: actor.name } } });
  await audit(actor, "db-restore", { batch: id, label: batch.label, restored });
  return { restored };
}

export async function deleteBackup(id: string, actor: PanelUser) {
  if (!ObjectId.isValid(id)) throw new DbmError("That backup doesn't exist.", 404);
  const { batches, parts } = await backupColls();
  const _id = new ObjectId(id);
  const batch = await batches.findOne({ _id });
  if (!batch) throw new DbmError("That backup doesn't exist.", 404);
  await parts.deleteMany({ batch: _id });
  await batches.deleteOne({ _id });
  await audit(actor, "db-backup-delete", { batch: id, label: batch.label });
}

export async function audit(actor: PanelUser, action: string, details: Document) {
  const site = await dbFor("website");
  await site
    .collection("admin_audit")
    .insertOne({ at: new Date(), action, ...details, adminDiscordId: actor.discordId, adminName: actor.name })
    .catch(() => undefined);
}

// ---------- One record ----------

export async function getDoc(db: DbName, name: string, idText: unknown) {
  const coll = await collection(db, name);
  const doc = await coll.findOne({ _id: parseId(idText) } as Document, { projection: name.endsWith(".chunks") ? { data: 0 } : undefined });
  if (!doc) throw new DbmError("That record doesn't exist any more.", 404);
  return toWire(doc);
}

/** Replaces one record with the edited version (secret fields always keep their stored values) */
export async function saveDoc(db: DbName, name: string, idText: unknown, body: unknown, actor: PanelUser) {
  if (isLocked(db, name)) throw new DbmError("This collection is read-only.", 403);
  if (name.endsWith(".chunks")) throw new DbmError("Photo data can't be edited.", 403);
  const coll = await collection(db, name);
  const id = parseId(idText);
  const original = await coll.findOne({ _id: id } as Document);
  if (!original) throw new DbmError("That record doesn't exist any more.", 404);
  let edited: Document;
  try {
    edited = EJSON.parse(typeof body === "string" ? body : JSON.stringify(body), { relaxed: false }) as Document;
  } catch {
    throw new DbmError("That isn't valid JSON.");
  }
  if (!edited || typeof edited !== "object" || Array.isArray(edited)) throw new DbmError("A record must be a JSON object.");
  if (EJSON.stringify(edited._id, { relaxed: false }) !== EJSON.stringify(original._id, { relaxed: false })) throw new DbmError("The _id can't be changed.");
  const next = restoreSecrets(edited, original);
  if (BSON.calculateObjectSize(next) > 15 * 1024 * 1024) throw new DbmError("That record is too big.");
  const batch = await startBatch("edit", `Edited a record in ${infoFor(db, name).label}`, actor);
  await backupDocs(batch, db, name, [original]);
  await coll.replaceOne({ _id: original._id }, next);
  await audit(actor, "db-edit", { db, coll: name, docId: EJSON.stringify(original._id, { relaxed: false }), batch: String(batch) });
  return { doc: toWire(next), batch: String(batch) };
}

/** Deletes chosen records (backed up first). Photos take their data with them. */
export async function deleteDocs(db: DbName, name: string, idTexts: unknown[], actor: PanelUser) {
  if (isLocked(db, name)) throw new DbmError("This collection is read-only.", 403);
  if (NO_DELETE.has(`${db}.${name}`)) throw new DbmError("Records here can't be deleted from the Database page.", 403);
  if (!idTexts.length || idTexts.length > 500) throw new DbmError("Pick between 1 and 500 records.");
  const coll = await collection(db, name);
  const ids = idTexts.map(parseId);
  const label = infoFor(db, name).label;
  const batch = await startBatch("delete", `Deleted ${ids.length} record${ids.length === 1 ? "" : "s"} from ${label}`, actor);
  const removed = await deleteWithFiles(batch, db, name, { _id: { $in: ids } }, coll);
  await audit(actor, "db-delete", { db, coll: name, count: removed, batch: String(batch) });
  return { removed, batch: String(batch) };
}

/** Deletes records, also removing a stored file's pieces and a chat's messages */
export async function deleteWithFiles(batch: ObjectId, db: DbName, name: string, filter: Document, coll?: Collection<Document>, cap = 50_000) {
  const c = coll ?? (await dbFor(db)).collection(name);
  if (name.endsWith(".files")) {
    const bucket = name.slice(0, -".files".length);
    const fileIds = (await c.find(filter, { projection: { _id: 1 }, limit: cap }).toArray()).map((f) => f._id);
    if (fileIds.length) await backupAndDelete(batch, db, `${bucket}.chunks`, { files_id: { $in: fileIds } }, 1_000_000);
    return backupAndDelete(batch, db, name, { _id: { $in: fileIds } }, cap);
  }
  if (db === "website" && name === "dating_conversations") {
    const convIds = (await c.find(filter, { projection: { _id: 1 }, limit: cap }).toArray()).map((x) => x._id);
    if (convIds.length) await backupAndDelete(batch, db, "dating_messages", { conv: { $in: convIds } }, 1_000_000);
    return backupAndDelete(batch, db, name, { _id: { $in: convIds } }, cap);
  }
  return backupAndDelete(batch, db, name, filter, cap);
}

/** Bulk delete by filter: preview (count + size) or run */
export async function deleteMatching(db: DbName, name: string, filterText: unknown, run: false, actor: PanelUser): Promise<{ count: number; bytes: number }>;
export async function deleteMatching(db: DbName, name: string, filterText: unknown, run: true, actor: PanelUser): Promise<{ removed: number; batch: string }>;
export async function deleteMatching(db: DbName, name: string, filterText: unknown, run: boolean, actor: PanelUser) {
  if (isLocked(db, name)) throw new DbmError("This collection is read-only.", 403);
  const info = infoFor(db, name);
  if (info.protected) throw new DbmError(`${info.label} is protected: delete records one at a time instead.`, 403);
  const filter = parseFilter(filterText);
  if (!Object.keys(filter).length) throw new DbmError("Add a filter first. Deleting a whole collection isn't allowed here.");
  const coll = await collection(db, name);
  const count = await coll.countDocuments(filter, { maxTimeMS: 15_000 });
  if (!run) {
    const stats = await coll.aggregate([{ $collStats: { storageStats: {} } }]).next().catch(() => null);
    return { count, bytes: Math.round(count * Number(stats?.storageStats?.avgObjSize ?? 0)) };
  }
  if (count > 50_000) throw new DbmError("That matches over 50,000 records. Narrow the filter and run it in parts.");
  const batch = await startBatch("bulk-delete", `Deleted ${count.toLocaleString()} from ${info.label} by filter`, actor);
  const removed = await deleteWithFiles(batch, db, name, filter, coll);
  await audit(actor, "db-delete-filter", { db, coll: name, filter: String(filterText).slice(0, 2000), count: removed, batch: String(batch) });
  return { removed, batch: String(batch) };
}
