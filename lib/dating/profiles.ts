// Reading and saving dating profiles from the website. Existing profiles keep every field (the
// bot's schema); the website adds photos, prompts, fursona editing and `web` (looks + privacy).

import type { Document } from "mongodb";
import { people } from "../admin-people";
import { newsPlainText } from "../news-format";
import { datingCols, toLong } from "./db";
import { ACCENTS, FIELDS, accentFor, MAX_FURSONAS, MAX_PHOTOS, MAX_PROMPTS, PROMPTS, SECTIONS, cleanField, display, getList, isFilled, profileStrength, reviewFields, type ProfileDoc } from "./schema";
import { SCHEMA_VERSION } from "./schema-data";

export type Photo = { id: string; ext: string; caption?: string };
export type Prompt = { q: string; a: string };
export type Fursona = { name: string; description: string; art_links: string[] };
export type WebPrefs = { accent?: string; headline?: string; paused?: boolean; pausedByStaff?: boolean; hideAge?: boolean; showOnline?: boolean };

export const photoUrl = (p: Photo) => `/api/dating/media/${p.id}.${p.ext}`;

export async function getProfile(discordId: string): Promise<ProfileDoc | null> {
  const { profiles } = await datingCols();
  return (await profiles.findOne({ _id: toLong(discordId) } as never)) as ProfileDoc | null;
}

export type ProfilePatch = {
  fields?: Record<string, unknown>;
  prompts?: unknown;
  fursonas?: unknown;
  photos?: unknown;
  web?: unknown;
  confirmReview?: boolean;
};

const cleanText = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\r\n?/g, "\n").trim().slice(0, max) : "");

