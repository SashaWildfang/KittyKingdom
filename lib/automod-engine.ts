// The website's copy of the bot's AutoMod filter (main_bot/moderation/events/automod.py), used by
// Admin → AutoMod → "Test a message" so staff can see exactly what the bot would catch. Same steps
// as the bot: fold fancy/look-alike letters back to a-z, check each word (a couple of ways),
// s p a c e d letters joined up, split-up pieces glued together, and phrases. The data tables
// come from lib/automod-data.ts, which is generated from the bot file.

import { BAIT_SOURCE, COMMON_SHORT, CONFUSABLES, INVITE_SOURCE, LEET, LOOKALIKE_TARGETS, MARKDOWN_EDGES, OFFICIAL_DOMAINS, PLAIN_LEET, RISKY_TLDS } from "./automod-data";

export type AutomodWord = { w: string; sev: "severe" | "standard"; match: "word" | "partial" };
export type WordHit = { term: string; severe: boolean; how: "word" | "split" | "phrase" };

const LETTERS = "abcdefghijklmnopqrstuvwxyz";
const LEET_CHARS = new Set(Object.values(LEET).join("").split("").filter((c) => !LETTERS.includes(c)));
const URL_RE = /https?:\/\/\S+/gi;
const ZERO_WIDTH_RE = new RegExp("[\\u00ad\\u034f\\u061c\\u115f\\u1160\\u17b4\\u17b5\\u180b-\\u180f\\u200b-\\u200f\\u202a-\\u202e\\u2060-\\u206f\\u3164\\ufe00-\\ufe0f\\ufeff\\uffa0\\u{e0000}-\\u{e007f}]", "gu");
const MARK_RE = new RegExp("\\p{M}", "u");
const FORMAT_RE = new RegExp("\\p{Cf}", "u");

export function fold(text: string): string {
  if (!text) return "";
  let out = "";
  for (const ch of Array.from(text.normalize("NFKC"))) {
    const cp = ch.codePointAt(0)!;
    if (cp >= 0x1f1e6 && cp <= 0x1f1ff) out += String.fromCharCode(cp - 0x1f1e6 + 97);
    else if (cp >= 0x1f170 && cp <= 0x1f189) out += String.fromCharCode(cp - 0x1f170 + 97);
    else if (cp >= 0x1f130 && cp <= 0x1f149) out += String.fromCharCode(cp - 0x1f130 + 97);
    else out += ch;
  }
  out = out.toLowerCase().normalize("NFKD");
  let kept = "";
  for (const ch of Array.from(out)) if (!MARK_RE.test(ch) && !FORMAT_RE.test(ch)) kept += ch;
  kept = kept.replace(ZERO_WIDTH_RE, "");
  let result = "";
  for (const ch of Array.from(kept)) result += CONFUSABLES[ch] ?? ch;
  return result;
}

export function cleanToken(token: string) {
  let out = "";
  for (const ch of Array.from(token)) if ((ch >= "a" && ch <= "z") || (ch >= "0" && ch <= "9") || LEET_CHARS.has(ch)) out += ch;
  return out;
}

function stripEdges(token: string) {
  let start = 0;
  let end = token.length;
  while (start < end && MARKDOWN_EDGES.includes(token[start])) start++;
  while (end > start && MARKDOWN_EDGES.includes(token[end - 1])) end--;
  return token.slice(start, end);
}

const words = (text: string) => text.split(/\s+/).filter(Boolean);

export function cleanPhrase(text: string) {
  return words(fold(text)).map(cleanToken).filter(Boolean).join(" ");
}

/** How a blocked word is stored: plain lowercase letters (Sn3aky -> sneaky). */
export function plainTerm(text: string) {
  return words(fold(text))
    .map((x) => cleanToken(x).split("").map((c) => PLAIN_LEET[c] ?? c).join(""))
    .filter(Boolean)
    .join(" ");
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\\-/]/g, "\\$&");

function termPattern(term: string) {
  let p = "";
  for (const ch of Array.from(term)) {
    if (ch === " ") {
      p += "\\s*";
      continue;
    }
    const options = Array.from(new Set((ch + (LEET[ch] ?? "") + "*").split("")));
    p += "[" + options.map(escapeRe).join("") + "]+";
  }
  return p;
}

const PLURAL = "(?:[s5$z]+|[e3][s5$z]+)?";

