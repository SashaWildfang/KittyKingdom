// Auto-replies (the Main Bot answers when a message matches a phrase) and custom commands (!name, or /tag name).
// zeo_bot.auto_replies {_id, kind: "reply" | "command", trigger, match: "contains" | "exact" | "starts", response,
//                       channels: [], cooldown, enabled, uses, lastUsedAt, updatedBy, updatedAt}
// The Main Bot (events/auto_replies.py) reloads the list every minute.

import { ObjectId, type Document } from "mongodb";
import type { PanelUser } from "./admin";
import { getBotCollection } from "./mongodb";

export type AutoReply = { id: string; kind: "reply" | "command"; trigger: string; match: "contains" | "exact" | "starts"; response: string; channels: string[]; cooldown: number; enabled: boolean; uses: number; lastUsedAt: string | null };

export class AutoReplyError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : null);
const toR = (d: Document): AutoReply => ({
  id: String(d._id),
  kind: d.kind === "command" ? "command" : "reply",
  trigger: String(d.trigger ?? ""),
  match: ["contains", "exact", "starts"].includes(d.match) ? d.match : "contains",
  response: String(d.response ?? ""),
  channels: Array.isArray(d.channels) ? d.channels.map(String) : [],
  cooldown: Number(d.cooldown ?? 60),
  enabled: d.enabled !== false,
  uses: Number(d.uses ?? 0),
  lastUsedAt: iso(d.lastUsedAt),
});

export async function listAutoReplies() {
  const rows = await (await getBotCollection("auto_replies")).find({}).sort({ kind: 1, trigger: 1 }).limit(300).toArray();
  return rows.map(toR);
}

export async function saveAutoReply(panel: PanelUser, input: Record<string, unknown>) {
  const kind = input.kind === "command" ? "command" : "reply";
  let trigger = String(input.trigger ?? "").trim().toLowerCase();
  if (kind === "command") {
    trigger = trigger.replace(/^[!/]+/, "");
    if (!/^[a-z0-9_-]{1,32}$/.test(trigger)) throw new AutoReplyError("Command names are one word: letters, numbers, - or _ (up to 32).");
  } else if (trigger.length < 2 || trigger.length > 100) throw new AutoReplyError("The phrase should be 2 to 100 characters.");
  const response = String(input.response ?? "").trim().slice(0, 1900);
  if (!response) throw new AutoReplyError("Write what the bot should say.");
  const match = ["contains", "exact", "starts"].includes(String(input.match)) ? String(input.match) : "contains";
  const channels = (Array.isArray(input.channels) ? input.channels : []).map(String).filter((c) => /^\d{15,21}$/.test(c)).slice(0, 25);
  const cooldown = Math.max(0, Math.min(3600, Math.round(Number(input.cooldown ?? 60)) || 0));
  const c = await getBotCollection("auto_replies");
  const id = input.id && ObjectId.isValid(String(input.id)) ? new ObjectId(String(input.id)) : null;
  const clash = await c.findOne({ kind, trigger, ...(id ? { _id: { $ne: id } } : {}) });
  if (clash) throw new AutoReplyError(kind === "command" ? `There's already a !${trigger} command.` : "There's already an auto-reply for that phrase.");
  const set = { kind, trigger, match, response, channels, cooldown, enabled: input.enabled !== false, updatedBy: panel.discordId, updatedAt: new Date() };
  if (id) {
    const r = await c.findOneAndUpdate({ _id: id }, { $set: set }, { returnDocument: "after" });
    if (!r) throw new AutoReplyError("Not found.", 404);
    return toR(r);
  }
  const r = await c.insertOne({ ...set, uses: 0, createdAt: new Date() });
  return toR({ ...set, _id: r.insertedId, uses: 0 });
}

export async function deleteAutoReply(id: string) {
  if (!ObjectId.isValid(id)) throw new AutoReplyError("Not found.", 404);
  await (await getBotCollection("auto_replies")).deleteOne({ _id: new ObjectId(id) });
}

export async function toggleAutoReply(id: string, enabled: boolean) {
  if (!ObjectId.isValid(id)) throw new AutoReplyError("Not found.", 404);
  await (await getBotCollection("auto_replies")).updateOne({ _id: new ObjectId(id) }, { $set: { enabled, updatedAt: new Date() } });
}
