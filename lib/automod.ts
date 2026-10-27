// Admin → AutoMod: the bot's AutoMod settings (zeo_bot.automod_config, the same document the
// /automod commands edit; the bot picks up changes within ~15 seconds), what it has caught
// (automod_events, kept 90 days) and the change history (automod_changes).

import type { Document } from "mongodb";
import { DEFAULT_CONFIG, RULE_LABELS } from "./automod-data";
import { plainTerm, cleanPhrase, type AutomodWord } from "./automod-engine";
import { getGuildChannelsRaw, getGuildRoles } from "./discord-member";
import { getBotCollection } from "./mongodb";

export type RuleKey = keyof typeof DEFAULT_CONFIG.rules;
export type RuleSettings = { on: boolean; action?: string; limit?: number; channels?: number; lines?: number; minutes?: number };
export type AutomodConfig = {
  version: number;
  rules: Record<RuleKey, RuleSettings>;
  words: AutomodWord[];
  allow: string[];
  exemptChannels: string[];
  exemptRoles: string[];
  relaxedCategories: string[];
  raid: { on: boolean; until: string | null; auto: boolean; joins: number };
  updatedAt: string | null;
  updatedBy: { source?: string; id?: string; name?: string } | null;
  seeded: boolean;
};

export const RULE_KEYS = Object.keys(DEFAULT_CONFIG.rules) as RuleKey[];
/** Numbers each rule lets you tune, with sensible bounds. */
export const RULE_NUMBERS: Partial<Record<RuleKey, { key: "limit" | "channels" | "lines" | "minutes"; label: string; min: number; max: number }>> = {
  mentions: { key: "limit", label: "People per message", min: 2, max: 50 },
  pings: { key: "limit", label: "Pings of one person in 30s", min: 2, max: 20 },
  crosspost: { key: "channels", label: "Channels within 30s", min: 2, max: 10 },
  media: { key: "limit", label: "Media posts within 10s", min: 2, max: 30 },
  formatting: { key: "lines", label: "Lines per message", min: 5, max: 200 },
  emoji: { key: "limit", label: "Emojis per message", min: 5, max: 100 },
  newcomers: { key: "minutes", label: "Minutes after joining", min: 1, max: 1440 },
};
export const RULE_ACTIONS: Partial<Record<RuleKey, string[]>> = Object.fromEntries(
  RULE_KEYS.filter((k) => "action" in DEFAULT_CONFIG.rules[k]).map((k) => [k, k === "names" ? ["rename", "alert"] : ["punish", "delete", "alert"]]),
);

async function configCol() {
  return getBotCollection("automod_config");
}

const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : typeof v === "string" ? v : null);

export async function getAutomodConfig(): Promise<AutomodConfig> {
  const doc = (await (await configCol()).findOne({ _id: "config" } as never)) as Document | null;
  const base = JSON.parse(JSON.stringify(DEFAULT_CONFIG)) as Record<string, unknown> & { rules: Record<string, RuleSettings>; raid: Record<string, unknown> };
  const rules = { ...base.rules };
  for (const [k, v] of Object.entries((doc?.rules ?? {}) as Record<string, RuleSettings>)) if (k in rules) rules[k] = { ...rules[k], ...v };
  const raid = { ...base.raid, ...((doc?.raid as Record<string, unknown>) ?? {}) };
  return {
    version: typeof doc?.version === "number" ? doc.version : 0,
    rules: rules as AutomodConfig["rules"],
    words: ((doc?.words ?? []) as AutomodWord[]).filter((w) => w && typeof w.w === "string").map((w) => ({ w: w.w, sev: w.sev === "severe" ? "severe" : "standard", match: w.match === "partial" ? "partial" : "word" })),
    allow: ((doc?.allow ?? base.allow) as string[]).map(String),
    exemptChannels: ((doc?.exemptChannels ?? []) as unknown[]).map(String),
    exemptRoles: ((doc?.exemptRoles ?? []) as unknown[]).map(String),
    relaxedCategories: ((doc?.relaxedCategories ?? base.relaxedCategories) as unknown[]).map(String),
    raid: { on: Boolean(raid.on), until: iso(raid.until), auto: raid.auto !== false, joins: Number(raid.joins) || 10 },
    updatedAt: iso(doc?.updatedAt),
    updatedBy: (doc?.updatedBy as AutomodConfig["updatedBy"]) ?? null,
    seeded: Boolean(doc),
  };
}

