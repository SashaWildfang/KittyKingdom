// Likes, passes, matches, friends and blocks. Likes/passes/matches use the dating bot's collections
// and rules (3 new likes a day unless boosting; non-boosters see their 3 most recent likers).

import { Long } from "mongodb";
import { notify } from "../notifications";
import { blockedIds, datingCols, pairId, toLong } from "./db";

export const DAILY_LIKE_LIMIT = 3;
export const VISIBLE_LIKERS = 3;

const today = () => new Date().toISOString().slice(0, 10);
const idStr = (v: unknown) => String(v);

export async function likesLeftToday(me: string, booster: boolean): Promise<number | null> {
  if (booster) return null;
  const { activity } = await datingCols();
  const act = await activity.findOne({ _id: toLong(me) } as never);
  const used = act?.last_like_date === today() ? Number(act.likes_given_today ?? 0) : 0;
  return Math.max(DAILY_LIKE_LIMIT - used, 0);
}

export async function hasLiked(liker: string, target: string) {
  const { likes } = await datingCols();
  return (await likes.countDocuments({ _id: toLong(target), "likes.liker_id": toLong(liker) } as never, { limit: 1 })) > 0;
}

export async function likedIds(me: string): Promise<Set<string>> {
  const { likes } = await datingCols();
  return new Set((await likes.find({ "likes.liker_id": toLong(me) } as never, { projection: { _id: 1 } }).toArray()).map((d) => idStr(d._id)));
}

export async function passedIds(me: string): Promise<Set<string>> {
  const { passes } = await datingCols();
  const doc = await passes.findOne({ _id: toLong(me) } as never);
  return new Set(((doc?.passed_users ?? []) as unknown[]).map((p) => idStr(typeof p === "object" && p ? (p as { user_id: unknown }).user_id : p)));
}

export type LikeResult = { status: "liked" | "already" | "limit" | "blocked"; mutual: boolean; left: number | null };

export async function like(me: string, target: string, booster: boolean, myName: string): Promise<LikeResult> {
  if (me === target) return { status: "blocked", mutual: false, left: null };
  if ((await blockedIds(me)).has(target)) return { status: "blocked", mutual: false, left: null };
  if (await hasLiked(me, target)) return { status: "already", mutual: false, left: await likesLeftToday(me, booster) };
  const c = await datingCols();
  const targetDoc = await c.likes.findOne({ _id: toLong(target) } as never, { projection: { historical_likers: 1 } });
  const firstTime = !((targetDoc?.historical_likers ?? []) as unknown[]).some((x) => idStr(x) === me);
  // Re-liking someone you liked before doesn't use a daily like (same as the bot)
  if (firstTime && !booster) {
    const act = await c.activity.findOne({ _id: toLong(me) } as never);
    const used = act?.last_like_date === today() ? Number(act.likes_given_today ?? 0) : 0;
    if (used >= DAILY_LIKE_LIMIT) return { status: "limit", mutual: false, left: 0 };
    await c.activity.updateOne({ _id: toLong(me) } as never, { $set: { last_like_date: today(), likes_given_today: used + 1 } }, { upsert: true });
  }
  const now = new Date();
  await c.likes.updateOne({ _id: toLong(target) } as never, { $push: { likes: { liker_id: toLong(me), timestamp: now } }, $addToSet: { historical_likers: toLong(me) } } as never, { upsert: true });
  await c.profiles.updateOne({ _id: toLong(me) } as never, { $set: { last_active: now } });
  const mutual = await hasLiked(target, me);
  if (mutual) {
    const res = await c.matches.updateOne(
      { _id: pairId(me, target) } as never,
      { $setOnInsert: { users: [toLong(me), toLong(target)].sort((a, b) => a.compare(b)), matched_at: now } },
      { upsert: true },
    );
    if (res.upsertedCount) {
      const targetName = String((await c.profiles.findOne({ _id: toLong(target) } as never, { projection: { name: 1 } }))?.name ?? "Someone");
      await Promise.all([
        notify(target, { type: "match", actor: me, title: `💞 It's a match with ${myName}!`, body: "You like each other. Say hi!", link: `/dating/u/${me}` }),
        notify(me, { type: "match", actor: target, title: `💞 It's a match with ${targetName}!`, body: "You like each other. Say hi!", link: `/dating/u/${target}` }),
      ]);
    }
  } else if (firstTime) {
    await notify(target, { type: "like", actor: me, title: "💚 Someone new liked your profile", body: "See who in Likes, and like them back to match.", link: "/dating/likes", key: "likes" });
  }
  return { status: "liked", mutual, left: await likesLeftToday(me, booster) };
}

export async function unlike(me: string, target: string) {
  const c = await datingCols();
  await c.likes.updateOne({ _id: toLong(target) } as never, { $pull: { likes: { liker_id: toLong(me) } } } as never);
  await c.matches.deleteOne({ _id: pairId(me, target) } as never);
}

export async function setPass(me: string, target: string, passed: boolean) {
  const { passes } = await datingCols();
  await passes.updateOne({ _id: toLong(me) } as never, { $pull: { passed_users: { user_id: toLong(target) } } } as never);
  await passes.updateOne({ _id: toLong(me) } as never, { $pull: { passed_users: toLong(target) } } as never);
  if (passed) await passes.updateOne({ _id: toLong(me) } as never, { $push: { passed_users: { user_id: toLong(target), timestamp: new Date() } } } as never, { upsert: true });
}

