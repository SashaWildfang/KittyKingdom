// Admin → Moderation → Lockdown (server side). The Moderation Bot does the work (cmds/lockdown.py, db/locks.py);
// the website reads its state and sends it requests.
//
// zeo_bot.channel_locks      locked channels (bot)
// zeo_bot.lockdown           {_id: "current"} the server lockdown (bot)
// zeo_bot.lock_history       ended locks and lockdowns (bot)
// zeo_bot.lockdown_requests  {action, channelIds, seconds, reason, options, message, post, by, byName, status, result, createdAt}

import { ObjectId } from "mongodb";
import { ADMIN_ROLE_IDS, type PanelUser } from "./admin";
import { botValue } from "./bot-settings/live";
import { BOTS } from "./bot-settings/schema";
import { memberRoleIdsCached } from "./discord-member";
import { LOCKDOWN_PRESETS, type LockdownOptions } from "./lockdown-presets";
import { getBotCollection } from "./mongodb";

export class LockdownError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

const iso = (d: unknown) => (d instanceof Date ? d.toISOString() : null);

function schemaDefault(key: string): string[] {
  const f = BOTS.find((b) => b.key === "moderation")?.sections.flatMap((s) => s.fields).find((x) => x.key === key);
  return Array.isArray(f?.default) ? (f!.default as string[]) : [];
}

/** Who can lock channels / start a lockdown: the roles in perms.lock / perms.lockdown (admins always can). */
export async function lockPermissions(panel: PanelUser) {
  if (panel.level === "admin") return { canLock: true, canLockdown: true };
  const [roles, lock, lockdown] = await Promise.all([memberRoleIdsCached(panel.discordId).catch(() => null), botValue("moderation", "perms.lock"), botValue("moderation", "perms.lockdown")]);
  const has = (list: unknown, key: string) => {
    const ids = Array.isArray(list) ? (list as string[]).map(String) : schemaDefault(key);
    return Boolean(roles?.some((r) => ids.includes(r) || ADMIN_ROLE_IDS.includes(r)));
  };
  return { canLock: has(lock, "perms.lock"), canLockdown: has(lockdown, "perms.lockdown") };
}

export type LockRow = { channelId: string; channelName: string | null; by: string | null; byName: string | null; reason: string; startedAt: string | null; until: string | null; source: string; lockdown: boolean };
export type HistoryRow = { id: string; kind: "channel" | "lockdown"; name: string | null; byName: string | null; reason: string; startedAt: string | null; endedAt: string | null; endedByName: string | null; how: string; kicked?: number };
export type LockdownState = {
  active: boolean;
  startedAt: string | null;
  byName: string | null;
  reason: string;
  until: string | null;
  options: LockdownOptions | null;
  updates: { msg: string; at: string | null; byName: string | null }[];
  kicked: number;
  notes: string[];
};

export async function getLockdownView(panel: PanelUser) {
  const [locksCol, stateCol, histCol, reqCol, settingsCol] = await Promise.all(["channel_locks", "lockdown", "lock_history", "lockdown_requests", "bot_settings"].map((c) => getBotCollection(c)));
  const [locks, state, history, requests, bot, perms] = await Promise.all([
    locksCol.find({}).sort({ startedAt: 1 }).toArray(),
    stateCol.findOne({ _id: "current" } as never),
    histCol.find({}).sort({ endedAt: -1 }).limit(30).toArray(),
    reqCol.find({ createdAt: { $gte: new Date(Date.now() - 15 * 60_000) } }).sort({ createdAt: -1 }).limit(10).toArray(),
    settingsCol.findOne({ _id: "moderation" } as never, { projection: { heartbeatAt: 1 } }),
    lockPermissions(panel),
  ]);
  const s = (state ?? {}) as Record<string, unknown>;
  return {
    perms,
    botOnline: bot?.heartbeatAt instanceof Date && Date.now() - bot.heartbeatAt.getTime() < 90_000,
    lockdown: {
      active: Boolean(s.active),
      startedAt: iso(s.startedAt),
      byName: (s.byName as string) ?? null,
      reason: String(s.reason ?? ""),
      until: iso(s.until),
      options: (s.options as LockdownOptions) ?? null,
      updates: ((s.updates as { msg: string; at: Date; byName: string }[]) ?? []).map((u) => ({ msg: String(u.msg ?? ""), at: iso(u.at), byName: u.byName ?? null })),
      kicked: Number(s.kicked ?? 0),
      notes: ((s.notes as string[]) ?? []).map(String),
    } satisfies LockdownState,
    locks: locks.map(
      (d): LockRow => ({
        channelId: String(d._id),
        channelName: d.channelName ? String(d.channelName) : null,
        by: d.by ? String(d.by) : null,
        byName: d.byName ? String(d.byName) : null,
        reason: String(d.reason ?? ""),
        startedAt: iso(d.startedAt),
        until: iso(d.until),
        source: String(d.source ?? "command"),
        lockdown: Boolean(d.lockdownId),
      }),
    ),
    history: history.map(
      (h): HistoryRow => ({
        id: String(h._id),
        kind: h.kind === "lockdown" ? "lockdown" : "channel",
        name: h.kind === "lockdown" ? "Server lockdown" : h.channelName ? `#${h.channelName}` : null,
        byName: h.byName ?? null,
        reason: String(h.reason ?? ""),
        startedAt: iso(h.startedAt),
        endedAt: iso(h.endedAt),
        endedByName: h.endedByName ?? null,
        how: String(h.how ?? "manual"),
        kicked: h.kind === "lockdown" ? Number(h.kicked ?? 0) : undefined,
      }),
    ),
    requests: requests.map((r) => ({ id: String(r._id), action: String(r.action), status: String(r.status), result: r.result ? String(r.result) : null, notes: (r.notes as string[]) ?? [], at: iso(r.createdAt) })),
  };
}

