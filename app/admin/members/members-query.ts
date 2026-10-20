// The Discord Members tab's engine: filters, breakdowns and the plain-English question box. Everything runs
// in the browser on the snapshot from /api/admin/members, so answers are instant.

import type { MMMember, MMRole, MMSnapshot } from "../../../lib/members-manager";

export type Joined = "any" | "1" | "7" | "30" | "90" | "365" | "older";
export type TriState = "any" | "yes" | "no";
export type Filter = {
  /** Role ids: has every one of `all`, at least one of `any`, none of `none` */
  all: string[];
  any: string[];
  /** More "at least one of" groups (when a question combines two of them) */
  anyGroups?: string[][];
  none: string[];
  /** Category keys where the member has none of that category's roles (e.g. no gender role picked) */
  missing: string[];
  search: string;
  joined: Joined;
  levelMin: number | null;
  levelMax: number | null;
  messagesMin: number | null;
  account: "any" | "yes" | "verified" | "no";
  social: TriState;
  boosting: TriState;
  timedOut: TriState;
  bots: "humans" | "bots" | "all";
};

export const EMPTY: Filter = { all: [], any: [], none: [], missing: [], search: "", joined: "any", levelMin: null, levelMax: null, messagesMin: null, account: "any", social: "any", boosting: "any", timedOut: "any", bots: "humans" };

const DAY = 86_400_000;

export type Ctx = { snap: MMSnapshot; index: Map<string, number>; categoryRoles: Map<string, Set<number>> };

export function makeCtx(snap: MMSnapshot): Ctx {
  const index = new Map(snap.roles.map((r, i) => [r.id, i]));
  const categoryRoles = new Map(snap.categories.map((c) => [c.key, new Set(c.roleIds.map((id) => index.get(id)!).filter((i) => i !== undefined))]));
  return { snap, index, categoryRoles };
}

/** Members matching the filter. */
export function applyFilter(ctx: Ctx, f: Filter, now = Date.now()): MMMember[] {
  const ids = (list: string[]) => list.map((id) => ctx.index.get(id)).filter((i): i is number => i !== undefined);
  const all = ids(f.all);
  const any = ids(f.any);
  const anyGroups = (f.anyGroups ?? []).map(ids).filter((g) => g.length);
  const none = ids(f.none);
  const missing = f.missing.map((k) => ctx.categoryRoles.get(k)).filter((s): s is Set<number> => Boolean(s));
  const q = f.search.trim().toLowerCase();
  return ctx.snap.members.filter((m) => {
    if (f.bots === "humans" && m.bot) return false;
    if (f.bots === "bots" && !m.bot) return false;
    if (all.length || any.length || anyGroups.length || none.length || missing.length) {
      const has = new Set(m.r);
      if (all.some((i) => !has.has(i))) return false;
      if (any.length && !any.some((i) => has.has(i))) return false;
      if (anyGroups.some((g) => !g.some((i) => has.has(i)))) return false;
      if (none.some((i) => has.has(i))) return false;
      if (missing.some((set) => m.r.some((i) => set.has(i)))) return false;
    }
    if (q && !(m.name.toLowerCase().includes(q) || m.username.toLowerCase().includes(q) || m.id === q)) return false;
    if (f.joined !== "any") {
      const age = m.joinedAt ? now - m.joinedAt : Infinity;
      if (f.joined === "older" ? age < 365 * DAY : age > Number(f.joined) * DAY) return false;
    }
    if (f.levelMin !== null && (m.level ?? 0) < f.levelMin) return false;
    if (f.levelMax !== null && (m.level ?? 0) > f.levelMax) return false;
    if (f.messagesMin !== null && (m.messages ?? 0) < f.messagesMin) return false;
    if (f.account === "yes" && !m.account) return false;
    if (f.account === "verified" && m.account !== "verified") return false;
    if (f.account === "no" && m.account) return false;
    if (f.social !== "any" && m.social !== (f.social === "yes")) return false;
    if (f.boosting !== "any" && Boolean(m.boosting) !== (f.boosting === "yes")) return false;
    if (f.timedOut !== "any" && m.timedOut !== (f.timedOut === "yes")) return false;
    return true;
  });
}

