// Everyone's dating profiles and AI vectors, cached for a short time so ranking a member against the
// whole pool is instant. The pool is small (hundreds), so scoring everyone per request is fine.

import { people } from "../admin-people";
import { inServerIds } from "../member-directory";
import { getCurrentBans } from "../moderation";
import { datingCols } from "./db";
import { decodeVector, type Vectors } from "./matching";
import type { ProfileDoc } from "./schema";
import { mentionIds } from "./text";

/** What the site knows about a member from Discord: name, avatar and whether they're still in the server. */
export type Who = { name: string; username: string | null; avatar: string | null; inServer: boolean };

type Pool = { at: number; profiles: Map<string, ProfileDoc>; vectors: Map<string, Vectors>; inServer: Set<string> | null; who: Map<string, Who>; names: Map<string, string>; banned: Set<string> };
let cache: Pool | null = null;
let loading: Promise<Pool> | null = null;
const TTL_MS = 30_000;

async function load(): Promise<Pool> {
  const c = await datingCols();
  const [docs, vecs, members, bans] = await Promise.all([
    c.profiles.find({}).toArray(),
    c.vectors.find({}).toArray(),
    inServerIds().catch(() => null),
    getCurrentBans().catch(() => null),
  ]);
  // Members banned from the server never show anywhere in Dating
  const banned = bans ?? new Set<string>();
  const profiles = new Map(docs.filter((d) => !banned.has(String(d._id))).map((d) => [String(d._id), d as ProfileDoc]));
  const vectors = new Map<string, Vectors>();
  for (const v of vecs) {
    const id = String(v._id);
    const p = profiles.get(id);
    // Only vectors made from the current version of the profile count
    const src = v.source_updated_at instanceof Date ? v.source_updated_at.getTime() : 0;
    const upd = p?.updated_at instanceof Date ? p.updated_at.getTime() : 0;
    if (!p || src + 1000 < upd) continue;
    const toMap = (list: unknown) =>
      new Map(
        (Array.isArray(list) ? list : [])
          .map((x: { p?: string; v?: string }) => [String(x.p ?? ""), decodeVector(x.v)] as const)
          .filter((x): x is readonly [string, Float32Array] => Boolean(x[0] && x[1])),
      );
    vectors.set(id, { interests: toMap(v.interests), avoid: toMap(v.avoid), bio: decodeVector(v.bio), location: decodeVector(v.location) });
  }
  // Discord names/avatars for everyone with a profile, plus anyone mentioned in profile text
  const ids = new Set(profiles.keys());
  for (const p of Array.from(profiles.values())) for (const m of mentionIds(p)) ids.add(m);
  const found = await people(Array.from(ids)).catch(() => ({}) as Awaited<ReturnType<typeof people>>);
  const inServer = members ? new Set(members) : null;
  const who = new Map<string, Who>();
  const names = new Map<string, string>();
  for (const [id, p] of Object.entries(found)) {
    who.set(id, { name: p.name, username: p.username, avatar: p.avatar, inServer: inServer ? inServer.has(id) : p.inServer });
    if (p.username || p.name !== "Unknown user") names.set(id, p.username ?? p.name);
  }
  return { at: Date.now(), profiles, vectors, inServer, who, names, banned };
}

export async function datingPool(fresh = false): Promise<Pool> {
  if (!fresh && cache && Date.now() - cache.at < TTL_MS) return cache;
  loading ??= load().finally(() => (loading = null));
  cache = await loading;
  return cache;
}

/** Drop the cache after someone edits their profile, so they (and others) see it right away. */
export function invalidatePool() {
  cache = null;
}
