// Which news posts a signed-in member has read, so "read" follows them across devices.
//   news_reads {_id: userId, ids: [postId...], allBefore: Date|null, updatedAt}
// A post counts as read if it's in `ids` or was published before `allBefore` ("Mark all as read").

import { getMongoClient } from "./mongodb";

async function col() {
  return (await getMongoClient()).db(process.env.MONGODB_DB ?? "website").collection("news_reads");
}

export async function getNewsReads(userId: string) {
  const doc = await (await col()).findOne({ _id: userId } as never);
  return { ids: ((doc?.ids ?? []) as string[]).map(String), allBefore: doc?.allBefore instanceof Date ? doc.allBefore.toISOString() : null };
}

/** Marks posts read (keeps the newest 300 ids). */
export async function markNewsRead(userId: string, ids: string[]) {
  const clean = ids.filter((id) => /^[a-f0-9]{24}$/.test(id)).slice(0, 100);
  if (!clean.length) return;
  await (await col()).updateOne({ _id: userId } as never, { $push: { ids: { $each: clean, $slice: -300 } }, $set: { updatedAt: new Date() } } as never, { upsert: true });
}

export async function markAllNewsRead(userId: string) {
  await (await col()).updateOne({ _id: userId } as never, { $set: { allBefore: new Date(), ids: [], updatedAt: new Date() } }, { upsert: true });
}