export type AutomodChange =
  | { type: "rule"; rule: RuleKey; on?: boolean; action?: string; value?: number }
  | { type: "addWord"; w: string; sev: "severe" | "standard"; match: "word" | "partial" }
  | { type: "editWord"; w: string; sev: "severe" | "standard"; match: "word" | "partial" }
  | { type: "removeWord"; w: string }
  | { type: "allow"; w: string; remove?: boolean }
  | { type: "exemptChannel" | "exemptRole" | "relaxed"; id: string; remove?: boolean }
  | { type: "raid"; on: boolean; minutes?: number }
  | { type: "raidSettings"; auto?: boolean; joins?: number };

/** Checks one change from the panel; returns the Mongo update and a readable summary, or an error. */
export async function planChange(change: AutomodChange, level: "admin" | "staff"): Promise<{ update: Document; summary: string; arrayFilters?: Document[] } | string> {
  if (!change || typeof change !== "object") return "Invalid change.";
  if (change.type !== "raid" && level !== "admin") return "Only admins can change AutoMod settings.";
  const idOk = (id: unknown) => typeof id === "string" && /^\d{15,21}$/.test(id);
  switch (change.type) {
    case "rule": {
      if (!RULE_KEYS.includes(change.rule)) return "Unknown rule.";
      const set: Document = {};
      const parts: string[] = [];
      if (typeof change.on === "boolean") {
        set[`rules.${change.rule}.on`] = change.on;
        parts.push(change.on ? "on" : "off");
      }
      if (change.action !== undefined) {
        if (!(RULE_ACTIONS[change.rule] ?? []).includes(change.action)) return "That rule can't do that.";
        set[`rules.${change.rule}.action`] = change.action;
        parts.push(change.action);
      }
      if (change.value !== undefined) {
        const n = RULE_NUMBERS[change.rule];
        const v = Math.round(Number(change.value));
        if (!n || !Number.isFinite(v) || v < n.min || v > n.max) return `Pick a number from ${n?.min ?? 0} to ${n?.max ?? 0}.`;
        set[`rules.${change.rule}.${n.key}`] = v;
        parts.push(`${n.label.toLowerCase()}: ${v}`);
      }
      if (!parts.length) return "Nothing to change.";
      return { update: { $set: set }, summary: `${RULE_LABELS[change.rule] ?? change.rule} rule: ${parts.join(", ")}` };
    }
    case "addWord":
    case "editWord": {
      const term = plainTerm(String(change.w ?? ""));
      if (!term || term.length > 60) return "Type a word or phrase (letters, up to 60).";
      const sev = change.sev === "severe" ? "severe" : "standard";
      const match = change.match === "partial" ? "partial" : "word";
      if (match === "partial" && term.length < 3) return "Partial matches need at least 3 letters (or they'd catch everything).";
      const cfg = await getAutomodConfig();
      const exists = cfg.words.some((w) => plainTerm(w.w) === term);
      if (change.type === "addWord") {
        if (exists) return "That word is already blocked.";
        return { update: { $push: { words: { w: term, sev, match } } }, summary: `Blocked a ${sev} word (${match} match)` };
      }
      if (!exists) return "That word isn't on the list.";
      const stored = cfg.words.find((w) => plainTerm(w.w) === term)!.w;
      return { update: { $set: { "words.$[w].sev": sev, "words.$[w].match": match } }, summary: `Changed a blocked word to ${sev}, ${match} match`, arrayFilters: [{ "w.w": stored }] };
    }
    case "removeWord": {
      const cfg = await getAutomodConfig();
      const term = plainTerm(String(change.w ?? ""));
      const stored = cfg.words.filter((w) => w.w === change.w || plainTerm(w.w) === term).map((w) => w.w);
      if (!stored.length) return "That word isn't on the list.";
      return { update: { $pull: { words: { w: { $in: stored } } } }, summary: "Unblocked a word" };
    }
    case "allow": {
      const term = cleanPhrase(String(change.w ?? "")).replace(/ /g, "");
      if (!term || term.length > 40) return "Type a word to allow.";
      return change.remove
        ? { update: { $pull: { allow: term } }, summary: `Removed '${term}' from the allow list` }
        : { update: { $addToSet: { allow: term } }, summary: `Allowed '${term}'` };
    }
    case "exemptChannel":
    case "exemptRole":
    case "relaxed": {
      if (!idOk(change.id)) return "Pick a channel or role.";
      const field = change.type === "exemptChannel" ? "exemptChannels" : change.type === "exemptRole" ? "exemptRoles" : "relaxedCategories";
      const names = change.type === "exemptRole" ? new Map(Array.from((await getGuildRoles()).values(), (r) => [r.id, `@${r.name}`])) : new Map((await getGuildChannelsRaw()).map((c) => [c.id, `#${c.name}`]));
      const name = names.get(change.id) ?? change.id;
      const what = change.type === "exemptChannel" ? "skips AutoMod" : change.type === "exemptRole" ? "skips AutoMod" : "is a relaxed zone";
      return change.remove
        ? { update: { $pull: { [field]: change.id } }, summary: `${name} no longer ${what}` }
        : { update: { $addToSet: { [field]: change.id } }, summary: `${name} ${what}` };
    }
    case "raid": {
      const minutes = Math.round(Number(change.minutes ?? 30));
      if (change.on && (!Number.isFinite(minutes) || minutes < 5 || minutes > 720)) return "Raid mode can last 5 to 720 minutes.";
      return {
        update: { $set: { "raid.on": Boolean(change.on), "raid.until": change.on ? new Date(Date.now() + minutes * 60_000) : null } },
        summary: change.on ? `Raid mode on for ${minutes} minutes` : "Raid mode off",
      };
    }
    case "raidSettings": {
      const set: Document = {};
      if (typeof change.auto === "boolean") set["raid.auto"] = change.auto;
      if (change.joins !== undefined) {
        const j = Math.round(Number(change.joins));
        if (!Number.isFinite(j) || j < 3 || j > 100) return "Pick 3 to 100 joins.";
        set["raid.joins"] = j;
      }
      if (!Object.keys(set).length) return "Nothing to change.";
      return { update: { $set: set }, summary: `Raid alert: ${[typeof change.auto === "boolean" ? `auto raid mode ${change.auto ? "on" : "off"}` : "", set["raid.joins"] ? `${set["raid.joins"]} joins a minute` : ""].filter(Boolean).join(", ")}` };
    }
    default:
      return "Unknown change.";
  }
}

