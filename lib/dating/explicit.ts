// Explicit (NSFW) photos on Social profiles.
//
// * Stored apart from the SFW photos: GridFS bucket "dating_explicit", listed on the profile as `explicit: [{id, ext, at}]`.
// * Never shown on cards, Discover, Browse, previews or anywhere else: only in their own section on the full profile,
//   blurred until clicked.
// * The owner picks who can see them (Settings → Privacy, `explicitFrom`): everyone on Social, matches & friends,
//   only matches, or nobody. Blocked people never can. Every image request checks this again.
// * Uploading requires confirming the photos are of the uploader and that everyone in them is 18+.
// * Admins can open them only while reviewing a report about that member.

import { blockedIds, datingCols, toLong } from "./db";
import { deletePhoto, readPhoto, savePhoto } from "./media";
import { getProfile } from "./profiles";
import { getSettings } from "./settings";
import { friendState, isMatch } from "./social";

export const EXPLICIT_BUCKET = "dating_explicit";
export const MAX_EXPLICIT = 10;
export const MAX_EXPLICIT_BYTES = 8 * 1024 * 1024;

export type ExplicitFrom = "everyone" | "connections" | "matches" | "nobody";
export const EXPLICIT_FROM: { key: ExplicitFrom; label: string; hint: string }[] = [
  { key: "everyone", label: "Everyone on Social", hint: "Any 18+ verified member who opens your profile." },
  { key: "connections", label: "Matches & friends", hint: "People you've matched with or added as a friend." },
  { key: "matches", label: "Only matches", hint: "Only people you've matched with." },
  { key: "nobody", label: "Nobody", hint: "Hidden from everyone (you can still see and manage them)." },
];

export type ExplicitPhoto = { id: string; ext: string; at?: Date };
export const explicitUrl = (p: { id: string; ext: string }) => `/api/dating/explicit/${p.id}.${p.ext}`;

export class ExplicitError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

/** Can `viewer` see `owner`'s explicit photos? (The owner always can.) */
export async function canSeeExplicit(viewer: string, owner: string, from?: ExplicitFrom): Promise<boolean> {
  if (viewer === owner) return true;
  const rule = from ?? (await getSettings(owner)).explicitFrom;
  if (rule === "nobody") return false;
  if ((await blockedIds(owner)).has(viewer)) return false;
  if (rule === "everyone") return true;
  if (await isMatch(viewer, owner)) return true;
  return rule === "connections" && (await friendState(viewer, owner)) === "friends";
}

/** The explicit section of a profile, as one viewer sees it. */
export async function explicitSection(doc: Record<string, unknown>, viewer: string | null) {
  const list = ((doc.explicit ?? []) as ExplicitPhoto[]).filter((p) => p && p.id);
  if (!list.length) return null;
  const owner = String(doc._id);
  const from = (await getSettings(owner).catch(() => null))?.explicitFrom ?? "matches";
  const visible = viewer ? await canSeeExplicit(viewer, owner, from).catch(() => false) : false;
  // Someone who can't see them is told how many there are and who can (nothing at all if they're set to Nobody)
  if (!visible && from === "nobody") return null;
  return {
    count: list.length,
    visible,
    rule: from,
    photos: visible ? list.map((p) => ({ id: p.id, url: explicitUrl(p) })) : [],
  };
}

export async function addExplicit(owner: string, data: Buffer, confirmed: boolean) {
  if (!confirmed) throw new ExplicitError("Please confirm the photos are of you and that everyone in them is 18 or older.");
  const doc = await getProfile(owner);
  if (!doc) throw new ExplicitError("Create your Social profile first.");
  if (((doc.explicit ?? []) as unknown[]).length >= MAX_EXPLICIT) throw new ExplicitError(`You can have up to ${MAX_EXPLICIT} explicit photos. Remove one first.`);
  const saved = await savePhoto(data, owner, EXPLICIT_BUCKET, MAX_EXPLICIT_BYTES);
  const { profiles } = await datingCols();
  // The limit is checked again in the update itself, so two uploads at once can't go over it
  const res = await profiles.updateOne(
    { _id: toLong(owner), [`explicit.${MAX_EXPLICIT - 1}`]: { $exists: false } } as never,
    { $push: { explicit: { id: saved.id, ext: saved.ext, at: new Date(), confirmed: true } }, $set: { updated_at: new Date() } } as never,
  );
  if (!res.modifiedCount) {
    await deletePhoto(saved.id, EXPLICIT_BUCKET);
    throw new ExplicitError(`You can have up to ${MAX_EXPLICIT} explicit photos.`);
  }
}

export async function removeExplicit(owner: string, id: string) {
  const { profiles } = await datingCols();
  const res = await profiles.updateOne({ _id: toLong(owner), "explicit.id": id } as never, { $pull: { explicit: { id } } } as never);
  if (res.modifiedCount) await deletePhoto(id, EXPLICIT_BUCKET);
}

/** Reorder (only ids they already have). */
export async function reorderExplicit(owner: string, ids: unknown) {
  if (!Array.isArray(ids)) throw new ExplicitError("Invalid order.");
  const doc = await getProfile(owner);
  // The stored list exactly as it is (for the compare-and-set below)
  const current = (doc?.explicit ?? []) as ExplicitPhoto[];
  const byId = new Map(current.filter((p) => p && p.id).map((p) => [p.id, p]));
  const next = ids.map(String).filter((id) => byId.has(id)).map((id) => byId.get(id)!);
  for (const p of current) if (p && p.id && !next.includes(p)) next.push(p);
  const { profiles } = await datingCols();
  // Only if the list is still exactly what we read (an upload or delete in the meantime would otherwise be lost)
  const res = await profiles.updateOne({ _id: toLong(owner), explicit: current } as never, { $set: { explicit: next.slice(0, MAX_EXPLICIT) } } as never);
  if (!res.matchedCount) throw new ExplicitError("Your photos changed while you were reordering. Try again.", 409);
}

/** Deletes every explicit photo of a member (their profile is being deleted). */
export async function removeAllExplicit(doc: Record<string, unknown> | null) {
  for (const p of ((doc?.explicit ?? []) as ExplicitPhoto[]).filter((x) => x && x.id)) await deletePhoto(p.id, EXPLICIT_BUCKET);
}

export const readExplicit = (id: string) => readPhoto(id, EXPLICIT_BUCKET);

/** Admins may open a member's explicit photos only while a report about that member is open. */
export async function adminMayView(owner: string) {
  const { getMongoClient } = await import("../mongodb");
  const reports = (await getMongoClient()).db(process.env.MONGODB_DB ?? "website").collection("dating_reports");
  return (await reports.countDocuments({ reported: owner, status: "open" }, { limit: 1 })) > 0;
}