/** Validates and saves a profile change (creates the profile the first time). Returns an error message or null. */
export async function saveProfile(discordId: string, patch: ProfilePatch): Promise<string | null> {
  const $set: Document = {};
  const $unset: Document = {};
  const pull: string[] = [];

  for (const [key, value] of Object.entries(patch.fields ?? {})) {
    const res = cleanField(key, value);
    if (typeof res === "string") return res;
    if (res.unset) {
      $unset[key] = "";
      const lk = FIELDS[key]?.listKey;
      if (lk) $unset[lk] = "";
    } else Object.assign($set, res.set);
    pull.push(key);
  }
  if (typeof $set.looking_for_min_age === "number" && typeof $set.looking_for_max_age === "number" && $set.looking_for_min_age > $set.looking_for_max_age) {
    return "The youngest age can't be above the oldest age.";
  }

  if (patch.prompts !== undefined) {
    if (!Array.isArray(patch.prompts)) return "Invalid prompts.";
    const prompts: Prompt[] = patch.prompts
      .map((p) => ({ q: String((p as Prompt)?.q ?? ""), a: cleanText((p as Prompt)?.a, 300) }))
      .filter((p) => PROMPTS.includes(p.q) && p.a);
    if (prompts.length > MAX_PROMPTS) return `Pick up to ${MAX_PROMPTS} prompts.`;
    $set.prompts = prompts;
  }

  if (patch.fursonas !== undefined) {
    if (!Array.isArray(patch.fursonas) || patch.fursonas.length > MAX_FURSONAS) return `Up to ${MAX_FURSONAS} fursonas.`;
    const sonas: Fursona[] = [];
    for (const raw of patch.fursonas) {
      const s = raw as Fursona;
      const name = cleanText(s?.name, 60);
      if (!name) return "Every fursona needs a name.";
      const links = (Array.isArray(s?.art_links) ? s.art_links : []).map((l) => String(l).trim()).filter(Boolean).slice(0, 6);
      if (links.some((l) => !/^https:\/\/[^\s"'<>]+$/.test(l) && !/^\/api\/dating\/media\/[a-f0-9]{24}\.[a-z0-9]{2,5}$/.test(l))) return "Art links must start with https://";
      sonas.push({ name, description: cleanText(s?.description, 800), art_links: links });
    }
    $set.fursonas = sonas;
  }

  if (patch.photos !== undefined) {
    // Only reorders / re-captions photos they already uploaded (uploads go through the media route)
    const current = ((await getProfile(discordId))?.photos ?? []) as Photo[];
    if (!Array.isArray(patch.photos)) return "Invalid photos.";
    const byId = new Map(current.map((p) => [p.id, p]));
    const next: Photo[] = [];
    for (const raw of patch.photos as Photo[]) {
      const p = byId.get(String(raw?.id));
      if (p) next.push({ ...p, caption: cleanText(raw?.caption, 120) || undefined });
    }
    $set.photos = next.slice(0, MAX_PHOTOS);
  }

  if (patch.web !== undefined) {
    const w = (patch.web ?? {}) as WebPrefs;
    const web: WebPrefs = {
      accent: ACCENTS.includes(String(w.accent)) ? String(w.accent) : undefined,
      headline: cleanText(w.headline, 80),
      paused: w.paused === true,
      hideAge: w.hideAge === true,
      showOnline: w.showOnline !== false,
    };
    // A pause from staff (after a report) stays until staff lift it
    const current = ((await getProfile(discordId))?.web ?? {}) as WebPrefs;
    if (current.pausedByStaff) Object.assign(web, { paused: true, pausedByStaff: true });
    $set.web = web;
  }

  if (patch.confirmReview) {
    $set.review_confirmed = true;
    $set.needs_review = [];
  }

  const { profiles } = await datingCols();
  const now = new Date();
  const _id = toLong(discordId);
  const exists = await profiles.countDocuments({ _id } as never, { limit: 1 });
  if (!exists) {
    // A brand-new profile needs the basics the matching relies on
    if (!isFilled($set.name) || typeof $set.age !== "number" || !isFilled($set.gender) || !isFilled($set.is_looking)) {
      return "Add your name, age, gender and whether you're open to dating to create your profile.";
    }
    await profiles.insertOne({
      _id,
      ...$set,
      schema_version: SCHEMA_VERSION,
      profile_weight: 1,
      created_at: now,
      updated_at: now,
      last_active: now,
      needs_review: [],
      review_confirmed: true,
      created_on: "website",
    } as never);
    return null;
  }
  const update: Document = { $set: { ...$set, updated_at: now, last_active: now } };
  if (Object.keys($unset).length) update.$unset = $unset;
  if (pull.length && !patch.confirmReview) update.$pull = { needs_review: { $in: pull } };
  await profiles.updateOne({ _id } as never, update);
  return null;
}

// ---------- What other members see ----------
export type ProfileView = {
  id: string;
  name: string;
  discordName: string | null;
  avatar: string | null;
  age: number | null;
  headline: string | null;
  accent: string;
  photos: { url: string; caption: string | null }[];
  facts: { label: string; value: string; key: string }[];
  sections: { id: string; label: string; emoji: string; items: { key: string; label: string; value: string; legacy: boolean; long: boolean }[] }[];
  prompts: Prompt[];
  fursonas: Fursona[];
  lookingFor: { open: boolean; genders: string[]; relTypes: string[]; ages: string | null };
  lastActive: string | null;
  strength: number;
  paused: boolean;
  isNew: boolean;
};

const FACT_KEYS = ["gender", "pronouns", "sexuality", "location", "timezone", "relationship_status"];
// Shown in the header facts or as their own blocks, so they're left out of the section lists
const SKIP_IN_SECTIONS = new Set(["name", "age", "bio", ...FACT_KEYS, "is_looking", "looking_for_gender", "looking_for_min_age", "looking_for_max_age", "looking_for_relationship_type"]);

export async function profileView(doc: ProfileDoc, opts: { viewerIsOwner?: boolean } = {}): Promise<ProfileView> {
  const id = String(doc._id);
  const who = (await people([id]).catch(() => ({})))[id as keyof object] as { name?: string; username?: string | null; avatar?: string | null } | undefined;
  const web = (doc.web ?? {}) as WebPrefs;
  const photos = ((doc.photos ?? []) as Photo[]).map((p) => ({ url: photoUrl(p), caption: p.caption ?? null }));
  const age = typeof doc.age === "number" ? doc.age : Number(doc.age) || null;
  const sections = SECTIONS.map((s) => ({
    id: s.id,
    label: s.label,
    emoji: s.emoji,
    items: s.keys
      .filter((k) => !SKIP_IN_SECTIONS.has(k))
      .map((k) => {
        const d = display(doc, k);
        return d ? { key: k, label: FIELDS[k].label, value: d.text, legacy: d.legacy, long: FIELDS[k].paragraph } : null;
      })
      .filter((x): x is NonNullable<typeof x> => Boolean(x)),
  })).filter((s) => s.items.length);
  // The bio leads the first section, which reads as "About me"
  const bio = display(doc, "bio");
  const bioItem = bio ? [{ key: "bio", label: "Bio", value: bio.text, legacy: bio.legacy, long: true }] : [];
  const basics = sections.find((s) => s.id === "basics");
  if (basics) Object.assign(basics, { label: "About me", emoji: "📖", items: [...bioItem, ...basics.items] });
  else if (bio) sections.unshift({ id: "basics", label: "About me", emoji: "📖", items: bioItem });
  const created = doc.created_at instanceof Date ? doc.created_at : null;
  return {
    id,
    name: String(display(doc, "name")?.text ?? who?.name ?? "Member"),
    discordName: who?.username ?? null,
    avatar: who?.avatar ?? null,
    age: web.hideAge && !opts.viewerIsOwner ? null : age,
    headline: web.headline || null,
    accent: accentFor(id, web.accent),
    photos,
    facts: FACT_KEYS.map((k) => ({ key: k, label: FIELDS[k].label, value: display(doc, k)?.text ?? "" })).filter((f) => f.value),
    sections,
    prompts: (doc.prompts ?? []) as Prompt[],
    fursonas: ((doc.fursonas ?? []) as (Fursona & { art_link?: string })[]).map((f) => ({
      name: String(f.name ?? "Fursona"),
      description: String(f.description ?? ""),
      art_links: (Array.isArray(f.art_links) && f.art_links.length ? f.art_links : f.art_link ? [f.art_link] : []).map(String).filter((l) => /^https?:\/\//.test(l) || l.startsWith("/api/dating/media/")),
    })),
    lookingFor: {
      open: doc.is_looking === "Yes",
      genders: getList(doc, "looking_for_gender"),
      relTypes: getList(doc, "looking_for_relationship_type"),
      ages: isFilled(doc.looking_for_min_age) || isFilled(doc.looking_for_max_age) ? `${doc.looking_for_min_age ?? 18}–${doc.looking_for_max_age ?? 99}` : null,
    },
    lastActive: web.showOnline === false && !opts.viewerIsOwner ? null : doc.last_active instanceof Date ? doc.last_active.toISOString() : null,
    strength: profileStrength(doc).score,
    paused: web.paused === true,
    isNew: Boolean(created && Date.now() - created.getTime() < 14 * 86_400_000),
  };
}

/** The editor's copy of your own profile: raw values per field, plus review info and strength tips. */
export function ownProfileData(doc: ProfileDoc | null) {
  if (!doc) return null;
  const values: Record<string, unknown> = {};
  for (const key of Object.keys(FIELDS)) {
    values[key] = FIELDS[key].kind === "multi" ? getList(doc, key) : doc[key] ?? null;
  }
  const legacy: Record<string, string> = {};
  for (const [k, v] of Object.entries((doc.legacy ?? {}) as Record<string, unknown>)) if (isFilled(v) && FIELDS[k]) legacy[k] = String(v).slice(0, 300);
  return {
    values,
    legacy,
    review: reviewFields(doc),
    reviewConfirmed: doc.review_confirmed !== false,
    prompts: (doc.prompts ?? []) as Prompt[],
    fursonas: ((doc.fursonas ?? []) as (Fursona & { art_link?: string })[]).map((f) => ({ name: String(f.name ?? ""), description: String(f.description ?? ""), art_links: Array.isArray(f.art_links) && f.art_links.length ? f.art_links.map(String) : f.art_link ? [String(f.art_link)] : [] })),
    photos: ((doc.photos ?? []) as Photo[]).map((p) => ({ ...p, url: photoUrl(p) })),
    // The color they see in the editor is the one others see (picked, or derived from their id)
    web: { ...((doc.web ?? {}) as WebPrefs), accent: accentFor(String(doc._id), ((doc.web ?? {}) as WebPrefs).accent) },
    strength: profileStrength(doc),
    createdOn: String(doc.created_on ?? "discord"),
  };
}

export async function deleteProfile(discordId: string) {
  const c = await datingCols();
  const id = toLong(discordId);
  await Promise.all([
    c.profiles.deleteOne({ _id: id } as never),
    c.likes.deleteOne({ _id: id } as never),
    c.likes.updateMany({}, { $pull: { likes: { liker_id: id } } } as never),
    c.passes.deleteOne({ _id: id } as never),
    c.matches.deleteMany({ users: id } as never),
    c.vectors.deleteOne({ _id: id } as never),
  ]);
}

/** Short plain-text preview of a bio, for cards. */
export const bioPreview = (doc: ProfileDoc, max = 160) => {
  const t = newsPlainText(String(display(doc, "bio")?.text ?? ""));
  return t.length > max ? `${t.slice(0, max).replace(/\s+\S*$/, "")}…` : t;
};