export async function applyChange(plan: { update: Document; summary: string; arrayFilters?: Document[] }, by: { discordId: string; name: string }) {
  const col = await configCol();
  const cfg = await getAutomodConfig();
  if (!cfg.seeded) {
    // The bot creates the settings (importing its old word list) the first time it starts
    throw new Error("AutoMod hasn't started with the new version yet. Upload the new automod.py and restart the moderation bot first.");
  }
  const update: Document = { ...plan.update };
  update.$set = { ...(update.$set ?? {}), updatedAt: new Date(), updatedBy: { source: "website", id: by.discordId, name: by.name } };
  update.$inc = { version: 1 };
  await col.updateOne({ _id: "config" } as never, update, plan.arrayFilters ? { arrayFilters: plan.arrayFilters } : {});
  await (await getBotCollection("automod_changes")).insertOne({ at: new Date(), source: "website", byId: by.discordId, byName: by.name, summary: plan.summary });
}

// ---------- What it caught ----------
export type AutomodEvent = {
  id: string;
  at: string;
  userId: string | null;
  channelId: string | null;
  messageId: string | null;
  rule: string;
  label: string;
  reason: string;
  term: string | null;
  action: string;
  offense: number | null;
  content: string | null;
  /** The bot saved the messages before it (newer catches) */
  hasContext: boolean;
  /** Staff marked it as a mistake */
  falsePositive: { byName: string; at: string; note: string; strikesCleared: number; allowed: string | null } | null;
};