const ACTIONS = ["lock", "unlock", "extend", "start", "update", "lockdown-timer", "end"] as const;
type Action = (typeof ACTIONS)[number];
const SERVER_ACTIONS: Action[] = ["start", "update", "lockdown-timer", "end"];

export function needsTwoFactor(action: string) {
  return action === "start" || action === "end";
}

/** Queues an action for the bot and waits a few seconds for it to finish. */
export async function sendLockRequest(raw: Record<string, unknown>, panel: PanelUser) {
  const action = String(raw.action) as Action;
  if (!ACTIONS.includes(action)) throw new LockdownError("Unknown action.");
  const perms = await lockPermissions(panel);
  if (SERVER_ACTIONS.includes(action) ? !perms.canLockdown : !perms.canLock) throw new LockdownError(SERVER_ACTIONS.includes(action) ? "You can't run server lockdowns." : "You can't lock channels.", 403);

  const ids = (Array.isArray(raw.channelIds) ? raw.channelIds : []).map(String).filter((x) => /^\d{15,21}$/.test(x)).slice(0, 50);
  const seconds = Math.max(0, Math.min(30 * 86400, Math.round(Number(raw.seconds) || 0)));
  const reason = typeof raw.reason === "string" ? raw.reason.trim().slice(0, 300) : "";
  const doc: Record<string, unknown> = { action, by: panel.discordId, byName: panel.name, status: "pending", createdAt: new Date() };

  if (action === "lock" || action === "unlock" || action === "extend") {
    if (!ids.length) throw new LockdownError("Pick at least one channel.");
    Object.assign(doc, { channelIds: ids, seconds: seconds || null, reason, notice: raw.notice !== false });
  } else if (action === "start") {
    if (!reason) throw new LockdownError("Give a reason: members see it.");
    const preset = LOCKDOWN_PRESETS[String(raw.preset)] ?? LOCKDOWN_PRESETS.raid;
    const o = (raw.options && typeof raw.options === "object" ? raw.options : {}) as Partial<LockdownOptions>;
    const options: LockdownOptions = {
      pauseInvites: o.pauseInvites ?? preset.pauseInvites,
      pauseDms: o.pauseDms ?? preset.pauseDms,
      joinAction: (o.joinAction ?? preset.joinAction) === "kick" ? "kick" : "none",
      raiseVerification: o.raiseVerification ?? preset.raiseVerification,
      lockChats: o.lockChats ?? preset.lockChats,
      slowmode: Math.max(0, Math.min(21600, Math.round(Number(o.slowmode ?? preset.slowmode) || 0))),
    };
    for (const k of ["pauseInvites", "pauseDms", "raiseVerification", "lockChats"] as const) options[k] = Boolean(options[k]);
    if (!options.pauseInvites && !options.pauseDms && options.joinAction === "none" && !options.raiseVerification && !options.lockChats && !options.slowmode) throw new LockdownError("Turn on at least one thing to lock.");
    Object.assign(doc, { reason, options, seconds: seconds || null });
  } else if (action === "update") {
    const message = typeof raw.message === "string" ? raw.message.trim().slice(0, 1000) : "";
    if (!message) throw new LockdownError("Write the update first.");
    Object.assign(doc, { message, post: raw.post !== false });
  } else if (action === "lockdown-timer") {
    Object.assign(doc, { seconds: seconds || null });
  } else if (action === "end") {
    Object.assign(doc, { reason });
  }

  const col = await getBotCollection("lockdown_requests");
  const recent = await col.countDocuments({ by: panel.discordId, createdAt: { $gte: new Date(Date.now() - 60_000) } });
  if (recent >= 20) throw new LockdownError("Slow down a little.", 429);
  const { insertedId } = await col.insertOne(doc);
  // The bot checks every 3 seconds: wait a little so most actions come back finished
  for (let i = 0; i < 16; i++) {
    await new Promise((r) => setTimeout(r, 500));
    const r = await col.findOne({ _id: insertedId });
    if (r && (r.status === "done" || r.status === "failed")) return { id: String(insertedId), status: r.status as string, result: (r.result as string) ?? null, notes: (r.notes as string[]) ?? [] };
  }
  return { id: String(insertedId), status: "pending", result: null, notes: [] };
}

export async function lockRequestStatus(id: string, panel: PanelUser) {
  if (!ObjectId.isValid(id)) throw new LockdownError("Not found.", 404);
  const r = await (await getBotCollection("lockdown_requests")).findOne({ _id: new ObjectId(id), by: panel.discordId });
  if (!r) throw new LockdownError("Not found.", 404);
  return { id, status: String(r.status), result: r.result ? String(r.result) : null, notes: (r.notes as string[]) ?? [] };
}
