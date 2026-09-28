// A member's dating age isn't typed in: it comes from their date of birth (their Discord join
// application, or the birthday saved on their website account) and so updates on its own every
// birthday. Old profiles keep their stored age only when no birthday is on file anywhere.

import { calculateAge } from "../dates";
import { applicationBirthday } from "../join-application";
import { getJoinApplicationsCollection, getUsersCollection } from "../mongodb";
import { datingCols, toLong } from "./db";
import type { ProfileDoc } from "./schema";

export type BirthInfo = { age: number | null; fromBirthday: boolean; source: "application" | "account" | null };

/** Birthday-based ages for many members at once. */
export async function birthInfo(ids: string[]): Promise<Map<string, BirthInfo>> {
  const out = new Map<string, BirthInfo>();
  if (!ids.length) return out;
  const [apps, users] = await Promise.all([
    getJoinApplicationsCollection()
      .then((c) => c.find({ $or: [{ discordId: { $in: ids } }, { discord_id: { $in: ids } }, { userId: { $in: ids } }, { user_id: { $in: ids } }] }).sort({ submittedAt: -1 }).toArray())
      .catch(() => []),
    getUsersCollection()
      .then((c) => c.find({ discordId: { $in: ids } }, { projection: { discordId: 1, dateOfBirth: 1, age: 1 } }).toArray())
      .catch(() => []),
  ]);
  const appOf = new Map<string, Record<string, unknown>>();
  for (const a of apps) {
    const id = String(a.discordId ?? a.discord_id ?? a.userId ?? a.user_id ?? "");
    if (id && !appOf.has(id)) appOf.set(id, a); // newest first
  }
  const userOf = new Map(users.map((u) => [String(u.discordId), u]));
  for (const id of ids) {
    const app = appOf.get(id) ?? null;
    const user = userOf.get(id);
    const b = applicationBirthday(app, { dateOfBirth: user?.dateOfBirth, age: user?.age });
    const source = app ? "application" : user?.dateOfBirth || user?.age ? "account" : null;
    out.set(id, { age: b.birthDate ? calculateAge(b.birthDate) : b.age, fromBirthday: Boolean(b.birthDate), source: b.age !== null ? source : null });
  }
  return out;
}

/** The age to show and match on: from their birthday if known, else what the profile stored. */
export function liveAge(doc: ProfileDoc, info: BirthInfo | undefined): number | null {
  if (info?.age && info.age >= 18) return info.age;
  const stored = typeof doc.age === "number" ? doc.age : Number(doc.age) || null;
  return stored;
}

/** Puts live ages on the given profiles (in memory) and saves any that changed, so the bot sees them too. */
export async function applyLiveAges(docs: ProfileDoc[]) {
  const info = await birthInfo(docs.map((d) => String(d._id))).catch(() => new Map<string, BirthInfo>());
  const changed: { id: string; age: number }[] = [];
  for (const d of docs) {
    const age = liveAge(d, info.get(String(d._id)));
    if (age !== null && age !== d.age) {
      d.age = age;
      changed.push({ id: String(d._id), age });
    }
  }
  if (changed.length) {
    const { profiles } = await datingCols();
    await profiles
      .bulkWrite(changed.map((c) => ({ updateOne: { filter: { _id: toLong(c.id) } as never, update: { $set: { age: c.age } } } })), { ordered: false })
      .catch(() => undefined);
  }
  return info;
}
