// Per-admin panel preferences that follow you between devices: saved filter views (Tickets, Punishments…) and
// which staff alerts show in your bell. website.admin_prefs {_id: discordId, savedViews: {scope: [...]}, alerts}

import { randomUUID } from "node:crypto";
import { getMongoClient } from "./mongodb";

export type SavedView = { id: string; name: string; value: Record<string, unknown>; at: string };

/** Staff alerts you can turn off, and the notification keys they cover. */
export const STAFF_ALERTS = [
  { key: "ticket-flag", label: "18+ ticket flags", help: "A closed 18+ ticket with a DOB mismatch, someone under 18 or no photos.", pattern: /^ticket-flag:/ },
  { key: "nsfw-verify", label: "18+ verification alerts", help: "Verified with a DOB mismatch, or an ID showing under 18, from the Ticket Bot.", pattern: /^nsfw-(dob|u18):/ },
  { key: "bot-issue", label: "Bot problems", help: "A bot goes offline or hits an error.", pattern: /^bot-issue:/ },
] as const;
export type StaffAlertKey = (typeof STAFF_ALERTS)[number]["key"];

type Doc = { _id: string; savedViews?: Record<string, SavedView[]>; alerts?: { muted?: string[] } };

async function col() {
  return (await getMongoClient()).db(process.env.MONGODB_DB ?? "website").collection<Doc>("admin_prefs");
}

export async function getPrefs(discordId: string) {
  const doc = await (await col()).findOne({ _id: discordId }, { projection: { savedViews: 1, alerts: 1 } });
  return { savedViews: doc?.savedViews ?? {}, muted: (doc?.alerts?.muted ?? []).filter((k) => STAFF_ALERTS.some((a) => a.key === k)) };
}

/** Notification key patterns this person has turned off (for the bell). */
export async function mutedPatterns(discordId: string): Promise<RegExp[]> {
  const doc = await (await col()).findOne({ _id: discordId }, { projection: { alerts: 1 } }).catch(() => null);
  const muted = new Set(doc?.alerts?.muted ?? []);
  return STAFF_ALERTS.filter((a) => muted.has(a.key)).map((a) => a.pattern);
}

export async function setMuted(discordId: string, muted: string[]) {
  const clean = Array.from(new Set(muted.filter((k) => STAFF_ALERTS.some((a) => a.key === k))));
  await (await col()).updateOne({ _id: discordId }, { $set: { "alerts.muted": clean } }, { upsert: true });
  return clean;
}

const SCOPE = /^[a-z0-9-]{1,30}$/;

export async function saveView(discordId: string, scope: string, name: string, value: Record<string, unknown>) {
  if (!SCOPE.test(scope)) throw new Error("bad scope");
  const view: SavedView = { id: randomUUID(), name: name.trim().slice(0, 40) || "My view", value, at: new Date().toISOString() };
  if (JSON.stringify(value).length > 4000) throw new Error("too big");
  await (await col()).updateOne({ _id: discordId }, { $push: { [`savedViews.${scope}`]: { $each: [view], $slice: -15 } } } as never, { upsert: true });
  return view;
}

export async function deleteView(discordId: string, scope: string, id: string) {
  if (!SCOPE.test(scope)) throw new Error("bad scope");
  await (await col()).updateOne({ _id: discordId }, { $pull: { [`savedViews.${scope}`]: { id } } } as never);
}
