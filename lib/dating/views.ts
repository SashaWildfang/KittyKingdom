// Profile views: who looked at your profile, and a notification when they do (unless they browse
// anonymously or you turned view notifications off). One row per viewer/profile pair.
//   dating_profile_views {_id: "viewer:viewed", viewer, viewed, at, first, count, anon}

import { getMongoClient } from "../mongodb";
import { notify } from "../notifications";
import { getSettings } from "./settings";

const RENOTIFY_MS = 3 * 86_400_000; // the same person looking again only pings once every 3 days

async function col() {
  const c = (await getMongoClient()).db(process.env.MONGODB_DB ?? "website").collection("dating_profile_views");
  await c.createIndex({ viewed: 1, at: -1 }).catch(() => undefined);
  return c;
}

export async function recordView(viewer: string, viewed: string, viewerName: string) {
  if (viewer === viewed) return;
  const c = await col();
  const anon = (await getSettings(viewer)).anonymousViews;
  const now = new Date();
  await c.updateOne(
    { _id: `${viewer}:${viewed}` } as never,
    { $set: { viewer, viewed, at: now, anon }, $setOnInsert: { first: now }, $inc: { count: 1 } },
    { upsert: true },
  );
  if (anon) return;
  // Claim the ping in one step (when they were last pinged, not last looked), so repeat visits and
  // two page loads at once never send more than one
  const claimed = await c.updateOne(
    { _id: `${viewer}:${viewed}`, $or: [{ notifiedAt: { $exists: false } }, { notifiedAt: { $lt: new Date(now.getTime() - RENOTIFY_MS) } }] } as never,
    { $set: { notifiedAt: now } },
  );
  if (!claimed.modifiedCount) return;
  await notify(viewed, { type: "view", actor: viewer, title: `${viewerName} viewed your profile`, body: "Take a look at theirs?", link: `/social/u/${viewer}`, key: `view:${viewer}` });
}

/** People who viewed your profile, newest first (anonymous views only count). */
export async function viewersOf(me: string, limit = 60) {
  const c = await col();
  const week = new Date(Date.now() - 7 * 86_400_000);
  const [rows, weekCount] = await Promise.all([
    c.find({ viewed: me, anon: { $ne: true } }).sort({ at: -1 }).limit(limit).toArray(),
    c.countDocuments({ viewed: me, at: { $gte: week } }),
  ]);
  return { views: rows.map((r) => ({ id: String(r.viewer), at: (r.at as Date).toISOString(), count: Number(r.count ?? 1) })), weekCount };
}

/** For a profile page: how many members have viewed it, and when (if ever) its owner viewed yours. */
export async function viewStats(profileId: string, me: string) {
  const c = await col();
  const [total, week, theirs, mine] = await Promise.all([
    c.countDocuments({ viewed: profileId }),
    c.countDocuments({ viewed: profileId, at: { $gte: new Date(Date.now() - 7 * 86_400_000) } }),
    c.findOne({ _id: `${profileId}:${me}` } as never),
    c.findOne({ _id: `${me}:${profileId}` } as never),
  ]);
  return {
    total,
    week,
    // Anonymous browsers don't show as having viewed you
    theyViewedMe: theirs && !theirs.anon && theirs.at instanceof Date ? theirs.at.toISOString() : null,
    iViewedBefore: Boolean(mine && Number(mine.count ?? 0) > 1),
  };
}