export const filterIsEmpty = (f: Filter) => {
  const { anyGroups, ...rest } = f;
  return !(anyGroups ?? []).some((g) => g.length) && JSON.stringify({ ...rest, bots: "humans" }) === JSON.stringify(EMPTY);
};

// ---------- Breakdowns ----------

export type Dim = { kind: "category"; key: string } | { kind: "roles" } | { kind: "joinMonth" } | { kind: "level" } | { kind: "account" } | { kind: "accountAge" } | { kind: "messages" };
export type Bucket = { key: string; label: string; count: number; color?: string | null; roleId?: string };

const LEVEL_BANDS: [number, number, string][] = [[0, 0, "No level yet"], [1, 4, "1–4"], [5, 9, "5–9"], [10, 19, "10–19"], [20, 29, "20–29"], [30, 49, "30–49"], [50, Infinity, "50+"]];
const MSG_BANDS: [number, number, string][] = [[0, 0, "0"], [1, 99, "1–99"], [100, 999, "100–999"], [1000, 4999, "1K–5K"], [5000, 19999, "5K–20K"], [20000, Infinity, "20K+"]];
const AGE_BANDS: [number, number, string][] = [[0, 30, "Under 1 month"], [30, 182, "1–6 months"], [182, 365, "6–12 months"], [365, 730, "1–2 years"], [730, 1825, "2–5 years"], [1825, Infinity, "5+ years"]];

export function breakdown(ctx: Ctx, members: MMMember[], dim: Dim, now = Date.now()): { buckets: Bucket[]; none: number; multi: number } {
  const roles = ctx.snap.roles;
  if (dim.kind === "category" || dim.kind === "roles") {
    const set = dim.kind === "category" ? ctx.categoryRoles.get(dim.key) ?? new Set<number>() : null;
    const counts = new Map<number, number>();
    let none = 0;
    let multi = 0;
    for (const m of members) {
      const hit = set ? m.r.filter((i) => set.has(i)) : m.r;
      if (!hit.length) none++;
      if (hit.length > 1) multi++;
      for (const i of hit) counts.set(i, (counts.get(i) ?? 0) + 1);
    }
    const order = set ? Array.from(set) : Array.from(counts.keys());
    const buckets = order
      .map((i) => ({ key: roles[i].id, roleId: roles[i].id, label: roles[i].name, color: roles[i].color, count: counts.get(i) ?? 0 }))
      .filter((b) => dim.kind === "category" || b.count > 0)
      .sort((a, b) => b.count - a.count);
    return { buckets: dim.kind === "roles" ? buckets.slice(0, 40) : buckets, none, multi };
  }
  const bandOf = (bands: [number, number, string][], v: number) => bands.find(([a, b]) => v >= a && v <= b)?.[2] ?? bands[bands.length - 1][2];
  const counts = new Map<string, number>();
  const add = (k: string) => counts.set(k, (counts.get(k) ?? 0) + 1);
  let keys: string[] = [];
  if (dim.kind === "level") {
    keys = LEVEL_BANDS.map((b) => b[2]);
    members.forEach((m) => add(bandOf(LEVEL_BANDS, m.level ?? 0)));
  } else if (dim.kind === "messages") {
    keys = MSG_BANDS.map((b) => b[2]);
    members.forEach((m) => add(bandOf(MSG_BANDS, m.messages ?? 0)));
  } else if (dim.kind === "accountAge") {
    keys = AGE_BANDS.map((b) => b[2]);
    members.forEach((m) => add(bandOf(AGE_BANDS, (now - m.createdAt) / DAY)));
  } else if (dim.kind === "account") {
    keys = ["Website account (email confirmed)", "Website account (not confirmed)", "No website account"];
    members.forEach((m) => add(m.account === "verified" ? keys[0] : m.account ? keys[1] : keys[2]));
  } else {
    const fmt = (t: number) => new Date(t).toLocaleDateString("en-US", { month: "short", year: "numeric" });
    const sorted = members.filter((m) => m.joinedAt).sort((a, b) => a.joinedAt! - b.joinedAt!);
    sorted.forEach((m) => add(fmt(m.joinedAt!)));
    keys = Array.from(new Set(sorted.map((m) => fmt(m.joinedAt!))));
  }
  return { buckets: keys.map((k) => ({ key: k, label: k, count: counts.get(k) ?? 0 })), none: 0, multi: 0 };
}