const RANGE_DAYS: Record<string, number> = { "24h": 1, "7d": 7, "30d": 30, "90d": 90 };
/** The four headline numbers, as filters */
export const ACTION_FILTERS: Record<string, string[]> = { punish: ["punish"], delete: ["delete"], flagged: ["alert", "rename"] };
const ruleLabel = (r: unknown) => RULE_LABELS[String(r)] ?? (r === "raid" ? "Raid alert" : String(r ?? ""));

function toEvent(d: Document): AutomodEvent {
  return {
    id: String(d._id),
    at: iso(d.at) ?? "",
    userId: d.userId ? String(d.userId) : null,
    channelId: d.channelId ? String(d.channelId) : null,
    messageId: d.messageId ? String(d.messageId) : null,
    rule: String(d.rule ?? ""),
    label: ruleLabel(d.rule),
    reason: String(d.reason ?? ""),
    term: d.term ? String(d.term) : null,
    action: String(d.action ?? ""),
    offense: typeof d.offense === "number" ? d.offense : null,
    content: d.content ? String(d.content) : null,
    hasContext: Array.isArray(d.context) && d.context.length > 0,
    falsePositive: d.falsePositive
      ? { byName: String(d.falsePositive.byName ?? "staff"), at: iso(d.falsePositive.at) ?? "", note: String(d.falsePositive.note ?? ""), strikesCleared: Number(d.falsePositive.strikesCleared ?? 0), allowed: d.falsePositive.allowed ? String(d.falsePositive.allowed) : null }
      : null,
  };
}

type ActivityOpts = {
  range: string;
  timeZone: string;
  rule?: string | null;
  userId?: string | null;
  page?: number;
  /** punish | delete | flagged */
  action?: string | null;
  channelId?: string | null;
  /** A custom period (a clicked bar): overrides range */
  from?: string | null;
  to?: string | null;
};

