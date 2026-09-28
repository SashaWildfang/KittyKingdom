// Catches junk typed into profile and account fields: keyboard mashing, one word repeated over and
// over, strings with no real words, invite/unsafe links, banned words, and obviously fake phone
// numbers. It only rejects what's clearly junk, so real answers (short ones, nicknames, other
// languages) get through. Each check returns a friendly message or null.

import { getAutomodConfig } from "./automod";
import { Matcher, scanLinks } from "./automod-engine";

const KEYBOARD_ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm", "1234567890", "qazwsxedc"];
const INVITE = /(discord\.(gg|com\/invite|me)|discordapp\.com\/invite|dsc\.gg|\.gg\/)[\w-]*/i;
const URL = /https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|org|gg|io|xyz|ru|co|me|tv|app|link|site|online|ly)\b/i;

// Any-language letters and "same character 8+ times" (built at runtime: the TS target is ES5)
const LETTER = new RegExp("\\p{L}", "gu");
const REPEAT = new RegExp("(.)\\1{7,}", "u");

let matcher: { at: number; m: Matcher } | null = null;
async function words() {
  if (!matcher || Date.now() - matcher.at > 60_000) {
    const cfg = await getAutomodConfig().catch(() => null);
    matcher = { at: Date.now(), m: new Matcher(cfg?.words ?? [], cfg?.allow ?? []) };
  }
  return matcher.m;
}

/** Does this token look like keyboard mashing? (runs along a keyboard row, no vowels, or one letter repeated) */
function mashed(token: string): boolean {
  const t = token.toLowerCase();
  if (t.length < 5) return false;
  if (/(.)\1{4,}/.test(t)) return true; // aaaaa, !!!!!
  for (const row of KEYBOARD_ROWS) {
    for (const r of [row, row.split("").reverse().join("")]) {
      for (let i = 0; i + 5 <= r.length; i++) if (t.includes(r.slice(i, i + 5))) return true; // asdfg, qwert, 12345...
    }
  }
  const letters = t.replace(/[^a-z]/g, "");
  if (letters.length >= 7 && !/[aeiouy]/.test(letters)) return true; // sdfkjhgl
  if (letters.length >= 9 && /[^aeiouy]{7,}/.test(letters)) return true; // long consonant runs
  return false;
}

export type TextCheck = {
  /** Field name for messages, e.g. "Bio" */
  label: string;
  /** Short identity fields (name, location) must contain letters and can't be mostly mashing */
  short?: boolean;
  /** Allow ordinary links (social/handle fields); invites and unsafe links are always blocked */
  allowLinks?: boolean;
  /** Handles, friend codes, gamertags: only link and banned-word checks (no "mashing" checks) */
  handle?: boolean;
};

/** Returns why the text looks like spam/junk, or null if it's fine. Empty text is fine. */
export async function checkText(raw: unknown, opts: TextCheck): Promise<string | null> {
  const text = String(raw ?? "").trim();
  if (!text) return null;
  const lower = text.toLowerCase();

  if (INVITE.test(lower)) return `${opts.label} can't include Discord invite links.`;
  if (scanLinks(text)) return `${opts.label} has a link that looks unsafe.`;
  if (!opts.allowLinks && URL.test(lower)) return `${opts.label} can't include links. Put them in your socials instead.`;
  const hit = (await words()).find(text);
  if (hit?.severe) return `${opts.label} has language that isn't allowed here.`;

  if (opts.handle) return null;

  // Needs some actual letters (any language), not just symbols, digits or emoji
  const letters = text.match(LETTER)?.length ?? 0;
  if (opts.short && letters === 0) return `${opts.label} needs some letters.`;
  if (!opts.short && text.length >= 12 && letters / text.length < 0.3) return `${opts.label} looks like it's mostly symbols. Write it out in words.`;

  // Same character over and over
  if (REPEAT.test(text)) return `${opts.label} looks like keyboard spam.`;

  const tokens = lower.split(/[\s,.;:!?/|]+/).filter(Boolean);
  // Mostly mashed "words"
  const junk = tokens.filter(mashed).length;
  if (tokens.length && (junk / tokens.length > (opts.short ? 0.5 : 0.4) || (tokens.length <= 2 && junk >= 1)))
    return `${opts.label} looks like keyboard spam. Tell people something real!`;
  // One word repeated to pad it out
  if (tokens.length >= 6) {
    const counts = new Map<string, number>();
    for (const t of tokens) counts.set(t, (counts.get(t) ?? 0) + 1);
    const top = Math.max(...Array.from(counts.values()));
    if (top / tokens.length > 0.5) return `${opts.label} repeats the same word a lot. Try writing it out.`;
  }
  return null;
}

/** Runs checkText over several fields; the first problem wins. */
export async function checkTexts(fields: [unknown, TextCheck][]): Promise<string | null> {
  for (const [value, opts] of fields) {
    const err = await checkText(value, opts);
    if (err) return err;
  }
  return null;
}

/** Obviously fake phone numbers (the number is already normalized to +<digits>). */
export function fakePhone(phone: string): boolean {
  const d = phone.replace(/\D/g, "");
  const local = d.startsWith("1") && d.length === 11 ? d.slice(1) : d.slice(-10);
  if (/^(\d)\1+$/.test(local)) return true; // 0000000000, 5555555555
  if ("01234567890123456789".includes(local) || "98765432109876543210".includes(local)) return true; // sequences
  if (/^(\d{2,5})\1+$/.test(local)) return true; // 1212121212, 1234512345
  if (d.startsWith("1") && d.length === 11) {
    // US / Canada: area code and exchange can't start with 0/1, no N11 codes, 555-01xx is fictional
    const [area, exch, line] = [local.slice(0, 3), local.slice(3, 6), local.slice(6)];
    if (/^[01]/.test(area) || /^[01]/.test(exch)) return true;
    if (/^\d11$/.test(area) || /^\d11$/.test(exch)) return true;
    if (exch === "555" && /^01\d\d$/.test(line)) return true;
    if (area === "555") return true;
  }
  return false;
}