/** People who like me, newest first. Non-boosters see only the most recent few by name. */
export async function likesReceived(me: string, booster: boolean) {
  const { likes } = await datingCols();
  const doc = await likes.findOne({ _id: toLong(me) } as never);
  const blocked = await blockedIds(me);
  const list = ((doc?.likes ?? []) as { liker_id: Long; timestamp?: Date }[])
    .map((l) => ({ id: idStr(l.liker_id), at: l.timestamp instanceof Date ? l.timestamp.toISOString() : null }))
    .filter((l) => !blocked.has(l.id))
    .sort((a, b) => String(b.at).localeCompare(String(a.at)));
  return list.map((l, i) => ({ ...l, hidden: !booster && i >= VISIBLE_LIKERS }));
}

export async function matchesOf(me: string) {
  const { matches } = await datingCols();
  const blocked = await blockedIds(me);
  const rows = await matches.find({ users: toLong(me) } as never).sort({ matched_at: -1 }).toArray();
  return rows
    .map((r) => ({ id: idStr((r.users as Long[]).find((u) => idStr(u) !== me)), at: r.matched_at instanceof Date ? r.matched_at.toISOString() : null }))
    .filter((m) => m.id && !blocked.has(m.id));
}

export async function isMatch(a: string, b: string) {
  const { matches } = await datingCols();
  return (await matches.countDocuments({ _id: pairId(a, b) } as never, { limit: 1 })) > 0;
}

// ---------- Friends ----------
export type FriendState = "none" | "friends" | "sent" | "received";

export async function friendState(me: string, other: string): Promise<FriendState> {
  const { friends } = await datingCols();
  const f = await friends.findOne({ _id: pairId(me, other) } as never);
  if (!f) return "none";
  if (f.status === "accepted") return "friends";
  return f.from === me ? "sent" : "received";
}

export async function friendAction(me: string, other: string, action: "request" | "accept" | "decline" | "remove", myName: string): Promise<FriendState | string> {
  if (me === other) return "You can't friend yourself.";
  if ((await blockedIds(me)).has(other)) return "You can't do that.";
  const { friends } = await datingCols();
  const _id = pairId(me, other);
  const state = await friendState(me, other);
  if (action === "request") {
    if (state === "received") return friendAction(me, other, "accept", myName);
    if (state !== "none") return state;
    await friends.insertOne({ _id, users: [me, other], from: me, to: other, status: "pending", at: new Date() } as never);
    await notify(other, { type: "friend-request", actor: me, title: `🤝 ${myName} sent you a friend request`, link: "/dating/friends" });
    return "sent";
  }
  if (action === "accept") {
    if (state !== "received") return state;
    await friends.updateOne({ _id } as never, { $set: { status: "accepted", accepted_at: new Date() } });
    await notify(other, { type: "friend-accepted", actor: me, title: `🤝 ${myName} accepted your friend request`, link: `/dating/u/${me}` });
    return "friends";
  }
  await friends.deleteOne({ _id } as never);
  return "none";
}

export async function friendsOf(me: string) {
  const { friends } = await datingCols();
  const rows = await friends.find({ users: me } as never).sort({ at: -1 }).toArray();
  return rows.map((r) => ({ id: (r.users as string[]).find((u) => u !== me)!, status: r.status === "accepted" ? ("friends" as const) : r.from === me ? ("sent" as const) : ("received" as const), at: (r.accepted_at ?? r.at) as Date }));
}

// ---------- Blocks ----------
export async function block(me: string, other: string) {
  if (me === other) return;
  const c = await datingCols();
  await c.blocks.updateOne({ _id: `${me}-${other}` } as never, { $set: { blocker: me, blocked: other, at: new Date() } }, { upsert: true });
  // Blocking ends everything between you: likes, match and friendship
  await Promise.all([unlike(me, other), unlike(other, me), c.friends.deleteOne({ _id: pairId(me, other) } as never)]);
}

export async function unblock(me: string, other: string) {
  const { blocks } = await datingCols();
  await blocks.deleteOne({ _id: `${me}-${other}` } as never);
}

export async function blockList(me: string) {
  const { blocks } = await datingCols();
  return (await blocks.find({ blocker: me }).sort({ at: -1 }).toArray()).map((b) => ({ id: String(b.blocked), at: (b.at as Date).toISOString() }));
}

// ---------- Discover → Friends skips ----------
export async function friendSkipIds(me: string): Promise<Set<string>> {
  const { friendSkips } = await datingCols();
  const doc = await friendSkips.findOne({ _id: me } as never);
  return new Set(((doc?.ids ?? []) as { id: string }[]).map((x) => String(x.id)));
}

/** Skip (or un-skip) someone in Discover → Friends. */
export async function setFriendSkip(me: string, other: string, skip: boolean) {
  const { friendSkips } = await datingCols();
  if (skip) await friendSkips.updateOne({ _id: me } as never, { $pull: { ids: { id: other } } } as never);
  await friendSkips.updateOne({ _id: me } as never, skip ? ({ $push: { ids: { $each: [{ id: other, at: new Date() }], $slice: -2000 } } } as never) : ({ $pull: { ids: { id: other } } } as never), { upsert: true });
}