class WordRule {
  term: string;
  severe: boolean;
  partial: boolean;
  phrase: boolean;
  regex: RegExp;
  constructor(term: string, severe: boolean, partial: boolean) {
    this.term = plainTerm(term);
    this.severe = severe;
    this.partial = partial;
    this.phrase = this.term.includes(" ");
    const p = termPattern(this.term);
    this.regex = this.phrase ? new RegExp(`(?:^|\\s)${p}${PLURAL}(?=\\s|$)`, "m") : partial ? new RegExp(p) : new RegExp(`^${p}${PLURAL}$`);
  }
}

export function candidates(text: string) {
  const folded = fold(text.replace(URL_RE, " "));
  const singles: string[] = [];
  const cleanedList: string[] = [];
  for (const tok of words(folded)) {
    const a = cleanToken(tok);
    const b = cleanToken(stripEdges(tok));
    cleanedList.push(b || a);
    for (const c of [a, b]) if (c && !singles.includes(c)) singles.push(c);
  }
  const tokens = cleanedList.filter(Boolean);
  let run: string[] = [];
  const collapsed: string[] = [];
  for (const t of [...tokens, ""]) {
    if (t.length === 1) {
      run.push(t);
      continue;
    }
    if (run.length >= 3) {
      singles.push(run.join(""));
      collapsed.push(run.join(""));
    } else collapsed.push(...run);
    run = [];
    if (t) collapsed.push(t);
  }
  const glued: [string, number][] = [];
  for (const size of [2, 3]) {
    for (let i = 0; i + size <= tokens.length; i++) {
      const parts = tokens.slice(i, i + size);
      const piece = parts.join("");
      if (piece.length >= 3 && !parts.every((p) => COMMON_SHORT.has(p))) glued.push([piece, Math.max(...parts.map((p) => p.length))]);
    }
  }
  let joined = tokens.join(" ");
  if (collapsed.length !== tokens.length) joined += "\n" + collapsed.join(" ");
  return { singles, glued, joined };
}

/**
 * A censor star can stand in for a letter (n*g, f*ck), but at least half the word (and 2 letters)
 * has to be real letters, so italics like *i* or **i** never read as a blocked word.
 */
function enoughLetters(term: string, matched: string) {
  const letters = term.replace(/ /g, "");
  const need = letters.length >= 2 ? Math.max(2, Math.ceil(letters.length / 2)) : 1;
  let real = 0;
  for (const ch of Array.from(matched)) if (ch !== "*" && ch !== " " && ch !== "\n") real++;
  return real >= need;
}

export class Matcher {
  rules: WordRule[];
  allow: Set<string>;
  constructor(list: AutomodWord[], allow: string[]) {
    this.rules = list.filter((w) => plainTerm(w.w)).map((w) => new WordRule(w.w, w.sev === "severe", w.match === "partial"));
    this.allow = new Set(allow.map((a) => cleanPhrase(a).replace(/ /g, "")).filter(Boolean));
  }

  find(text: string, relaxed = false): WordHit | null {
    if (!text || !this.rules.length) return null;
    const c = candidates(text);
    const singles = c.singles.filter((s) => !this.allow.has(s));
    const glued = c.glued.filter(([g]) => !this.allow.has(g));
    const ordered = [...this.rules].sort((a, b) => Number(b.severe) - Number(a.severe));
    for (const rule of ordered) {
      if (relaxed && !rule.severe) continue;
      if (rule.phrase) {
        for (const hay of [c.joined, ...singles]) {
          const m = rule.regex.exec(hay);
          if (m && enoughLetters(rule.term, m[0])) return { term: rule.term, severe: rule.severe, how: "phrase" };
        }
        continue;
      }
      for (const s of singles) {
        const m = rule.regex.exec(s);
        if (m && enoughLetters(rule.term, m[0])) return { term: rule.term, severe: rule.severe, how: "word" };
      }
      if (!rule.partial) {
        for (const [g, part] of glued) {
          const m = rule.term.length >= 4 || part <= 2 ? rule.regex.exec(g) : null;
          if (m && enoughLetters(rule.term, m[0])) return { term: rule.term, severe: rule.severe, how: "split" };
        }
      }
    }
    return null;
  }
}

// ---------- Links ----------
const INVITE_RE = new RegExp(INVITE_SOURCE, "gi");
const DOMAIN_RE = /(?:https?:\/\/)?((?:[a-z0-9-]+\.)+[a-z]{2,24})(?::\d+)?(\/[^\s)>]*)?/gi;
const MASKED_RE = /\[([^\]]{1,200})\]\(\s*<?(https?:\/\/[^\s)>]+)>?\s*\)/gi;
const BAIT_RE = new RegExp(BAIT_SOURCE, "i");

