// Admin → Rules: the server rules, editable on the website. Edits are saved in zeo_bot.rules_content {_id: "rules"}
// in the moderation bot's format; the bot checks it every minute, uses it for #rules (editing every posted copy) and
// /rule, and the website's Rules page reads the same document. With no document, both use the text in the bot's
// db/rules_content.py (lib/rules-source.ts is a copy of it).

import type { Document } from "mongodb";
import { RULE_NAMES, RULES_SOURCE, type RulePartSource, type RulesSource } from "./rules-source";
import type { RulePart } from "./rules-data";
import { getBotCollection } from "./mongodb";

export type { RulePartSource, RulesSource, RuleSource } from "./rules-source";
export type WebRules = { intro: string; tldr: string[]; parts: RulePart[] };
export type RulesState = { source: RulesSource; edited: boolean; version: number; updatedAt: string | null; updatedBy: string | null };

const DOC_ID = "rules";
const col = () => getBotCollection("rules_content");
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

/** Bot format → editor format */
function fromDoc(doc: Document): RulesSource {
  return {
    intro: String(doc.intro ?? ""),
    tldr: ((doc.tldr ?? []) as unknown[]).map(String),
    parts: ((doc.parts ?? []) as Document[]).map((p) => ({
      key: String(p.key ?? ""),
      title: String(p.title ?? ""),
      emoji: String(p.emoji ?? "📜"),
      color: ((p.color ?? [232, 124, 45]) as unknown[]).slice(0, 3).map(Number),
      intro: String(p.intro ?? ""),
      rules: ((p.rules ?? []) as Document[]).map((r) => ({
        title: String(r.title ?? ""),
        points: ((r.points ?? []) as unknown[]).map(String),
        bad: ((r.examples?.bad ?? []) as unknown[]).map(String),
        good: ((r.examples?.good ?? []) as unknown[]).map(String),
      })),
      info: ((p.info ?? []) as unknown[][]).map((i) => [String(i[0] ?? ""), String(i[1] ?? "")]),
    })),
  };
}

/** Editor format → bot format (what db/rules_content.py apply_override reads) */
function toDoc(source: RulesSource) {
  return {
    intro: source.intro,
    tldr: source.tldr,
    parts: source.parts.map((p) => ({
      key: p.key,
      title: p.title,
      emoji: p.emoji,
      color: p.color,
      ...(p.intro ? { intro: p.intro } : {}),
      rules: p.rules.map((r) => ({ title: r.title, points: r.points, ...(r.bad.length || r.good.length ? { examples: { bad: r.bad, good: r.good } } : {}) })),
      ...(p.info.length ? { info: p.info } : {}),
    })),
  };
}

export async function getRulesState(): Promise<RulesState> {
  const doc = (await (await col()).findOne({ _id: DOC_ID } as never)) as Document | null;
  if (!doc?.parts?.length) return { source: clone(RULES_SOURCE), edited: false, version: Number(doc?.version) || 0, updatedAt: null, updatedBy: null };
  return {
    source: fromDoc(doc),
    edited: true,
    version: Number(doc.version) || 0,
    updatedAt: doc.updatedAt instanceof Date ? doc.updatedAt.toISOString() : null,
    updatedBy: typeof doc.updatedBy?.name === "string" ? doc.updatedBy.name : null,
  };
}

const webText = (text: string) =>
  text
    .replace(/\[\[ch:(\w+)\]\]/g, (_, k: string) => RULE_NAMES.channels[k] ?? k)
    .replace(/\[\[role:(\w+)\]\]/g, (_, k: string) => RULE_NAMES.roles[k] ?? k);
const hex = (c: number[]) => `#${c.slice(0, 3).map((n) => Math.max(0, Math.min(255, Math.round(n || 0))).toString(16).padStart(2, "0")).join("")}`;

/** The rules as the website shows them: tokens become names, password points are left out, rules numbered. */
export function toWebRules(source: RulesSource): WebRules {
  let n = 0;
  return {
    intro: webText(source.intro),
    tldr: source.tldr.map(webText),
    parts: source.parts.map((p) => {
      const [label, title] = p.title.includes(" · ") ? (p.title.split(" · ", 2) as [string, string]) : ["", p.title];
      return {
        key: p.key,
        title,
        label,
        emoji: p.emoji,
        color: hex(p.color),
        intro: webText(p.intro),
        rules: p.rules.map((r) => ({
          n: ++n,
          title: r.title,
          points: r.points.filter((x) => !x.includes("{PASSWORD}")).map(webText),
          bad: r.bad.map(webText),
          good: r.good.map(webText),
        })),
        info: p.info.map(([t, b]) => ({ title: t, body: webText(b) })),
      };
    }),
  };
}

/** The rules for the website's Rules page (falls back to the built-in text if the database can't be reached). */
export async function getWebRules(): Promise<WebRules> {
  try {
    return toWebRules((await getRulesState()).source);
  } catch {
    return toWebRules(RULES_SOURCE);
  }
}

// ---------- Checking an edit ----------
// Discord limits: an embed field holds 1024 characters, a description 4096, one embed 6000 in all, 25 fields.

const TOKEN = /\[\[(ch|role):(\w+)\]\]/g;
const KEY = /^[a-z0-9_]{1,24}$/;