export async function automodActivity(opts: ActivityOpts) {
  const custom = opts.from && opts.to && !Number.isNaN(Date.parse(opts.from)) && !Number.isNaN(Date.parse(opts.to));
  const until = custom ? new Date(opts.to!) : new Date();
  const since = custom ? new Date(opts.from!) : new Date(Date.now() - (RANGE_DAYS[opts.range] ?? 7) * 86_400_000);
  const spanMs = Math.max(3_600_000, until.getTime() - since.getTime());
  const days = spanMs / 86_400_000;
  const unit: "hour" | "day" = days <= 2 ? "hour" : "day";
  const col = await getBotCollection("automod_events");
  const filters: Document = {};
  if (opts.rule) filters.rule = opts.rule;
  if (opts.userId && /^\d{15,21}$/.test(opts.userId)) filters.userId = opts.userId;
  if (opts.channelId && /^\d{15,21}$/.test(opts.channelId)) filters.channelId = opts.channelId;
  if (opts.action && ACTION_FILTERS[opts.action]) filters.action = { $in: ACTION_FILTERS[opts.action] };
  const match: Document = { ...filters, at: { $gte: since, $lt: until } };
  const page = Math.max(0, Math.min(200, opts.page ?? 0));
  const [[agg], prevTotal] = await Promise.all([
    col
      .aggregate([
        { $match: match },
        {
          $facet: {
            total: [{ $count: "n" }],
            byRule: [{ $group: { _id: "$rule", n: { $sum: 1 } } }, { $sort: { n: -1, _id: 1 } }],
            byAction: [{ $group: { _id: "$action", n: { $sum: 1 } } }],
            people: [{ $match: { userId: { $ne: null } } }, { $group: { _id: "$userId", n: { $sum: 1 } } }, { $group: { _id: null, all: { $sum: 1 }, repeat: { $sum: { $cond: [{ $gte: ["$n", 2] }, 1, 0] } } } }],
            members: [{ $match: { userId: { $ne: null } } }, { $group: { _id: "$userId", n: { $sum: 1 }, strikes: { $sum: { $cond: [{ $eq: ["$action", "punish"] }, 1, 0] } }, last: { $max: "$at" } } }, { $sort: { n: -1, last: -1, _id: 1 } }, { $limit: 10 }],
            byChannel: [{ $match: { channelId: { $ne: null } } }, { $group: { _id: "$channelId", n: { $sum: 1 } } }, { $sort: { n: -1, _id: 1 } }, { $limit: 8 }],
            byHour: [{ $group: { _id: { $hour: { date: "$at", timezone: opts.timeZone } }, n: { $sum: 1 } } }],
            byWeekday: [{ $group: { _id: { $dayOfWeek: { date: "$at", timezone: opts.timeZone } }, n: { $sum: 1 } } }],
            offenses: [{ $match: { action: "punish", offense: { $type: "number" } } }, { $group: { _id: "$offense", n: { $sum: 1 } } }, { $sort: { _id: 1 } }],
            terms: [{ $match: { term: { $nin: [null, ""] }, rule: { $in: ["words", "severe", "names"] } } }, { $group: { _id: "$term", n: { $sum: 1 } } }, { $sort: { n: -1, _id: 1 } }, { $limit: 12 }],
            series: [
              { $group: { _id: { t: { $dateTrunc: { date: "$at", unit, timezone: opts.timeZone } }, r: "$rule" }, n: { $sum: 1 } } },
              { $sort: { "_id.t": 1 } },
            ],
            rows: [{ $sort: { at: -1, _id: -1 } }, { $skip: page * 25 }, { $limit: 25 }, { $project: { context: { $slice: ["$context", 1] }, userId: 1, channelId: 1, messageId: 1, rule: 1, reason: 1, term: 1, action: 1, offense: 1, content: 1, at: 1, falsePositive: 1 } }],
          },
        },
      ])
      .toArray(),
    col.countDocuments({ ...filters, at: { $gte: new Date(since.getTime() - spanMs), $lt: since } }),
  ]);
  const count = (list: Document[]) => Object.fromEntries(list.map((d) => [String(d._id), d.n as number]));
  const hours = Array.from({ length: 24 }, (_, h) => ((agg?.byHour ?? []) as Document[]).find((d) => d._id === h)?.n ?? 0);
  // Mongo's $dayOfWeek is 1 = Sunday … 7 = Saturday
  const weekdays = Array.from({ length: 7 }, (_, i) => ((agg?.byWeekday ?? []) as Document[]).find((d) => d._id === i + 1)?.n ?? 0);
  return {
    days,
    since: since.toISOString(),
    until: until.toISOString(),
    total: (agg?.total?.[0]?.n as number) ?? 0,
    prevTotal,
    uniqueMembers: (agg?.people?.[0]?.all as number) ?? 0,
    repeatMembers: (agg?.people?.[0]?.repeat as number) ?? 0,
    byRule: (agg?.byRule ?? []).map((d: Document) => ({ rule: String(d._id), label: ruleLabel(d._id), n: d.n as number })),
    byAction: count(agg?.byAction ?? []),
    members: (agg?.members ?? []).map((d: Document) => ({ id: String(d._id), n: d.n as number, strikes: d.strikes as number, last: iso(d.last) })),
    byChannel: (agg?.byChannel ?? []).map((d: Document) => ({ id: String(d._id), n: d.n as number })),
    hours,
    weekdays,
    offenses: (agg?.offenses ?? []).map((d: Document) => ({ offense: d._id as number, n: d.n as number })),
    terms: (agg?.terms ?? []).map((d: Document) => ({ term: String(d._id), n: d.n as number })),
    // Every day (or hour) in the range, stacked by rule; quiet periods stay as empty bars
    timeline: fillTimeline(
      (agg?.series ?? []).map((d: Document) => ({ bucket: iso(d._id?.t) ?? "", action: String(d._id?.r ?? "other"), count: d.n as number })),
      since,
      unit,
      opts.timeZone,
      until,
    ),
    unit,
    page,
    rows: ((agg?.rows ?? []) as Document[]).map(toEvent),
  };
}

