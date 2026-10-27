// Maintenance mode: while it's on, members see a "back soon" screen instead of the site (staff and admins still
// get in, and sign-in, the status page and the API keep working). website.site_meta {_id: "maintenance", on, message, until, by, byName, at}

import type { PanelUser } from "./admin";
import { getMongoClient } from "./mongodb";

export type Maintenance = { on: boolean; message: string; until: string | null; byName: string | null; at: string | null };

let cache: { at: number; value: Maintenance } | null = null;

async function col() {
  return (await getMongoClient()).db(process.env.MONGODB_DB ?? "website").collection<{ _id: string; on?: boolean; message?: string; until?: Date | null; byName?: string; at?: Date }>("site_meta");
}

export async function getMaintenance(fresh = false): Promise<Maintenance> {
  if (!fresh && cache && Date.now() - cache.at < 15_000) return cache.value;
  const d = await (await col()).findOne({ _id: "maintenance" }).catch(() => null);
  // An end time that has passed switches it off by itself
  const expired = d?.until instanceof Date && d.until.getTime() < Date.now();
  const value = { on: Boolean(d?.on) && !expired, message: String(d?.message ?? ""), until: d?.until instanceof Date ? d.until.toISOString() : null, byName: d?.byName ?? null, at: d?.at instanceof Date ? d.at.toISOString() : null };
  cache = { at: Date.now(), value };
  return value;
}

export async function setMaintenance(panel: PanelUser, input: { on?: unknown; message?: unknown; until?: unknown }) {
  const until = input.until ? new Date(String(input.until)) : null;
  if (until && (Number.isNaN(until.getTime()) || until.getTime() < Date.now())) throw new Error("Pick an end time in the future (or leave it empty).");
  await (await col()).updateOne(
    { _id: "maintenance" },
    { $set: { on: Boolean(input.on), message: String(input.message ?? "").trim().slice(0, 500), until, by: panel.discordId, byName: panel.name, at: new Date() } },
    { upsert: true },
  );
  cache = null;
  return getMaintenance(true);
}
