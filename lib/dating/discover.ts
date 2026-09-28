// Discover (one great match at a time), Browse (everyone, with filters and sorting), profile pages
// and the hourly featured draw. All work off the cached pool (lib/dating/pool.ts).

import { ObjectId } from "mongodb";
import { getPresenceCollection, getUsersCollection } from "../mongodb";
import { blockedIds } from "./db";
import { MIN_SCORE_SHOWN, blockedReason, compatibility, type Compat } from "./matching";
import { datingPool } from "./pool";
import { bigAvatar, cleanMentions } from "./text";
import { bioPreview, photoUrl, type Photo, type WebPrefs } from "./profiles";
import { PROMPTS, accentFor, display, getList, isFilled, type ProfileDoc } from "./schema";
import { extractPhrases } from "./matching";
import { friendSkipIds, friendsOf, likedIds, passedIds } from "./social";
import { getSettings } from "./settings";

export type Card = {
  id: string;
  name: string;
  age: number | null;
  headline: string | null;
  photo: string | null;
  photoCount: number;
  /** Framing of their first photo (null for avatars/art) */
  photoCrop: { x: number; y: number; z: number } | null;
  accent: string;
  location: string | null;
  gender: string | null;
  pronouns: string | null;
  lookingFor: string | null;
  bio: string;
  score: number | null;
  tier: string | null;
  emoji: string | null;
  shared: string[];
  datingFit: boolean;
  lastActive: string | null;
  isNew: boolean;
  liked: boolean;
  /** Still in the Discord server (people who left keep their profiles). */
  inServer: boolean;
  openToDating: boolean;
  /** Their Discord @name */
  username: string | null;
  partnered: boolean;
  myPartner: boolean;
  /** On the site right now (only filled in where asked for, and only if their settings allow) */
  online?: boolean;
};

type Pool = Awaited<ReturnType<typeof datingPool>>;

function card(doc: ProfileDoc, compat: Compat | null, liked: boolean, pool: Pool, me?: string): Card {
  const id = String(doc._id);
  const who = pool.who.get(id);
  const web = (doc.web ?? {}) as WebPrefs;
  const photos = (doc.photos ?? []) as Photo[];
  const art = ((doc.fursonas ?? []) as { art_links?: string[]; art_link?: string }[]).flatMap((f) => f.art_links ?? (f.art_link ? [f.art_link] : [])).map(String);
  // Uploaded art is reliable; outside links (often dead image hosts) come after their Discord avatar
  const uploadedArt = art.find((l) => l.startsWith("/api/dating/media/"));
  const linkedArt = art.find((l) => /^https:\/\/.+\.(png|jpe?g|gif|webp)(\?|$)/i.test(l));
  const created = doc.created_at instanceof Date ? doc.created_at : null;
  return {
    id: String(doc._id),
    name: String(display(doc, "name")?.text ?? "Member"),
    age: web.hideAge ? null : typeof doc.age === "number" ? doc.age : Number(doc.age) || null,
    headline: web.headline || null,
    // Their first photo, else fursona art, else their Discord avatar
    photo: photos[0] ? photoUrl(photos[0]) : uploadedArt ?? bigAvatar(who?.avatar, 512) ?? linkedArt ?? null,
    photoCount: photos.length,
    photoCrop: photos[0]?.crop ?? null,
    accent: accentFor(String(doc._id), web.accent),
    location: display(doc, "location")?.text ?? null,
    gender: display(doc, "gender")?.text ?? null,
    pronouns: display(doc, "pronouns")?.text ?? null,
    lookingFor: getList(doc, "looking_for_relationship_type").join(", ") || null,
    bio: cleanMentions(bioPreview(doc), pool.names),
    score: compat?.score ?? null,
    tier: compat?.tier ?? null,
    emoji: compat?.emoji ?? null,
    shared: (compat?.pairs ?? []).slice(0, 3).map((p) => (p.a === p.b ? p.a : `${p.a} ↔ ${p.b}`)),
    datingFit: Boolean(compat && !compat.blocked),
    lastActive: web.showOnline === false ? null : doc.last_active instanceof Date ? doc.last_active.toISOString() : null,
    isNew: Boolean(created && Date.now() - created.getTime() < 14 * 86_400_000),
    liked,
    inServer: who ? who.inServer : true,
    openToDating: doc.is_looking === "Yes",
    username: who?.username ?? null,
    // They've linked a partner (hidden if they chose not to show partners)
    partnered: (pool.partners.get(id)?.size ?? 0) > 0 && pool.settings.get(id)?.showPartners !== false,
    myPartner: Boolean(me && pool.partners.get(me)?.has(id)),
  };
}

