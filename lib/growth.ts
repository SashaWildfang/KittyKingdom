// Growth by source: which ad or site brings visitors, Discord invite clicks, website sign-ups and
// members who linked Discord (only verified server members can link). Sources come from ?ref= /
// ?utm_source= on the link people clicked (remembered for 30 days in the kk_src cookie).

import { getMongoClient } from "./mongodb";

async function db() {
  return (await getMongoClient()).db(process.env.MONGODB_DB ?? "website");
}

export const cleanSource = (v: unknown) => {
  const s = typeof v === "string" ? v.toLowerCase().trim() : "";
  return /^[a-z0-9._-]{1,40}$/.test(s) ? s : null;
};

export async function recordInviteClick(source: string) {
  await (await db()).collection("invite_clicks").insertOne({ at: new Date(), src: source });
}

export async function growthBySource(days = 30) {
  const d = await db();
  const since = new Date(Date.now() - days * 86_400_000);
  const [visits, clicks, signups] = await Promise.all([
    d.collection("page_views").aggregate([{ $match: { ts: { $gte: since }, utm: { $ne: null } } }, { $group: { _id: "$utm", visitors: { $addToSet: "$vid" } } }, { $project: { n: { $size: "$visitors" } } }]).toArray(),
    d.collection("invite_clicks").aggregate([{ $match: { at: { $gte: since } } }, { $group: { _id: "$src", n: { $sum: 1 } } }]).toArray(),
    d
      .collection("users")
      .aggregate([
        { $match: { createdAt: { $gte: since } } },
        { $group: { _id: { $ifNull: ["$registration.source", "direct"] }, n: { $sum: 1 }, linked: { $sum: { $cond: [{ $gt: ["$discordId", null] }, 1, 0] } } } },
      ])
      .toArray(),
  ]);
  const rows = new Map<string, { source: string; visitors: number; inviteClicks: number; signups: number; linked: number }>();
  const row = (k: unknown) => {
    const key = String(k ?? "direct");
    if (!rows.has(key)) rows.set(key, { source: key, visitors: 0, inviteClicks: 0, signups: 0, linked: 0 });
    return rows.get(key)!;
  };
  for (const v of visits) row(v._id).visitors = v.n;
  for (const c of clicks) row(c._id).inviteClicks = c.n;
  for (const s of signups) Object.assign(row(s._id), { signups: s.n, linked: s.linked });
  return Array.from(rows.values()).sort((a, b) => b.linked - a.linked || b.signups - a.signups || b.inviteClicks - a.inviteClicks || b.visitors - a.visitors);
}
