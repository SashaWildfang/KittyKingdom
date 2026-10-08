// Admin → Bots: reading, validating, saving and logging bot settings (see ./schema.ts).
// zeo_bot.bot_settings {_id: bot, values, version, updatedAt, updatedBy, appliedVersion, heartbeatAt}
// zeo_bot.bot_settings_log {bot, key, label, section, old, new, by, byName, at, version, kind}

import { ObjectId } from "mongodb";
import type { PanelUser } from "../admin";
import { getBotCollection } from "../mongodb";
import { allFields, botDef, type BotDef, type Field } from "./schema";

export class BotSettingsError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

const ID = /^\d{15,25}$/;
const TIMEZONE_OK = (tz: string) => {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

async function settingsCol() {
  return getBotCollection("bot_settings");
}
async function logCol() {
  const c = await getBotCollection("bot_settings_log");
  await c.createIndex({ bot: 1, at: -1 }).catch(() => undefined);
  return c;
}

function requireBot(key: string): BotDef {
  const bot = botDef(key);
  if (!bot) throw new BotSettingsError("Unknown bot.", 404);
  if (!bot.ready) throw new BotSettingsError(`${bot.name} settings aren't set up yet.`, 404);
  return bot;
}

/** Checks and normalises one value for a field. Throws a readable error. */
export function cleanValue(field: Field, raw: unknown): unknown {
  const bad = (msg: string) => new BotSettingsError(`${field.label}: ${msg}`);
  switch (field.type) {
    case "toggle":
      if (typeof raw !== "boolean") throw bad("must be on or off.");
      return raw;
    case "number": {
      const n = typeof raw === "number" ? raw : Number(raw);
      if (!Number.isFinite(n) || !Number.isInteger(n)) throw bad("must be a whole number.");
      if (field.min !== undefined && n < field.min) throw bad(`must be at least ${field.min}.`);
      if (field.max !== undefined && n > field.max) throw bad(`must be at most ${field.max}.`);
      return n;
    }
    case "text":
    case "textarea": {
      const s = String(raw ?? "");
      if (field.maxLength && s.length > field.maxLength) throw bad(`must be ${field.maxLength} characters or fewer.`);
      return s;
    }
    case "timezone": {
      const s = String(raw ?? "").trim();
      if (!TIMEZONE_OK(s)) throw bad("isn't a time zone (e.g. US/Mountain or America/Denver).");
      return s;
    }
    case "select": {
      const s = String(raw ?? "");
      if (!field.options?.some((o) => o.value === s)) throw bad("pick one of the options.");
      return s;
    }
    case "channel":
    case "role": {
      if (raw === null || raw === "") return null;
      const s = String(raw);
      if (!ID.test(s)) throw bad(`pick a ${field.type}.`);
      return s;
    }
    case "channels":
    case "roles": {
      if (!Array.isArray(raw)) throw bad(`pick ${field.type}.`);
      const ids = Array.from(new Set(raw.map(String)));
      if (ids.some((x) => !ID.test(x))) throw bad(`contains something that isn't a ${field.type.slice(0, -1)}.`);
      if (ids.length > 100) throw bad("too many picked.");
      return ids;
    }
    case "list": {
      if (!Array.isArray(raw)) throw bad("must be a list.");
      const items = raw.map((x) => String(x).trim()).filter(Boolean);
      if (!items.length) throw bad("needs at least one line (or reset it to the default).");
      if (field.maxItems && items.length > field.maxItems) throw bad(`can have at most ${field.maxItems} lines.`);
      const long = field.maxLength ? items.find((x) => x.length > field.maxLength!) : undefined;
      if (long) throw bad(`each line must be ${field.maxLength} characters or fewer.`);
      return items;
    }
  }
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export type BotSettingsView = {
  bot: string;
  values: Record<string, unknown>;
  /** Keys an admin has changed from the default */
  changed: string[];
  version: number;
  appliedVersion: number | null;
  heartbeatAt: string | null;
  botName: string | null;
  latencyMs: number | null;
  updatedAt: string | null;
  updatedBy: string | null;
};

export async function getBotSettings(botKey: string): Promise<BotSettingsView> {
  const bot = requireBot(botKey);
  const doc = (await (await settingsCol()).findOne({ _id: bot.key } as never)) as Record<string, unknown> | null;
  // Keys like "logging.channel" are stored as nested fields (values.logging.channel)
  const saved = (doc?.values ?? {}) as Record<string, unknown>;
  const read = (key: string) => key.split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), saved);
  const values: Record<string, unknown> = {};
  const changed: string[] = [];
  for (const f of allFields(bot)) {
    const v = read(f.key);
    if (v !== null && v !== undefined) {
      values[f.key] = v;
      changed.push(f.key);
    } else values[f.key] = f.default;
  }
  const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : null);
  return {
    bot: bot.key,
    values,
    changed,
    version: Number(doc?.version ?? 0),
    appliedVersion: typeof doc?.appliedVersion === "number" ? doc.appliedVersion : null,
    heartbeatAt: iso(doc?.heartbeatAt),
    botName: doc?.botName ? String(doc.botName) : null,
    latencyMs: typeof doc?.latencyMs === "number" ? doc.latencyMs : null,
    updatedAt: iso(doc?.updatedAt),
    updatedBy: doc?.updatedBy ? String(doc.updatedBy) : null,
  };
}