export function domainsIn(text: string) {
  const out: string[] = [];
  for (const m of Array.from((text ?? "").matchAll(DOMAIN_RE))) {
    const host = m[1].toLowerCase().replace(/^\.+|\.+$/g, "");
    const explicit = m[0].toLowerCase().startsWith("http");
    const tld = host.split(".").pop() ?? "";
    if (explicit || RISKY_TLDS.has(tld) || host.startsWith("xn--") || host.includes(".xn--")) out.push(host);
  }
  return out;
}

const registrable = (host: string) => host.split(".").slice(-2).join(".");
const isOfficial = (host: string) => OFFICIAL_DOMAINS.has(registrable(host)) || OFFICIAL_DOMAINS.has(host);

function editDistance(a: string, b: string) {
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur.push(Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)));
    prev = cur;
  }
  return prev[b.length];
}

function lookalike(host: string) {
  if (isOfficial(host)) return null;
  const map: Record<string, string> = { "1": "i", l: "i", "0": "o", "3": "e", "4": "a", "5": "s", "7": "t" };
  const label = fold(registrable(host).split(".")[0]).replace(/-/g, "").split("").map((c) => map[c] ?? c).join("");
  for (const target of LOOKALIKE_TARGETS) {
    const t = target.replace(/l/g, "i");
    if (label.includes(t) && label !== t) return target;
    if (t.length >= 6 && editDistance(label.slice(0, t.length + 2), t) <= 2) return target;
  }
  return null;
}

export function scanLinks(rawText: string): string | null {
  for (const m of Array.from(rawText.matchAll(MASKED_RE))) {
    const shown = m[1];
    const shownDomains = domainsIn(shown.toLowerCase().startsWith("http") ? shown : `https://${shown.trim()}`);
    const realDomains = domainsIn(m[2]);
    if (shownDomains.length && realDomains.length && registrable(shownDomains[0]) !== registrable(realDomains[0])) return "Disguised link (shows one site, opens another)";
  }
  const hosts = domainsIn(rawText);
  for (const host of hosts) {
    if (host.startsWith("xn--") || host.includes(".xn--")) return `Look-alike web address (${host})`;
    if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)) return "Link to a bare IP address";
    const brand = lookalike(host);
    if (brand) return `Fake ${brand[0].toUpperCase()}${brand.slice(1)} link (${host})`;
  }
  const unofficial = hosts.filter((h) => !isOfficial(h));
  if (unofficial.length && BAIT_RE.test(fold(rawText))) return `Scam bait with a link (${unofficial[0]})`;
  if (unofficial.length && /@(?:everyone|here)/.test(rawText)) return `@everyone with an outside link (${unofficial[0]})`;
  return null;
}

export function findInvites(text: string) {
  let compact = (text ?? "").normalize("NFKC").replace(ZERO_WIDTH_RE, "");
  compact = compact.replace(/[[({]\s*(?:\.|dot)\s*[\])}]/gi, ".");
  compact = compact.replace(/\s+dot\s+/gi, ".");
  compact = compact.replace(/\s*([./])\s*/g, "$1");
  return Array.from(compact.matchAll(INVITE_RE), (m) => m[1]);
}

const CUSTOM_EMOJI_RE = /<a?:\w{2,32}:\d{15,21}>/g;
const UNICODE_EMOJI_RE = new RegExp("[\\u{1F300}-\\u{1FAFF}\\u2600-\\u27BF\\u2B50\\u2B55\\u{1F1E6}-\\u{1F1FF}]", "gu");

export function emojiCount(text: string) {
  return (text.match(CUSTOM_EMOJI_RE) ?? []).length + (text.replace(CUSTOM_EMOJI_RE, "").match(UNICODE_EMOJI_RE) ?? []).length;
}

/** Everything the bot would say about one message (for the test box). */
export function testMessage(text: string, list: AutomodWord[], allow: string[]) {
  const matcher = new Matcher(list, allow);
  const hit = matcher.find(text);
  return {
    readsAs: candidates(text).joined.split("\n").pop() ?? "",
    word: hit,
    relaxedOk: hit ? !matcher.find(text, true) : true,
    scam: scanLinks(text),
    invites: findInvites(text),
    emojis: emojiCount(text),
  };
}
