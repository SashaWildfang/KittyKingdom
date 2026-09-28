// Dating data on the website. Shares the dating bot's collections in zeo_bot (profiles are keyed by
// the Discord id as an Int64, so ids always go through toLong) and adds the website's own:
//   dating_profiles  profile per member (bot schema + photos, prompts, looks, privacy under `web`)
//   profile_likes    {_id: liked, likes: [{liker_id, timestamp}], historical_likers}
//   profile_passes   {_id: user, passed_users: [{user_id, timestamp}]}
//   dating_activity  {_id: user, last_like_date, likes_given_today}
//   dating_matches   {_id: "lo-hi", users: [lo, hi], matched_at}
//   dating_friends   {_id: "lo-hi", users, from, to, status: pending|accepted, at}      (new)
//   dating_blocks    {_id: "blocker-blocked", blocker, blocked, at}                    (new)
//   dating_friend_skips {_id: member, ids: [{id, at}]}  people skipped in Discover → Friends (new)
//   dating_messages / dating_conversations / dating_reports / notifications            (new)

import { Long, type Collection, type Document } from "mongodb";
import { getBotCollection } from "../mongodb";

export const toLong = (id: string | number | Long) => (id instanceof Long ? id : Long.fromString(String(id)));
export const idOf = (v: unknown) => (v === null || v === undefined ? "" : String(v));
export const isSnowflake = (v: unknown): v is string => typeof v === "string" && /^\d{15,21}$/.test(v);
export const pairId = (a: string, b: string) => {
  const [lo, hi] = BigInt(a) < BigInt(b) ? [a, b] : [b, a];
  return `${lo}-${hi}`;
};

type Cols = {
  profiles: Collection<Document>;
  likes: Collection<Document>;
  passes: Collection<Document>;
  activity: Collection<Document>;
  matches: Collection<Document>;
  friends: Collection<Document>;
  blocks: Collection<Document>;
  vectors: Collection<Document>;
  friendSkips: Collection<Document>;
};

let ready: Promise<void> | null = null;

export async function datingCols(): Promise<Cols> {
  const [profiles, likes, passes, activity, matches, friends, blocks, vectors, friendSkips] = await Promise.all(
    ["dating_profiles", "profile_likes", "profile_passes", "dating_activity", "dating_matches", "dating_friends", "dating_blocks", "dating_vectors", "dating_friend_skips"].map((n) => getBotCollection(n)),
  );
  ready ??= Promise.all([
    friends.createIndex({ users: 1 }),
    blocks.createIndex({ blocker: 1 }),
    blocks.createIndex({ blocked: 1 }),
    matches.createIndex({ users: 1 }),
  ]).then(() => undefined, () => undefined);
  await ready;
  return { profiles, likes, passes, activity, matches, friends, blocks, vectors, friendSkips };
}

/** Everyone this member has blocked or been blocked by (both hide each other everywhere). */
export async function blockedIds(me: string): Promise<Set<string>> {
  const { blocks } = await datingCols();
  const rows = await blocks.find({ $or: [{ blocker: me }, { blocked: me }] }, { projection: { blocker: 1, blocked: 1 } }).toArray();
  return new Set(rows.map((r) => (r.blocker === me ? String(r.blocked) : String(r.blocker))));
}