export type ContextMessage = { id: string; authorId: string; name: string; bot: boolean; content: string; at: string; files: number; caught?: boolean; deleted?: boolean };

/**
 * One catch in full: the messages around it (saved by the bot when it caught it, plus what Live Chat still has
 * for the last 72 hours, which also shows what came after), and the member's AutoMod history.
 */
export async function automodEvent(id: string) {
  if (!/^[0-9a-f]{24}$/.test(id)) return null;
  const { ObjectId } = await import("mongodb");
  const col = await getBotCollection("automod_events");
  const doc = (await col.findOne({ _id: new ObjectId(id) })) as Document | null;
  if (!doc) return null;
  const event = toEvent(doc);
  const at = doc.at instanceof Date ? doc.at : new Date(event.at);

  const saved: ContextMessage[] = ((doc.context ?? []) as Document[]).map((m) => ({
    id: String(m.id ?? ""),
    authorId: String(m.a ?? ""),
    name: String(m.n ?? "Someone"),
    bot: Boolean(m.bot),
    content: String(m.c ?? ""),
    at: iso(m.t) ?? event.at,
    files: Number(m.files) || 0,
  }));

  let before: ContextMessage[] = saved;
  let after: ContextMessage[] = [];
  let liveCaught: ContextMessage | null = null;
  if (event.channelId && Date.now() - at.getTime() < 72 * 3_600_000) {
    const client = await (await import("./mongodb")).getMongoClient();
    const live = client.db(process.env.MONGODB_DB ?? "website").collection("live_messages");
    const toMsg = (m: Document): ContextMessage => ({
      id: String(m._id),
      authorId: String(m.authorId ?? ""),
      name: String(m.displayName || m.authorName || "Someone"),
      bot: Boolean(m.bot),
      content: String(m.content ?? ""),
      at: iso(m.ts) ?? "",
      files: Array.isArray(m.attachments) ? m.attachments.length : 0,
      deleted: Boolean(m.deleted),
    });
    const inChannel = { channelId: event.channelId };
    const [b, a, c] = await Promise.all([
      saved.length ? Promise.resolve([]) : live.find({ ...inChannel, ts: { $lt: at, $gte: new Date(at.getTime() - 3_600_000) } }).sort({ ts: -1 }).limit(8).toArray(),
      live.find({ ...inChannel, ts: { $gt: at, $lte: new Date(at.getTime() + 3_600_000) } }).sort({ ts: 1 }).limit(6).toArray(),
      event.messageId ? live.findOne({ _id: event.messageId as never }) : Promise.resolve(null),
    ]);
    if (!saved.length) before = (b as Document[]).reverse().map(toMsg).filter((m) => m.id !== event.messageId);
    after = (a as Document[]).map(toMsg).filter((m) => m.id !== event.messageId);
    if (c) liveCaught = toMsg(c as Document);
  }
  const caught: ContextMessage = {
    id: event.messageId ?? "caught",
    authorId: event.userId ?? "",
    name: liveCaught?.name ?? "",
    bot: false,
    content: event.content ?? liveCaught?.content ?? "",
    at: event.at,
    files: liveCaught?.files ?? 0,
    caught: true,
    deleted: event.action === "punish" || event.action === "delete",
  };

  // The member's AutoMod history
  const history = event.userId
    ? ((await col.find({ userId: event.userId }).sort({ at: -1 }).limit(20).project({ context: 0 }).toArray()) as Document[]).map(toEvent)
    : [];
  const totals = event.userId
    ? await col
        .aggregate([{ $match: { userId: event.userId } }, { $group: { _id: "$action", n: { $sum: 1 } } }])
        .toArray()
        .then((list) => Object.fromEntries(list.map((d) => [String(d._id), d.n as number])))
    : {};
  return { event, before, caught, after, contextSource: saved.length ? "bot" : before.length || after.length ? "live" : "none", history, totals };
}