/**
 * Saves changes: { key: value } sets a value, { key: null } resets it to the default.
 * Every real change is written to the change log. Returns the new view.
 */
export async function saveBotSettings(botKey: string, changes: Record<string, unknown>, admin: PanelUser, note?: string) {
  const bot = requireBot(botKey);
  const fields = new Map(allFields(bot).map((f) => [f.key, f]));
  const current = await getBotSettings(bot.key);
  const $set: Record<string, unknown> = {};
  const $unset: Record<string, ""> = {};
  const log: Record<string, unknown>[] = [];
  const at = new Date();
  for (const [key, raw] of Object.entries(changes)) {
    const field = fields.get(key);
    if (!field) throw new BotSettingsError(`Unknown setting: ${key}`);
    const old = current.values[key];
    if (raw === null) {
      if (!current.changed.includes(key)) continue;
      $unset[`values.${key}`] = "";
      log.push({ key, label: field.label, section: field.section, old, new: field.default, kind: "reset" });
      continue;
    }
    const value = cleanValue(field, raw);
    if (same(value, old)) continue;
    // Setting it back to exactly the default is a reset
    if (same(value, field.default)) {
      $unset[`values.${key}`] = "";
      log.push({ key, label: field.label, section: field.section, old, new: value, kind: "reset" });
    } else {
      $set[`values.${key}`] = value;
      log.push({ key, label: field.label, section: field.section, old, new: value, kind: "set" });
    }
  }
  if (!log.length) throw new BotSettingsError("Nothing changed.");
  const res = await (await settingsCol()).findOneAndUpdate(
    { _id: bot.key } as never,
    {
      ...(Object.keys($set).length ? { $set: { ...$set, updatedAt: at, updatedBy: admin.name } } : { $set: { updatedAt: at, updatedBy: admin.name } }),
      ...(Object.keys($unset).length ? { $unset } : {}),
      $inc: { version: 1 },
    },
    { upsert: true, returnDocument: "after", projection: { version: 1 } },
  );
  const version = Number(res?.version ?? 0);
  await (await logCol()).insertMany(
    log.map((l) => ({ ...l, bot: bot.key, by: admin.discordId, byName: admin.name, at, version, note: note?.slice(0, 200) || null })),
  );
  return getBotSettings(bot.key);
}

export type LogEntry = { id: string; bot: string; key: string; label: string; section: string | null; old: unknown; new: unknown; byName: string; by: string; at: string; version: number | null; kind: string; note: string | null };

export async function botSettingsLog(opts: { bot?: string; key?: string; page?: number }) {
  const filter: Record<string, unknown> = {};
  if (opts.bot) filter.bot = opts.bot;
  if (opts.key) filter.key = opts.key;
  const page = Math.max(1, Math.min(200, Number(opts.page) || 1));
  const pageSize = 40;
  const c = await logCol();
  const [rows, total] = await Promise.all([c.find(filter).sort({ at: -1 }).skip((page - 1) * pageSize).limit(pageSize).toArray(), c.countDocuments(filter)]);
  return {
    rows: rows.map(
      (r): LogEntry => ({
        id: String(r._id),
        bot: String(r.bot),
        key: String(r.key),
        label: String(r.label ?? r.key),
        section: r.section ? String(r.section) : null,
        old: r.old ?? null,
        new: r.new ?? null,
        byName: String(r.byName ?? ""),
        by: String(r.by ?? ""),
        at: r.at instanceof Date ? r.at.toISOString() : String(r.at),
        version: typeof r.version === "number" ? r.version : null,
        kind: String(r.kind ?? "set"),
        note: r.note ? String(r.note) : null,
      }),
    ),
    total,
    page,
    pageSize,
  };
}

/** Puts a setting back to what it was before one logged change. */
export async function revertChange(logId: string, admin: PanelUser) {
  if (!ObjectId.isValid(logId)) throw new BotSettingsError("Unknown change.", 404);
  const entry = await (await logCol()).findOne({ _id: new ObjectId(logId) });
  if (!entry) throw new BotSettingsError("Unknown change.", 404);
  const bot = String(entry.bot);
  if (bot === "server") throw new BotSettingsError("Server setting changes are reverted from the Discord Server tab.");
  return saveBotSettings(bot, { [String(entry.key)]: entry.old ?? null }, admin, `Undo of a change from ${new Date(entry.at).toLocaleString("en-US")}`);
}

/** Writes entries for things changed outside the bot settings (e.g. Discord server settings). */
export async function logExternalChanges(bot: string, entries: { key: string; label: string; section?: string; old: unknown; new: unknown }[], admin: PanelUser) {
  if (!entries.length) return;
  const at = new Date();
  await (await logCol()).insertMany(entries.map((e) => ({ ...e, section: e.section ?? null, bot, by: admin.discordId, byName: admin.name, at, version: null, kind: "set", note: null })));
}
