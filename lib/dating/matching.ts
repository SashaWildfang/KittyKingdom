// The matching engine, ported from the dating bot (dating/core/matching.py) so scores are the same:
// 1. Hard filters (both ways): open to dating, target genders, age ranges, relationship types, positions.
// 2. Soft score 0-100 from weighted parts (interests, lifestyle, logistics, habits, independence,
//    completeness, recent activity); unknown parts are skipped, not guessed.
// 3. Conflicts (dislikes vs their likes, habits vs tolerance, different plans) cost points.
// Interest similarity uses the AI vectors the main bot stores in dating_vectors (Main_Bot
// events/social_vectors.py, model2vec); if a profile has none yet, a keyword fallback kicks in.

import { ALIASES, CONFLICT_PENALTY, FALLBACK_STARTERS, FILLER_SOURCE, FUTURE, HABIT_FIT, MAX_CONFLICT_PENALTY, MIN_SCORE_SHOWN, SATISFIES, SLEEP, SPLIT_SOURCE, STARTERS, STOP_WORDS, TAGS, TIERS, WEIGHTS } from "./match-data";
import { ANY, EVERYONE, FIELDS, asInt, getList, isFilled, profileStrength, utcOffset, type ProfileDoc } from "./schema";

// ---------- Phrases ----------
const FILLER = new RegExp(FILLER_SOURCE, "g");
const SPLIT = new RegExp(SPLIT_SOURCE);