export async function automodChanges(limit = 30) {
  const rows = await (await getBotCollection("automod_changes")).find({}).sort({ at: -1 }).limit(limit).toArray();
  return rows.map((d) => ({ id: String(d._id), at: iso(d.at), source: String(d.source ?? ""), byId: d.byId ? String(d.byId) : null, byName: d.byName ? String(d.byName) : null, summary: String(d.summary ?? "") }));
}

/** Channels (grouped by category) and roles for the pickers. */
export async function automodPlaces() {
  const [channels, roles] = await Promise.all([getGuildChannelsRaw(), getGuildRoles()]);
  return {
    channels: channels
      .filter((c) => [0, 2, 4, 5, 13, 15, 16].includes(c.type))
      .sort((a, b) => a.position - b.position)
      .map((c) => ({ id: c.id, name: c.name, category: c.type === 4, parent: c.parent_id })),
    roles: Array.from(roles.values())
      .filter((r) => !r.managed && r.name !== "@everyone")
      .sort((a, b) => b.position - a.position)
      .map((r) => ({ id: r.id, name: r.name, color: r.colors[0] ?? null })),
  };
}

// ---------- Unread catches (the bubble on the AutoMod tab) ----------
async function prefsCol() {
  const client = await (await import("./mongodb")).getMongoClient();
  return client.db(process.env.MONGODB_DB ?? "website").collection<{ _id: string; automod?: { seenAt?: Date } }>("admin_prefs");
}

/** Catches since this staff member last had the AutoMod tab open (starts at zero the first time). */
export async function automodUnread(viewerId: string) {
  const col = await prefsCol();
  const doc = await col.findOne({ _id: viewerId });
  let seenAt = doc?.automod?.seenAt;
  if (!seenAt) {
    seenAt = new Date();
    await col.updateOne({ _id: viewerId }, { $set: { "automod.seenAt": seenAt } }, { upsert: true });
  }
  return (await getBotCollection("automod_events")).countDocuments({ at: { $gt: seenAt } });
}

export async function markAutomodSeen(viewerId: string) {
  await (await prefsCol()).updateOne({ _id: viewerId }, { $set: { "automod.seenAt": new Date() } }, { upsert: true });
}

/** Adds an empty bucket for every day (or hour) in the range that had no catches. */
function fillTimeline(points: { bucket: string; action: string; count: number }[], since: Date, unit: "hour" | "day", timeZone: string, until = new Date()) {
  const seen = new Set(points.map((p) => p.bucket));
  const out = [...points];
  const now = until.getTime() - 1;
  if (unit === "hour") {
    for (let t = Math.floor(since.getTime() / 3_600_000) * 3_600_000; t <= now; t += 3_600_000) {
      const key = new Date(t).toISOString();
      if (!seen.has(key)) out.push({ bucket: key, action: "none", count: 0 });
    }
  } else {
    // One bucket per calendar day in their time zone (matched to the database's buckets by date)
    const day = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" });
    const have = new Set(points.map((p) => (p.bucket ? day.format(new Date(p.bucket)) : "")));
    for (let t = since.getTime(); t <= now; t += 86_400_000) {
      const key = day.format(new Date(t));
      if (have.has(key)) continue;
      have.add(key);
      out.push({ bucket: `${key}T12:00:00.000Z`, action: "none", count: 0 });
    }
  }
  return out.sort((a, b) => a.bucket.localeCompare(b.bucket));
}