/** Two role categories against each other: counts in each cell. */
export function crosstab(ctx: Ctx, members: MMMember[], rowKey: string, colKey: string) {
  const rows = Array.from(ctx.categoryRoles.get(rowKey) ?? []);
  const cols = Array.from(ctx.categoryRoles.get(colKey) ?? []);
  const cells = rows.map(() => cols.map(() => 0));
  const rowNone = cols.map(() => 0);
  const colNone = rows.map(() => 0);
  for (const m of members) {
    const has = new Set(m.r);
    const rHit = rows.map((r) => has.has(r));
    const cHit = cols.map((c) => has.has(c));
    rHit.forEach((rh, ri) => {
      if (!rh) return;
      if (!cHit.some(Boolean)) colNone[ri]++;
      cHit.forEach((ch, ci) => ch && cells[ri][ci]++);
    });
    if (!rHit.some(Boolean)) cHit.forEach((ch, ci) => ch && rowNone[ci]++);
  }
  return { rows: rows.map((i) => ctx.snap.roles[i]), cols: cols.map((i) => ctx.snap.roles[i]), cells, rowNone, colNone };
}

// ---------- The question box ----------

export type Parsed = {
  base: Filter;
  /** "How many of them are…" (null: the question is just a filter) */
  target: Filter | null;
  ratio: [Filter, Filter] | null;
  dim: Dim | null;
  /** Plain-English reading of the question, so it can be checked */
  reading: string[];
  unknown: string[];
};

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[\uD800-\uDFFF\u2600-\u27BF\uFE0F\u200D]/g, " ")
    .replace(/[()[\]{},.!?:;"“”'’]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

// Everyday words for roles (applied before matching role names)
const ALIASES: [RegExp, string][] = [
  [/\btrans (women|woman|girls?|females?)\b/g, "trans mtf"],
  [/\btrans (men|man|guys?|boys?|males?)\b/g, "trans ftm"],
  [/\b(mtf|ftm)\b/g, "trans $1"],
  [/\btrans trans\b/g, "trans"],
  [/\b(women|woman|girls?|ladies|lady|females)\b/g, "female"],
  [/\b(men|man|guys?|boys?|males|dudes?)\b/g, "male"],
  [/\b(enby|enbies|nb|non-binary|non binary)\b/g, "nonbinary"],
  [/\b(adults?|nsfw verified|18\+ members)\b/g, "18+ verified"],
  [/\bsingles?\b/g, "looking"],
  [/\bin a relationship\b/g, "taken"],
  [/\bgays\b/g, "gay"],
];

const CATEGORY_WORDS: [RegExp, string][] = [
  [/\bgenders?\b/, "Gender"],
  [/\bpronouns?\b/, "Pronouns"],
  [/\b(sexualit(y|ies)|orientations?)\b/, "Sexuality"],
  [/\brelationship status(es)?\b|\bstatus(es)?\b/, "Relationship_Status"],
  [/\brelationship types?\b/, "Relationship_Type"],
  [/\blooking for\b/, "Looking_For"],
  [/\bpositions?\b/, "Positions"],
  [/\b(locations?|regions?|countries|continents?|where)\b/, "Location"],
  [/\b(time ?zones?)\b/, "Timezone"],
  [/\bhobb(y|ies)\b/, "Hobbies"],
  [/\bpings?\b/, "Pings"],
  [/\bpreferences?\b/, "Preferences"],
];

const GENERIC = new Set(["member", "members", "people", "user", "users", "everyone"]);

type Hit = { start: number; end: number; roleId: string; name: string };

function roleVocab(roles: MMRole[]) {
  return roles
    .filter((r) => !r.managed)
    .map((r) => ({ id: r.id, name: r.name, words: norm(r.name).split(" ").filter(Boolean) }))
    .filter((r) => r.words.length)
    .sort((a, b) => b.words.length - a.words.length);
}

/** Finds role names in a run of words (longest names first, plurals allowed). */
function findRoles(words: string[], vocab: ReturnType<typeof roleVocab>): Hit[] {
  const hits: Hit[] = [];
  const used = new Array(words.length).fill(false);
  const eq = (a: string, b: string) => a === b || a === `${b}s` || a === `${b}es` || (b.endsWith("y") && a === `${b.slice(0, -1)}ies`);
  for (const r of vocab) {
    for (let i = 0; i + r.words.length <= words.length; i++) {
      if (used.slice(i, i + r.words.length).some(Boolean)) continue;
      if (r.words.every((w, j) => eq(words[i + j], w))) {
        // "members"/"people" in a question mean everyone, not the Member role (unless "member role" is written)
        if (r.words.length === 1 && GENERIC.has(r.words[0]) && words[i + 1] !== "role") continue;
        hits.push({ start: i, end: i + r.words.length, roleId: r.id, name: r.name });
        for (let j = i; j < i + r.words.length; j++) used[j] = true;
      }
    }
  }
  return hits.sort((a, b) => a.start - b.start);
}

const STOP = new Set("how many what percent percentage of the are is have has with who that do does in among members member people users server there a an and or role roles count number total than to ratio vs versus which also any all show me list breakdown break down split by distribution their them they ones out get give find".split(" "));

/** Turns one clause ("18+ verified males who aren't taken") into role filters and extra conditions. */
function clause(text: string, vocab: ReturnType<typeof roleVocab>, ctx: Ctx, reading: string[], unknown: string[]): Filter {
  const f: Filter = { ...EMPTY, all: [], any: [], none: [], missing: [] };
  let t = ` ${text} `;
  // Conditions that aren't roles
  const joined = /\bjoined (in )?(the )?(last|past) (\d+) (day|week|month|year)s?\b/.exec(t) ?? /\b(new|newest) members\b/.exec(t);
  if (joined) {
    const n = joined[4] ? Number(joined[4]) * ({ day: 1, week: 7, month: 30, year: 365 } as const)[joined[5] as "day"] : 7;
    f.joined = n <= 1 ? "1" : n <= 7 ? "7" : n <= 30 ? "30" : n <= 90 ? "90" : "365";
    reading.push(`joined in the last ${f.joined === "1" ? "day" : `${f.joined} days`}`);
    t = t.replace(joined[0], " ");
  }
  const lvl = /\b(level|lvl) (\d+)\s*(\+|or (more|higher|above)\b)|\b(above|over) level (\d+)\b|\blevel (\d+) and up\b/.exec(t);
  if (lvl) {
    f.levelMin = Number(lvl[2] ?? lvl[6] ?? lvl[7]) + (lvl[5] ? 1 : 0);
    reading.push(`level ${f.levelMin}+`);
    t = t.replace(lvl[0], " ");
  }
  if (/\b(not boosting|non boosters?|aren't boosting)\b/.test(t)) {
    f.boosting = "no";
    reading.push("not boosting");
    t = t.replace(/\b(not boosting|non boosters?|aren't boosting)\b/, " ");
  } else if (/\bboost(ers?|ing)\b/.test(t)) {
    f.boosting = "yes";
    reading.push("boosting the server");
    t = t.replace(/\bboost(ers?|ing)\b/, " ");
  }
  if (/\b(without|no|don't have an?|do not have an?) (a )?website accounts?\b/.test(t)) {
    f.account = "no";
    reading.push("no website account");
    t = t.replace(/\b(without|no|don't have an?|do not have an?) (a )?website accounts?\b/, " ");
  } else if (/\bwebsite accounts?\b/.test(t)) {
    f.account = "yes";
    reading.push("have a website account");
    t = t.replace(/\b(with |have |has )?(a )?website accounts?\b/, " ");
  }
  if (/\b(without|no) (a )?social profiles?\b/.test(t)) {
    f.social = "no";
    reading.push("no Social profile");
    t = t.replace(/\b(without|no) (a )?social profiles?\b/, " ");
  } else if (/\bsocial profiles?\b/.test(t)) {
    f.social = "yes";
    reading.push("have a Social profile");
    t = t.replace(/\b(with |have |has )?(a )?social profiles?\b/, " ");
  }
  if (/\b(timed out|in timeout|muted)\b/.test(t)) {
    f.timedOut = "yes";
    reading.push("timed out right now");
    t = t.replace(/\b(timed out|in timeout|muted)\b/, " ");
  }
  if (/\bbots?\b/.test(t)) {
    f.bots = "bots";
    reading.push("bots");
    t = t.replace(/\bbots?\b/, " ");
  }
  // "no gender role", "without a pronoun role"
  for (const [re, key] of CATEGORY_WORDS) {
    const m = new RegExp(`\\b(no|without( an?)?|haven't picked( an?)?|missing( an?)?) (?:${re.source})( roles?)?\\b`).exec(t);
    if (m && ctx.categoryRoles.has(key)) {
      f.missing.push(key);
      reading.push(`no ${ctx.snap.categories.find((c) => c.key === key)?.title.toLowerCase()} role`);
      t = t.replace(m[0], " ");
    }
  }

  const words = norm(t).split(" ").filter(Boolean);
  const hits = findRoles(words, vocab);
  const NEG = new Set(["not", "without", "no", "arent", "aren't", "isnt", "isn't", "dont", "don't", "except", "excluding", "lacking"]);
  let prevEnd = 0;
  let lastGroup: "all" | "any" | "none" = "all";
  hits.forEach((h, k) => {
    const between = words.slice(prevEnd, h.start);
    const negated = between.some((w) => NEG.has(w)) || (between.length === 0 && k > 0 && lastGroup === "none");
    const orJoin = k > 0 && between.includes("or");
    let group: "all" | "any" | "none" = negated ? "none" : orJoin ? "any" : "all";
    if (group === "any" && lastGroup === "all" && f.all.length) {
      // "male or female": the role before "or" belongs to the same any-group
      const prev = f.all.pop()!;
      f.any.push(prev);
    }
    if (group === "none" && orJoin) group = "none";
    f[group].push(h.roleId);
    lastGroup = group;
    prevEnd = h.end;
  });
  const covered = new Set(hits.flatMap((h) => Array.from({ length: h.end - h.start }, (_, i) => h.start + i)));
  words.forEach((w, i) => {
    if (!covered.has(i) && !STOP.has(w) && !NEG.has(w) && w.length > 2 && !/^\d+$/.test(w)) unknown.push(w);
  });
  return f;
}

const roleName = (ctx: Ctx, id: string) => ctx.snap.roles[ctx.index.get(id) ?? -1]?.name ?? id;

export function describe(ctx: Ctx, f: Filter) {
  const parts: string[] = [];
  if (f.all.length) parts.push(f.all.map((id) => roleName(ctx, id)).join(" + "));
  if (f.any.length) parts.push(`any of ${f.any.map((id) => roleName(ctx, id)).join(" / ")}`);
  for (const g of f.anyGroups ?? []) if (g.length) parts.push(`any of ${g.map((id) => roleName(ctx, id)).join(" / ")}`);
  if (f.none.length) parts.push(`not ${f.none.map((id) => roleName(ctx, id)).join(", ")}`);
  for (const k of f.missing) parts.push(`no ${ctx.snap.categories.find((c) => c.key === k)?.title.toLowerCase()} role`);
  if (f.joined !== "any") parts.push(f.joined === "older" ? "joined over a year ago" : `joined in the last ${f.joined === "1" ? "day" : `${f.joined} days`}`);
  if (f.levelMin !== null) parts.push(`level ${f.levelMin}+`);
  if (f.levelMax !== null) parts.push(`level ≤ ${f.levelMax}`);
  if (f.messagesMin !== null) parts.push(`${f.messagesMin.toLocaleString()}+ messages`);
  if (f.account !== "any") parts.push(f.account === "no" ? "no website account" : f.account === "verified" ? "confirmed website account" : "website account");
  if (f.social !== "any") parts.push(f.social === "yes" ? "Social profile" : "no Social profile");
  if (f.boosting !== "any") parts.push(f.boosting === "yes" ? "boosting" : "not boosting");
  if (f.timedOut !== "any") parts.push(f.timedOut === "yes" ? "timed out" : "not timed out");
  if (f.bots !== "humans") parts.push(f.bots === "bots" ? "bots only" : "including bots");
  if (f.search.trim()) parts.push(`name has “${f.search.trim()}”`);
  return parts.length ? parts.join(", ") : "all members";
}

/** Reads a question like "of the 18+ verified members how many are male" or "gender breakdown of looking members". */
export function parseQuestion(ctx: Ctx, question: string): Parsed {
  let q = ` ${question.toLowerCase()} `;
  for (const [re, to] of ALIASES) q = q.replace(re, to);
  q = q.replace(/\s+/g, " ");
  const vocab = roleVocab(ctx.snap.roles);
  const reading: string[] = [];
  const unknown: string[] = [];

  // Which breakdown, if any ("gender breakdown", "split by pronouns", "by level")
  let dim: Dim | null = null;
  // "gender breakdown…", "split by pronouns", or a question that starts with a category ("relationship status of females")
  const startsWithCategory = CATEGORY_WORDS.some(([re]) => new RegExp(`^\\s*(?:the |what )?(?:${re.source})( roles?)? (of|for|among|in)\\b`).test(q));
  const wantsSplit = startsWithCategory || /\b(breakdown|break down|split|distribution|by|per|each|chart|spread|mix)\b/.test(q);
  if (wantsSplit) {
    for (const [re, key] of CATEGORY_WORDS) {
      if (re.test(q) && ctx.categoryRoles.has(key) && !new RegExp(`\\b(no|without)( an?)? (?:${re.source})`).test(q)) {
        dim = { kind: "category", key };
        q = q.replace(re, " ");
        break;
      }
    }
    if (!dim && /\b(by|per) level\b|\blevels?\b/.test(q)) dim = { kind: "level" };
    else if (!dim && /\bjoin(ed)? (month|date)|\bby month\b|\bjoins?\b/.test(q)) dim = { kind: "joinMonth" };
    else if (!dim && /\bmessages?\b/.test(q)) dim = { kind: "messages" };
    else if (!dim && /\baccount age\b|\bnew accounts?\b/.test(q)) dim = { kind: "accountAge" };
    else if (!dim && /\bwebsite\b/.test(q)) dim = { kind: "account" };
    else if (!dim && /\broles?\b/.test(q)) dim = { kind: "roles" };
    if (dim) q = q.replace(/\b(breakdown|break down|split|distribution|by|per|chart|spread|mix)\b/g, " ").replace(/^\s*(the |what )?( roles?)? (of|for|among|in)\b/, " ");
  }

  // "ratio of X to Y (among Z)"
  const ratio = /\bratio of (.+?) to (.+?)(?: (?:among|of|in|for|with) (.+))?$/.exec(q.trim()) ?? /\b(.+?) (?:to|vs|versus) (.+?) ratio(?: (?:among|of|in|for) (.+))?$/.exec(q.trim());
  if (ratio) {
    const base = clause(ratio[3] ?? "", vocab, ctx, reading, unknown);
    const a = clause(ratio[1], vocab, ctx, [], unknown);
    const b = clause(ratio[2], vocab, ctx, [], unknown);
    return { base, target: null, ratio: [a, b], dim, reading: [`among ${describe(ctx, base)}`, `ratio of ${describe(ctx, a)} to ${describe(ctx, b)}`], unknown };
  }

  // "of the X, how many are Y" / "how many X are Y" / "how many of the X are Y"
  const how = /\b(how many|what percent(age)?( of)?|what share( of)?|what fraction( of)?|number of|count( of)?|how much)\b/.exec(q);
  if (how) {
    const before = q.slice(0, how.index);
    let after = q.slice(how.index + how[0].length);
    let baseText = before.replace(/\b(of|among|out of|from|within|in) (the|all|our)?\b/g, " ");
    // "how many of the 18+ verified members are male" → base inside "of the … are"
    const inner = /^\s*(?:of|among|out of) (?:the |all |our )?(.+?) (?:are|have|is|has|who are|that are|with|identify as)\b(.*)$/.exec(after);
    if (inner) {
      baseText += ` ${inner[1]}`;
      after = inner[2];
    }
    // "how many males are 18+ verified": the subject is the target, the rest narrows it
    const split = /^(.*?)\b(are|have|is|has|who are|that are|with|identify as)\b(.*)$/.exec(after);
    let targetText = after;
    if (split && !inner && !before.trim()) {
      targetText = `${split[1]} ${split[3]}`;
    } else if (split) {
      targetText = `${split[1]} ${split[3]}`;
    }
    const base = clause(baseText, vocab, ctx, [], unknown);
    const target = clause(targetText, vocab, ctx, [], unknown);
    const targetEmpty = filterIsEmpty(target);
    reading.push(`out of: ${describe(ctx, base)}`);
    if (!targetEmpty) reading.push(`how many: ${describe(ctx, target)}`);
    // "how many of the 18+ verified members are in each gender": no target, just the split
    return { base, target: targetEmpty ? null : target, ratio: null, dim, reading, unknown };
  }

  // Just a filter, maybe with a breakdown ("looking females", "gender breakdown of 18+ verified")
  const base = clause(q, vocab, ctx, [], unknown);
  reading.push(`members: ${describe(ctx, base)}`);
  return { base, target: null, ratio: null, dim, reading, unknown };
}

/** Puts two filters together (both must match). */
export function combine(a: Filter, b: Filter): Filter {
  const pick = <T>(x: T, y: T, empty: T) => (y !== empty ? y : x);
  return {
    all: Array.from(new Set([...a.all, ...b.all])),
    // Two "any of" groups both have to match: keep the second as its own group
    any: a.any.length ? a.any : b.any,
    anyGroups: [...(a.anyGroups ?? []), ...(b.anyGroups ?? []), ...(a.any.length && b.any.length ? [b.any] : [])],
    none: Array.from(new Set([...a.none, ...b.none])),
    missing: Array.from(new Set([...a.missing, ...b.missing])),
    search: b.search || a.search,
    joined: pick(a.joined, b.joined, "any"),
    levelMin: b.levelMin ?? a.levelMin,
    levelMax: b.levelMax ?? a.levelMax,
    messagesMin: b.messagesMin ?? a.messagesMin,
    account: pick(a.account, b.account, "any"),
    social: pick(a.social, b.social, "any"),
    boosting: pick(a.boosting, b.boosting, "any"),
    timedOut: pick(a.timedOut, b.timedOut, "any"),
    bots: pick(a.bots, b.bots, "humans"),
  };
}

/** The category a role belongs to (to show the rest of that category next to an answer). */
export function categoryOf(ctx: Ctx, roleId: string) {
  return ctx.snap.roles[ctx.index.get(roleId) ?? -1]?.category ?? null;
}
