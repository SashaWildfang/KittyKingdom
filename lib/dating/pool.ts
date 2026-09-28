// Everyone's dating profiles and AI vectors, cached for a short time so ranking a member against the
// whole pool is instant. The pool is small (hundreds), so scoring everyone per request is fine.

import { inServerIds } from "../member-directory";
import { datingCols } from "./db";
import { decodeVector, type Vectors } from "./matching";
import type { ProfileDoc } from "./schema";

type Pool = { at: number; profiles: Map<string, ProfileDoc>; vectors: Map<string, Vectors>; inServer: Set<string> | null };
let cache: Pool | null = null;
let loading: Promise<Pool> | null = null;
const TTL_MS = 30_000;

async function load(): Promise<Pool> {
  const c = await datingCols();
  const [docs, vecs, members] = await Promise.all([
    c.profiles.find({}).toArray(),
    c.vectors.find({}).toArray(),
    inServerIds().catch(() => null),
  ]);
  const profiles = new Map(docs.map((d) => [String(d._id), d as ProfileDoc]));
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
  return { at: Date.now(), profiles, vectors, inServer: members ? new Set(members) : null };
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