export function extractPhrases(...texts: unknown[]): string[] {
  const out: string[] = [];
  for (const text of texts) {
    if (!text) continue;
    for (const part of String(text).toLowerCase().split(SPLIT)) {
      let p = (part ?? "").replace(FILLER, " ");
      p = p.replace(/[^a-z0-9' ]/g, " ").replace(/\s+/g, " ").trim();
      if (p.length > 2 && p.length <= 40 && !out.includes(p)) out.push(p);
    }
  }
  return out;
}

const canon = (p: string) => ALIASES[p] ?? p;
export const expand = (p: string) => {
  const c = canon(p);
  return TAGS[c] ? `${c} ${TAGS[c]}` : c;
};

const STOP = new Set(STOP_WORDS);
const stem = (w: string) => {
  for (const s of ["ing", "ers", "er", "es", "s"]) if (w.length > 4 && w.endsWith(s)) return w.slice(0, -s.length);
  return w;
};
export function keywordSimilarity(a: string, b: string) {
  const wa = new Set((a.toLowerCase().match(/[a-z0-9']+/g) ?? []).filter((w) => !STOP.has(w)).map(stem));
  const wb = new Set((b.toLowerCase().match(/[a-z0-9']+/g) ?? []).filter((w) => !STOP.has(w)).map(stem));
  if (!wa.size || !wb.size) return 0;
  let common = 0;
  wa.forEach((w) => wb.has(w) && common++);
  return (common / Math.min(wa.size, wb.size)) * 0.8;
}

// ---------- AI vectors ----------
/** One profile's vectors from the bot (int8-quantized unit vectors, base64). */
export type Vectors = { interests: Map<string, Float32Array>; avoid: Map<string, Float32Array>; bio: Float32Array | null; location: Float32Array | null };

export function decodeVector(b64: unknown): Float32Array | null {
  if (typeof b64 !== "string" || !b64) return null;
  const bytes = Buffer.from(b64, "base64");
  const v = new Float32Array(bytes.length);
  let norm = 0;
  for (let i = 0; i < bytes.length; i++) {
    const x = (bytes[i] << 24) >> 24; // int8
    v[i] = x;
    norm += x * x;
  }
  norm = Math.sqrt(norm) || 1;
  for (let i = 0; i < v.length; i++) v[i] /= norm;
  return v;
}

const dot = (a: Float32Array, b: Float32Array) => {
  let s = 0;
  for (let i = 0; i < a.length && i < b.length; i++) s += a[i] * b[i];
  return s;
};

type Side = { doc: ProfileDoc; vec: Vectors | null };

function bestPairs(pa: string[], pb: string[], va: Map<string, Float32Array> | null, vb: Map<string, Float32Array> | null, ai: boolean): [string, string, number][] {
  if (!pa.length || !pb.length) return [];
  return pa.map((a) => {
    let best: [string, number] = [pb[0], -1];
    for (const b of pb) {
      let s: number;
      if (canon(a) === canon(b)) s = 1;
      else if (ai && va?.get(a) && vb?.get(b)) s = dot(va.get(a)!, vb.get(b)!);
      else s = keywordSimilarity(expand(a), expand(b));
      if (s > best[1]) best = [b, s];
    }
    return [a, best[0], best[1]];
  });
}

const interestPhrases = (s: Side) => (s.vec && s.vec.interests.size ? Array.from(s.vec.interests.keys()) : extractPhrases(s.doc.likes, s.doc.hobbies_interests, s.doc.favorite_games));
const avoidPhrases = (s: Side) => (s.vec && s.vec.avoid.size ? Array.from(s.vec.avoid.keys()) : extractPhrases(s.doc.dislikes, s.doc.dealbreakers, s.doc.red_flags));

// ---------- Hard filters ----------
const isLooking = (p: ProfileDoc) => p.is_looking === "Yes";
function wantsGender(viewer: ProfileDoc, other: ProfileDoc) {
  const targets = getList(viewer, "looking_for_gender");
  const g = other.gender;
  return !targets.length || !g || targets.includes(EVERYONE) || targets.includes(String(g));
}
function ageOk(viewer: ProfileDoc, other: ProfileDoc) {
  const age = asInt(other.age);
  if (!age) return true;
  return (asInt(viewer.looking_for_min_age) ?? 18) <= age && age <= (asInt(viewer.looking_for_max_age) ?? 99);
}
const NON_MONO = new Set(["Polyamorous", "Open", "Casual"]);
function relTypesOk(a: ProfileDoc, b: ProfileDoc) {
  const ta = new Set(getList(a, "looking_for_relationship_type"));
  const tb = new Set(getList(b, "looking_for_relationship_type"));
  if (!ta.size || !tb.size || ta.has(ANY) || tb.has(ANY) || Array.from(ta).some((t) => tb.has(t))) return true;
  if (ta.has("Friends first") || tb.has("Friends first")) return true;
  return Array.from(ta).some((t) => NON_MONO.has(t)) && Array.from(tb).some((t) => NON_MONO.has(t));
}
function positionOk(viewer: ProfileDoc, other: ProfileDoc) {
  const targets = getList(viewer, "looking_for_sexual_position");
  const pos = other.sexual_position ? String(other.sexual_position) : "";
  if (!targets.length || targets.includes(ANY) || !pos || pos === "Prefer not to say") return true;
  return targets.some((t) => (SATISFIES[t] ?? []).includes(pos));
}
function positionsOk(a: ProfileDoc, b: ProfileDoc) {
  if (!positionOk(a, b) || !positionOk(b, a)) return false;
  if (!getList(a, "looking_for_sexual_position").length && !getList(b, "looking_for_sexual_position").length) {
    if (a.sexual_position === b.sexual_position && (a.sexual_position === "Top" || a.sexual_position === "Bottom")) return false;
  }
  return true;
}
export function blockedReason(a: ProfileDoc, b: ProfileDoc): string | null {
  if (!isLooking(a) || !isLooking(b)) return "Not open to dating";
  if (!wantsGender(a, b) || !wantsGender(b, a)) return "Gender preferences don't match";
  if (!ageOk(a, b) || !ageOk(b, a)) return "Outside each other's age range";
  if (!relTypesOk(a, b)) return "Looking for different relationship types";
  if (!positionsOk(a, b)) return "Position preferences don't match";
  return null;
}

// ---------- Soft parts ----------
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const lookup = (table: [string, string, number][], a: string, b: string) => table.find(([x, y]) => (x === a && y === b) || (x === b && y === a))?.[2];

function interestsPart(A: Side, B: Side, ai: boolean): [number | null, [string, string, number][]] {
  const pa = interestPhrases(A);
  const pb = interestPhrases(B);
  const parts: number[] = [];
  const pairs: [string, string, number][] = [];
  if (pa.length && pb.length) {
    const ab = bestPairs(pa, pb, A.vec?.interests ?? null, B.vec?.interests ?? null, ai);
    const ba = bestPairs(pb, pa, B.vec?.interests ?? null, A.vec?.interests ?? null, ai);
    const avg = (ab.reduce((s, x) => s + x[2], 0) / ab.length + ba.reduce((s, x) => s + x[2], 0) / ba.length) / 2;
    const [lo, hi] = ai ? [0.15, 0.7] : [0, 0.6];
    parts.push(clamp01((avg - lo) / (hi - lo)));
    const seen = new Set<string>();
    for (const [x, y, s] of [...ab].sort((p, q) => q[2] - p[2])) {
      if (s >= (ai ? 0.6 : 0.5) && !seen.has(y)) {
        pairs.push([x, y, s]);
        seen.add(y);
      }
    }
  }
  if (isFilled(A.doc.bio) && isFilled(B.doc.bio)) {
    const sim = ai && A.vec?.bio && B.vec?.bio ? dot(A.vec.bio, B.vec.bio) : keywordSimilarity(String(A.doc.bio), String(B.doc.bio));
    const [lo, hi] = ai ? [0.3, 0.8] : [0, 0.5];
    parts.push(clamp01((sim - lo) / (hi - lo)));
  }
  if (!parts.length) return [null, []];
  return [parts.length === 2 ? parts[0] * 0.7 + parts[1] * 0.3 : parts[0], pairs.slice(0, 6)];
}

function ordinal(key: string, va: unknown, vb: unknown) {
  const vals = FIELDS[key].options.map((o) => o.value);
  const ia = vals.indexOf(String(va));
  const ib = vals.indexOf(String(vb));
  if (ia < 0 || ib < 0) return null;
  return 1 - Math.abs(ia - ib) / (vals.length - 1);
}

function lifestylePart(a: ProfileDoc, b: ProfileDoc): [number | null, string[], string[]] {
  const scores: number[] = [];
  const agree: string[] = [];
  const clash: string[] = [];
  const sa = a.sleep_schedule ? String(a.sleep_schedule) : "";
  const sb = b.sleep_schedule ? String(b.sleep_schedule) : "";
  if (sa && sb) {
    scores.push(sa === sb ? 1 : sa === "All over the place" || sb === "All over the place" ? 0.6 : lookup(SLEEP, sa, sb) ?? 0.5);
    if (sa === sb && (sa === "Night owl" || sa === "Early bird")) agree.push(`${sa === "Night owl" ? "🦉" : "🐦"} Both ${sa.toLowerCase()}s`);
  }
  const act = ordinal("activity_level", a.activity_level, b.activity_level);
  if (act !== null) {
    scores.push(act);
    if (act === 1) agree.push(`⚖️ Same activity level (${String(a.activity_level).toLowerCase()})`);
  }
  for (const [key, label] of [["want_kids", "kids"], ["marriage_goals", "marriage"]] as const) {
    const va = a[key] ? String(a[key]) : "";
    const vb = b[key] ? String(b[key]) : "";
    if (!va || !vb) continue;
    const s = va === vb ? 1 : lookup(FUTURE, va, vb) ?? 0.5;
    scores.push(s);
    if (s === 1 && (va === "Yes" || va === "No")) agree.push(`💍 Same answer on ${label} (${va})`);
    else if (s === 0) clash.push(`Different plans for ${label}: you said ${va}, they said ${vb}`);
  }
  const rel = ordinal("religion_important", a.religion_important, b.religion_important);
  if (rel !== null) scores.push(rel);
  return [scores.length ? scores.reduce((x, y) => x + y) / scores.length : null, agree, clash];
}

const HABITS: [string, string, string, string][] = [
  ["smoking", "smoking_ok", "smokes", "smoke"],
  ["drinking", "drinking_ok", "drinks", "drink"],
  ["weed", "substance_ok", "uses_weed", "use weed"],
];
function vicesPart(a: ProfileDoc, b: ProfileDoc): [number | null, string[]] {
  const scores: number[] = [];
  const clash: string[] = [];
  for (const [viewer, other, who] of [[a, b, "They"], [b, a, "You"]] as const) {
    for (const [name, tolKey, habitKey, verb] of HABITS) {
      const tol = viewer[tolKey] ? String(viewer[tolKey]) : "";
      const habit = other[habitKey] ? String(other[habitKey]) : "";
      if (!tol || !habit) continue;
      const fit = habit === "No" ? 1 : HABIT_FIT[name].find(([t, h]) => t === tol && h === habit)?.[2] ?? 1;
      scores.push(fit);
      if (fit === 0) clash.push(who === "They" ? `They ${verb}, and you said that's not OK for you` : `You ${verb}, and they said that's not OK for them`);
    }
  }
  return [scores.length ? scores.reduce((x, y) => x + y) / scores.length : null, clash];
}

function logisticsPart(A: Side, B: Side, ai: boolean): [number | null, string[], string[]] {
  const a = A.doc;
  const b = B.doc;
  const scores: number[] = [];
  const agree: string[] = [];
  const clash: string[] = [];
  const oa = utcOffset(a);
  const ob = utcOffset(b);
  const gap = oa !== null && ob !== null ? Math.abs(oa - ob) : null;
  if (gap !== null) {
    scores.push(1 - Math.min(gap, 12) / 12);
    if (gap === 0) agree.push("🕒 Same timezone");
    else if (gap <= 2) agree.push(`🕒 Only ${gap}h apart`);
  }
  let sameArea: boolean | null = null;
  if (isFilled(a.location) && isFilled(b.location)) {
    const sim = ai && A.vec?.location && B.vec?.location ? dot(A.vec.location, B.vec.location) : keywordSimilarity(String(a.location).toLowerCase(), String(b.location).toLowerCase());
    sameArea = sim >= (ai ? 0.75 : 0.6);
    if (sameArea) agree.push(`📍 Both in/near ${String(b.location).trim().slice(0, 40)}`);
  }
  for (const viewer of [a, b]) {
    const comfort = viewer.distance_comfort ? String(viewer.distance_comfort) : "";
    if (!comfort) continue;
    const near = sameArea !== null ? sameArea : gap !== null && gap <= 1;
    if (comfort === "Local only") {
      scores.push(near ? 1 : 0.1);
      if (!near && viewer === a) clash.push("You want someone local, and they may be far away");
    } else if (comfort === "Prefer local") scores.push(near ? 1 : 0.6);
    else scores.push(1);
  }
  if (a.willing_to_relocate === "Yes" || b.willing_to_relocate === "Yes") scores.push(1);
  return [scores.length ? scores.reduce((x, y) => x + y) / scores.length : null, agree, clash];
}

function independenceFit(viewer: ProfileDoc, other: ProfileDoc) {
  const want = viewer.partner_independence_level;
  const have = asInt(other.independence_level);
  if (want === "Doesn't matter") return 1;
  const w = asInt(want);
  if (w === null || have === null) return null;
  return 1 - Math.abs(w - have) / 9;
}

function recencyPart(p: ProfileDoc) {
  const last = p.last_active instanceof Date ? p.last_active : p.updated_at instanceof Date ? p.updated_at : null;
  if (!last) return null;
  const days = (Date.now() - last.getTime()) / 86_400_000;
  return days <= 7 ? 1 : days <= 30 ? 0.6 : 0.2;
}

function dislikeConflicts(A: Side, B: Side, ai: boolean) {
  const out: string[] = [];
  for (const [viewer, other, who] of [[A, B, "They"], [B, A, "You"]] as const) {
    const avoid = avoidPhrases(viewer);
    const enjoys = interestPhrases(other);
    for (const [bad, liked, s] of bestPairs(avoid, enjoys, viewer.vec?.avoid ?? null, other.vec?.interests ?? null, ai)) {
      if (s >= (ai ? 0.65 : 0.6)) out.push(who === "They" ? `They like ${liked}, which you listed as a dislike (${bad})` : `You like ${liked}, which they listed as a dislike (${bad})`);
    }
  }
  return out.slice(0, 4);
}

export type Compat = {
  score: number;
  tier: string;
  emoji: string;
  parts: Record<string, number | null>;
  pairs: { a: string; b: string }[];
  agreements: string[];
  conflicts: string[];
  blocked: string | null;
  starter: string;
  ai: boolean;
};

/** Compatibility of B from A's point of view (the score itself is symmetric). */
export function compatibility(A: Side, B: Side): Compat {
  const ai = Boolean(A.vec && B.vec);
  const [interests, pairs] = interestsPart(A, B, ai);
  const [lifestyle, agreeL, clashL] = lifestylePart(A.doc, B.doc);
  const [vices, clashV] = vicesPart(A.doc, B.doc);
  const [logistics, agreeG, clashG] = logisticsPart(A, B, ai);
  const ind = [independenceFit(A.doc, B.doc), independenceFit(B.doc, A.doc)].filter((x): x is number => x !== null);
  const parts: Record<string, number | null> = {
    interests,
    lifestyle,
    logistics,
    vices,
    independence: ind.length ? ind.reduce((x, y) => x + y) / ind.length : null,
    completeness: profileStrength(B.doc).score / 100,
    recency: recencyPart(B.doc),
  };
  let total = 0;
  let weighted = 0;
  for (const [k, v] of Object.entries(parts)) {
    if (v === null) continue;
    total += WEIGHTS[k];
    weighted += WEIGHTS[k] * v;
  }
  const base = total ? (weighted / total) * 100 : 50;
  const conflicts = [...dislikeConflicts(A, B, ai), ...clashV, ...clashL, ...clashG];
  const score = Math.max(1, Math.min(100, Math.round(base - Math.min(conflicts.length * CONFLICT_PENALTY, MAX_CONFLICT_PENALTY))));
  const [, tier, emoji] = TIERS.find(([cut]) => score >= cut) ?? TIERS[TIERS.length - 1];
  const pairList = pairs.map(([a, b]) => ({ a, b }));
  let starter: string;
  if (pairList.length) {
    const p = pairList[Math.floor(Math.random() * Math.min(3, pairList.length))];
    starter = STARTERS[Math.floor(Math.random() * STARTERS.length)].replace("{a}", p.a).replace("{b}", p.b).replace(/\*\*/g, "");
  } else if (isFilled(B.doc.fun_fact)) starter = `Ask them about their fun fact: "${String(B.doc.fun_fact).slice(0, 120)}"`;
  else starter = FALLBACK_STARTERS[Math.floor(Math.random() * FALLBACK_STARTERS.length)];
  return { score, tier, emoji, parts, pairs: pairList, agreements: [...agreeL, ...agreeG], conflicts, blocked: blockedReason(A.doc, B.doc), starter, ai };
}

export { MIN_SCORE_SHOWN };