function badTokens(text: string): string[] {
  const out: string[] = [];
  for (const m of Array.from(text.matchAll(TOKEN))) {
    const known = m[1] === "ch" ? RULE_NAMES.channels : RULE_NAMES.roles;
    if (!(m[2] in known)) out.push(m[0]);
  }
  return out;
}

const str = (v: unknown, max: number) => String(v ?? "").replace(/\r\n/g, "\n").trim().slice(0, max);
const strs = (v: unknown, max: number, count: number) =>
  (Array.isArray(v) ? v : [])
    .map((x) => str(x, max))
    .filter(Boolean)
    .slice(0, count);

/** Cleans an edit from the panel. Returns the rules, or what's wrong with them. */
export function checkRules(raw: unknown): RulesSource | string {
  if (!raw || typeof raw !== "object") return "Invalid rules.";
  const r = raw as Record<string, unknown>;
  const source: RulesSource = {
    intro: str(r.intro, 3500),
    tldr: strs(r.tldr, 200, 12),
    parts: (Array.isArray(r.parts) ? r.parts : []).slice(0, 12).map((p: Record<string, unknown>) => ({
      key: str(p?.key, 24).toLowerCase(),
      title: str(p?.title, 80),
      emoji: str(p?.emoji, 8) || "📜",
      color: (Array.isArray(p?.color) ? p.color : [232, 124, 45]).slice(0, 3).map((c: unknown) => Math.max(0, Math.min(255, Math.round(Number(c) || 0)))),
      intro: str(p?.intro, 1500),
      rules: (Array.isArray(p?.rules) ? p.rules : []).slice(0, 20).map((x: Record<string, unknown>) => ({
        title: str(x?.title, 120),
        points: strs(x?.points, 600, 12),
        bad: strs(x?.bad, 300, 6),
        good: strs(x?.good, 300, 6),
      })),
      info: (Array.isArray(p?.info) ? p.info : [])
        .slice(0, 6)
        .map((i: unknown) => (Array.isArray(i) ? [str(i[0], 120), str(i[1], 1000)] : ["", ""]))
        .filter(([t, b]: string[]) => t || b),
    })),
  };

  if (!source.intro) return "The welcome text can't be empty.";
  if (!source.tldr.length) return "Add at least one line to the short version.";
  if (source.tldr.join("\n").length > 1000) return "The short version is too long for Discord (1,000 characters in all).";
  if (!source.parts.length) return "Add at least one part.";
  const keys = new Set<string>();
  for (let i = 0; i < source.parts.length; i++) {
    const p = source.parts[i];
    const name = p.title || `Part ${i + 1}`;
    if (!KEY.test(p.key)) return `${name}: the key must be lowercase letters, numbers or _.`;
    if (keys.has(p.key)) return `Two parts use the key "${p.key}".`;
    keys.add(p.key);
    if (!p.title) return `Part ${i + 1} needs a title.`;
    if (!p.rules.length) return `${name}: add at least one rule.`;
    if (p.rules.length + p.info.length > 25) return `${name}: Discord fits 25 rules and notes per part.`;
    let size = p.title.length + p.intro.length + 10;
    for (const rule of p.rules) {
      if (!rule.title) return `${name}: every rule needs a title.`;
      if (!rule.points.length) return `${name} → ${rule.title}: add at least one point.`;
      const body = [...rule.points.map((x) => `• ${x}`), ...(rule.bad.length || rule.good.length ? [""] : []), ...rule.bad.map((x) => `❌ ${x}`), ...rule.good.map((x) => `✅ ${x}`)].join("\n");
      if (body.length > 1000) return `${name} → ${rule.title}: too long for Discord (${body.length.toLocaleString()} of 1,000 characters). Split it into two rules.`;
      size += rule.title.length + body.length + 6;
    }
    for (const [t, b] of p.info) {
      if (!t || !b) return `${name}: every note needs a title and text.`;
      size += t.length + b.length;
    }
    if (size > 5600) return `${name}: too long for one Discord message (${size.toLocaleString()} of about 5,600 characters). Move some rules to another part.`;
  }
  const everything: string[] = [source.intro, ...source.tldr];
  for (const p of source.parts) {
    everything.push(p.intro, ...p.info.map((x) => x[1]));
    for (const x of p.rules) everything.push(...x.points, ...x.bad, ...x.good);
  }
  const unknown = Array.from(new Set(everything.flatMap(badTokens)));
  if (unknown.length) return `Unknown channel or role: ${unknown.join(", ")}. Use one from the list under the editor.`;
  return source;
}

export async function saveRules(source: RulesSource, by: { discordId: string; name: string }) {
  await (await col()).updateOne(
    { _id: DOC_ID } as never,
    { $set: { ...toDoc(source), updatedAt: new Date(), updatedBy: { id: by.discordId, name: by.name, source: "website" } }, $inc: { version: 1 } },
    { upsert: true },
  );
}

/** Back to the text in the bot's code file */
export async function resetRules() {
  await (await col()).deleteOne({ _id: DOC_ID } as never);
}

/** Part keys of what Discord has posted now vs. an edit: if they differ, #rules has to be posted again. */
export function partsChanged(before: RulesSource, after: RulesSource) {
  return before.parts.map((p) => p.key).join(",") !== after.parts.map((p) => p.key).join(",");
}