async function candidates(me: string) {
  const [pool, blocked, settings] = await Promise.all([datingPool(), blockedIds(me), getSettings(me)]);
  const mine = pool.profiles.get(me) ?? null;
  const others = Array.from(pool.profiles.values()).filter((p) => {
    const id = String(p._id);
    if (id === me || blocked.has(id)) return false;
    // Paused profiles are hidden; members who left the server still show (with a badge)
    if (((p.web ?? {}) as WebPrefs).paused) return false;
    // Members who left the server show unless you turned that off in Settings
    if (!settings.showLeft && pool.inServer && !pool.inServer.has(id)) return false;
    return true;
  });
  const side = (d: ProfileDoc) => ({ doc: d, vec: pool.vectors.get(String(d._id)) ?? null });
  return { pool, mine, others, side, settings };
}

/** The Discover queue: dating matches you haven't liked or passed, best first. */
export async function discoverQueue(me: string, limit = 20) {
  const { pool, mine, others, side, settings } = await candidates(me);
  if (!mine) return { needsProfile: true as const, cards: [] as Card[] };
  if (mine.is_looking !== "Yes") return { notLooking: true as const, cards: [] as Card[] };
  const [liked, passed] = await Promise.all([likedIds(me), passedIds(me)]);
  const ranked = others
    .filter((o) => !liked.has(String(o._id)) && !passed.has(String(o._id)) && !blockedReason(mine, o))
    .map((o) => ({ o, c: compatibility(side(mine), side(o)) }))
    .filter((x) => x.c.score >= Math.max(MIN_SCORE_SHOWN, settings.discoverMinScore))
    .sort((a, b) => b.c.score - a.c.score);
  return { cards: ranked.slice(0, limit).map((x) => card(x.o, x.c, false, pool, me)), total: ranked.length };
}

/** Discover → Friends: people you'd get along with (dating preferences don't matter), best first. */
export async function friendQueue(me: string, limit = 20) {
  const { pool, mine, others, side } = await candidates(me);
  if (!mine) return { needsProfile: true as const, cards: [] as Card[] };
  const [friends, skipped] = await Promise.all([friendsOf(me), friendSkipIds(me)]);
  const known = new Set(friends.map((f) => f.id));
  const ranked = others
    .filter((o) => !known.has(String(o._id)) && !skipped.has(String(o._id)))
    .map((o) => ({ o, c: compatibility(side(mine), side(o)) }))
    .sort((a, b) => b.c.score - a.c.score);
  return { cards: ranked.slice(0, limit).map((x) => card(x.o, x.c, false, pool, me)), total: ranked.length };
}

export type BrowseQuery = {
  q?: string;
  genders?: string[];
  ageMin?: number;
  ageMax?: number;
  datingOnly?: boolean;
  photosOnly?: boolean;
  activeDays?: number;
  newOnly?: boolean;
  lookingFor?: string[];
  open?: "dating" | "friends";
  inServer?: boolean;
  sort?: "best" | "active" | "new" | "age-asc" | "age-desc" | "name";
  page?: number;
};

