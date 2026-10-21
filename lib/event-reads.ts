// Which events and polls a signed-in member has opened on /events, so "read" follows them across devices.
//   event_reads {_id: userId, ids: ["e:<eventId>" | "p:<pollId>"...], updatedAt}

import { getMongoClient } from "./mongodb";

async function col() {
  return (await getMongoClient()).db(process.env.MONGODB_DB ?? "website").collection("event_reads");
}

const VALID = /^[ep]:(?:gw-)?[a-f0-9]{24}$/;

export async function getEventReads(userId: string) {
  const doc = await (await col()).findOne({ _id: userId } as never);
  return { ids: ((doc?.ids ?? []) as string[]).map(String) };
}

/** Marks events / polls read (keeps the newest 400). */
export async function markEventsRead(userId: string, ids: string[]) {
  const clean = Array.from(new Set(ids.filter((id) => VALID.test(id)))).slice(0, 100);
  if (!clean.length) return;
  await (await col()).updateOne({ _id: userId } as never, { $push: { ids: { $each: clean, $slice: -400 } }, $set: { updatedAt: new Date() } } as never, { upsert: true });
}
