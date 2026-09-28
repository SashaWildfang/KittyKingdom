// Profile views: who looked at your profile, and a notification when they do (unless they browse
// anonymously or you turned view notifications off). One row per viewer/profile pair.
//   dating_profile_views {_id: "viewer:viewed", viewer, viewed, at, first, count, anon}

import { getMongoClient } from "../mongodb";
import { notify } from "../notifications";
import { getSettings } from "./settings";

const RENOTIFY_MS = 12 * 3_600_000; // the same person looking again only pings after 12 hours

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
  const before = await c.findOneAndUpdate(
    { _id: `${viewer}:${viewed}` } as never,
    { $set: { viewer, viewed, at: now, anon }, $setOnInsert: { first: now }, $inc: { count: 1 } },
    { upsert: true, returnDocument: "before" },
  );
  const last = before?.at instanceof Date ? before.at.getTime() : 0;
  if (anon || Date.now() - last < RENOTIFY_MS) return;
  await notify(viewed, { type: "view", actor: viewer, title: `👀 ${viewerName} viewed your profile`, body: "Take a look at theirs?", link: `/dating/u/${viewer}`, key: `view:${viewer}` });
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