/** Everyone you can see, with filters and sorting (friends-only profiles included unless datingOnly). */
export async function browse(me: string, query: BrowseQuery) {
  const { pool, mine, others, side, settings } = await candidates(me);
  const liked = await likedIds(me);
  const q = (query.q ?? "").trim().toLowerCase();
  const rows = others
    .filter((o) => {
      const age = typeof o.age === "number" ? o.age : Number(o.age) || null;
      if (query.genders?.length && !query.genders.includes(String(o.gender ?? ""))) return false;
      if (query.ageMin && (!age || age < query.ageMin)) return false;
      if (query.ageMax && (!age || age > query.ageMax)) return false;
      if (query.photosOnly && !((o.photos ?? []) as unknown[]).length) return false;
      if (query.newOnly && !(o.created_at instanceof Date && Date.now() - o.created_at.getTime() < 14 * 86_400_000)) return false;
      if (query.activeDays && !(o.last_active instanceof Date && Date.now() - o.last_active.getTime() < query.activeDays * 86_400_000)) return false;
      if (query.open === "dating" && o.is_looking !== "Yes") return false;
      if (query.open === "friends" && o.is_looking === "Yes") return false;
      if (query.inServer && pool.inServer && !pool.inServer.has(String(o._id))) return false;
      if (query.lookingFor?.length && !getList(o, "looking_for_relationship_type").some((t) => query.lookingFor!.includes(t))) return false;
      if (q) {
        const hay = ["name", "bio", "location", "likes", "hobbies_interests", "favorite_games", "fun_fact"].map((k) => String(o[k] ?? "")).join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    })
    .map((o) => {
      const c = mine ? compatibility(side(mine), side(o)) : null;
      return { o, c };
    })
    .filter((x) => !query.datingOnly || (x.c && !x.c.blocked));
  const time = (d: unknown) => (d instanceof Date ? d.getTime() : 0);
  const ageOf = (o: ProfileDoc) => (typeof o.age === "number" ? o.age : Number(o.age) || 0);
  const sort = query.sort ?? (mine ? settings.browseSort : "active");
  rows.sort((a, b) => {
    switch (sort) {
      case "active":
        return time(b.o.last_active) - time(a.o.last_active);
      case "new":
        return time(b.o.created_at) - time(a.o.created_at);
      case "age-asc":
        return ageOf(a.o) - ageOf(b.o);
      case "age-desc":
        return ageOf(b.o) - ageOf(a.o);
      case "name":
        return String(a.o.name ?? "").localeCompare(String(b.o.name ?? ""));
      default:
        // Dating fits first, then by score
        return Number(Boolean(b.c && !b.c.blocked)) - Number(Boolean(a.c && !a.c.blocked)) || (b.c?.score ?? 0) - (a.c?.score ?? 0);
    }
  });
  const page = Math.max(0, query.page ?? 0);
  const size = 24;
  return { total: rows.length, page, pages: Math.ceil(rows.length / size), cards: rows.slice(page * size, page * size + size).map((x) => card(x.o, x.c, liked.has(String(x.o._id)), pool, me)) };
}

/** Cards for a list of ids (likes, matches, friends...), in the given order. `online` also works
 *  out who's on the site right now (respecting their "last active" and "Online now" settings). */
export async function cardsFor(me: string, ids: string[], opts: { online?: boolean } = {}) {
  const { pool, mine, side } = await candidates(me);
  const [liked, onlineIds] = await Promise.all([likedIds(me), opts.online ? onlineDiscordIds().catch(() => new Set<string>()) : Promise.resolve(null)]);
  return ids
    .map((id) => pool.profiles.get(id))
    .filter((d): d is ProfileDoc => Boolean(d))
    .map((d) => {
      const c = card(d, mine ? compatibility(side(mine), side(d)) : null, liked.has(String(d._id)), pool, me);
      if (onlineIds) {
        const id = String(d._id);
        const visible = ((d.web ?? {}) as WebPrefs).showOnline !== false && pool.settings.get(id)?.showInOnline !== false;
        c.online = visible && (onlineIds.has(id) || (d.last_active instanceof Date && Date.now() - d.last_active.getTime() < 5 * 60_000));
      }
      return c;
    });
}

/** Compatibility of one member from my point of view (for their profile page). */
export async function compatWith(me: string, other: string) {
  const pool = await datingPool();
  const mine = pool.profiles.get(me);
  const theirs = pool.profiles.get(other);
  if (!mine || !theirs) return null;
  return compatibility({ doc: mine, vec: pool.vectors.get(me) ?? null }, { doc: theirs, vec: pool.vectors.get(other) ?? null });
}

// ---------- Featured this hour ----------
const BOOSTER_WEIGHT = 2;
const LEFT_WEIGHT = 0.25;
function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The featured member for an hour (same for everyone), weighted by profile_weight like the bot's draw. */
export async function featured(hoursAgo = 0) {
  const pool = await datingPool();
  const hour = Math.floor(Date.now() / 3_600_000) - hoursAgo;
  const eligible = Array.from(pool.profiles.values())
    .filter((p) => p.is_looking === "Yes" && !((p.web ?? {}) as WebPrefs).paused && pool.settings.get(String(p._id))?.featured !== false && isFilled(p.bio))
    .sort((a, b) => String(a._id).localeCompare(String(b._id)));
  if (!eligible.length) return null;
  // Weight: the store's Profile Booster (profile_weight), doubled for server boosters, and a much
  // smaller chance for members who left the server
  const weightOf = (p: ProfileDoc) => {
    const id = String(p._id);
    const left = pool.inServer ? !pool.inServer.has(id) : pool.who.get(id)?.inServer === false;
    return Math.max(0.1, Number(p.profile_weight ?? 1)) * (pool.who.get(id)?.boosting ? BOOSTER_WEIGHT : 1) * (left ? LEFT_WEIGHT : 1);
  };
  const weights = eligible.map(weightOf);
  const total = weights.reduce((a, b) => a + b, 0);
  let r = seeded(hour * 2654435761)() * total;
  let pick = eligible[0];
  for (let i = 0; i < eligible.length; i++) {
    r -= weights[i];
    if (r <= 0) {
      pick = eligible[i];
      break;
    }
  }
  const weight = weightOf(pick);
  return { hour, until: new Date((hour + 1) * 3_600_000).toISOString(), card: card(pick, null, false, pool), pool: eligible.length, chance: weight / total };
}

// ---------- Home widgets ----------
const ONLINE_WINDOW_MS = 2 * 60_000;

/** Discord ids of signed-in members with a website tab open right now. */
async function onlineDiscordIds(): Promise<Set<string>> {
  const presence = await getPresenceCollection();
  const userIds = (await presence.distinct("userId", { lastSeen: { $gte: new Date(Date.now() - ONLINE_WINDOW_MS) }, userId: { $ne: null } } as never)).map(String).filter((id) => ObjectId.isValid(id));
  if (!userIds.length) return new Set();
  const users = await (await getUsersCollection()).find({ _id: { $in: userIds.map((id) => new ObjectId(id)) } }, { projection: { discordId: 1 } }).toArray();
  return new Set(users.map((u) => String(u.discordId ?? "")).filter(Boolean));
}
const PROMPT_EPOCH = Date.UTC(2026, 0, 1);

/** Everything the Dating home shows besides the featured draw: community pulse, new and active
 *  members, your top matches, popular interests and today's prompt spotlight. */
export async function homeWidgets(me: string) {
  const { pool, mine, others, side } = await candidates(me);
  const liked = await likedIds(me);
  const now = Date.now();
  const time = (d: unknown) => (d instanceof Date ? d.getTime() : 0);
  const cardOf = (d: ProfileDoc) => card(d, mine ? compatibility(side(mine), side(d)) : null, liked.has(String(d._id)), pool, me);

  // Online now: on the website this minute (live tab presence) or active in Dating in the last few
  // minutes. Members who hide their activity never show.
  const onlineIds = await onlineDiscordIds().catch(() => new Set<string>());
  const online = others
    .filter((o) => ((o.web ?? {}) as WebPrefs).showOnline !== false && pool.settings.get(String(o._id))?.showInOnline !== false && (onlineIds.has(String(o._id)) || now - time(o.last_active) < 5 * 60_000))
    .sort((a, b) => time(b.last_active) - time(a.last_active))
    .slice(0, 24)
    .map((o) => ({ ...cardOf(o), lastActive: new Date().toISOString() }));

  const newest = [...others].sort((a, b) => time(b.created_at) - time(a.created_at)).slice(0, 8).map(cardOf);
  const active = others
    .filter((o) => ((o.web ?? {}) as WebPrefs).showOnline !== false && now - time(o.last_active) < 24 * 3_600_000)
    .sort((a, b) => time(b.last_active) - time(a.last_active))
    .slice(0, 10)
    .map(cardOf);

  // Your best matches (dating fits if you're looking, otherwise people you'd get along with)
  let top: Card[] = [];
  if (mine) {
    const looking = mine.is_looking === "Yes";
    top = others
      .map((o) => ({ o, c: compatibility(side(mine), side(o)) }))
      .filter((x) => !looking || !x.c.blocked)
      .sort((a, b) => b.c.score - a.c.score)
      .slice(0, 6)
      .map((x) => card(x.o, x.c, liked.has(String(x.o._id)), pool, me));
  }

  // Interests lots of members share
  const counts = new Map<string, number>();
  for (const p of Array.from(pool.profiles.values())) {
    const seen = new Set<string>();
    for (const ph of extractPhrases(p.hobbies_interests, p.likes, p.favorite_games)) {
      const key = ph;
      if (key.length > 2 && key.length <= 24 && !seen.has(key)) {
        seen.add(key);
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }
  }
  const mineSet = new Set(mine ? extractPhrases(mine.hobbies_interests, mine.likes, mine.favorite_games) : []);
  const interests = Array.from(counts.entries())
    .filter(([, n]) => n >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 18)
    .map(([name, n]) => ({ name, count: n, mine: mineSet.has(name) }));

  // Prompt of the day, with a few members' answers
  const day = Math.floor((now - PROMPT_EPOCH) / 86_400_000);
  let prompt = PROMPTS[((day % PROMPTS.length) + PROMPTS.length) % PROMPTS.length];
  let answers = others.filter((o) => ((o.prompts ?? []) as { q: string }[]).some((x) => x.q === prompt));
  if (!answers.length) {
    // Fall back to whichever prompt has answers
    const any = others.find((o) => ((o.prompts ?? []) as unknown[]).length);
    if (any) {
      prompt = ((any.prompts ?? []) as { q: string }[])[0].q;
      answers = others.filter((o) => ((o.prompts ?? []) as { q: string }[]).some((x) => x.q === prompt));
    }
  }
  const spotlight = {
    prompt,
    answers: answers.slice(0, 3).map((o) => ({ card: cardOf(o), answer: cleanMentions(((o.prompts ?? []) as { q: string; a: string }[]).find((x) => x.q === prompt)?.a ?? "", pool.names) })),
    mineAnswered: Boolean(mine && ((mine.prompts ?? []) as { q: string }[]).some((x) => x.q === prompt)),
  };

  const all = Array.from(pool.profiles.values());
  const week = now - 7 * 86_400_000;
  const community = {
    profiles: all.length,
    openToDating: all.filter((p) => p.is_looking === "Yes").length,
    friendsOnly: all.filter((p) => p.is_looking !== "Yes").length,
    newThisWeek: all.filter((p) => time(p.created_at) > week).length,
    activeToday: all.filter((p) => now - time(p.last_active) < 86_400_000).length,
    withPhotos: all.filter((p) => ((p.photos ?? []) as unknown[]).length).length,
  };
  return { newest, active, online, top, interests, spotlight, community, looking: mine?.is_looking === "Yes" };
}
