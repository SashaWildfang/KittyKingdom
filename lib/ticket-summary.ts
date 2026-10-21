// Admin → Tickets: a short AI description of each ticket ("Asked about an announcement, Sasha explained
// why it was made"; manual tickets get a bit more). 18+ verification tickets: "Verified by Oberon. DOB
// 10/12/2001 (Age: 25)" plus flags. Staff who want more open the ticket.
// Claude reads the conversation and up to MAX_IMAGES screenshots: from the live Discord channel while
// the ticket is open, and from its transcript once it's closed. Summaries are saved, so each ticket is
// only read again when something new happened (a new message, or the transcript arriving).
//
// Privacy: 18+ verification tickets hold ID photos, so their images are never sent. The AI reads the chat
// for the result; the DOB comes from the member's join application, and the age, flags and whether they
// have the 18+ Verified role are worked out here.
//
// website.ticket_summaries {_id: ticketId, headline, summary, key, messages, images, model, generatedAt, checkedAt}

import { parse, type HTMLElement } from "node-html-parser";
import type { PanelUser } from "./admin";
import { AI_MODEL, AiError, aiEnabled, askClaude, type AiImage, type AiPart } from "./ai";
import { calculateAge, parseAge } from "./dates";
import { memberRoleIdsCached } from "./discord-member";
import { applicationBirthday, getJoinApplication } from "./join-application";
import { getMongoClient } from "./mongodb";
import { ticketLive } from "./ticket-live";
import { getTicket, isNsfwTicket, type Ticket } from "./tickets";
import { openTranscriptFile } from "./transcript-store";

const MAX_IMAGES = 4;
/** Bump when the wording rules change: saved descriptions from an older version are written again */
const VERSION = 3;
const ADULT_VERIFIED_ROLE = "1358469974552870913";
const MAX_IMAGE_BYTES = 3_500_000;
const MAX_TEXT = 24_000;
const DAILY_LIMIT = Number(process.env.TICKET_SUMMARY_DAILY_LIMIT || 400);
/** Open tickets are checked for new messages at most this often */
export const RECHECK_MS = 10 * 60_000;

export class SummaryError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export type TicketSummary = { ticketId: number; headline: string; summary: string; flags: string[]; generatedAt: string | null; checkedAt: string | null; images: number; messages: number; stale: boolean };

type Doc = { _id: number; headline: string; summary: string; flags?: string[]; key: string; version?: number; messages: number; images: number; model: string; generatedAt: Date; checkedAt: Date };

async function col() {
  const client = await getMongoClient();
  return client.db(process.env.MONGODB_DB ?? "website").collection<Doc>("ticket_summaries");
}

type Line = { author: string; role: "opener" | "staff" | "bot" | "other"; time: string; text: string; images: string[] };
type Source = { key: string; lines: Line[]; loadImage: (ref: string) => Promise<AiImage | null> };

const TYPES: Record<string, AiImage["mediaType"]> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp" };
const mediaTypeOf = (name: string) => TYPES[(name.split("?")[0].split(".").pop() ?? "").toLowerCase()] ?? null;
const squash = (s: string) => s.replace(/\s+/g, " ").trim();

async function fetchImage(url: string): Promise<AiImage | null> {
  const mediaType = mediaTypeOf(url);
  if (!mediaType || !/^https:\/\//.test(url)) return null;
  try {
    const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return buf.length && buf.length <= MAX_IMAGE_BYTES ? { mediaType, data: buf.toString("base64") } : null;
  } catch {
    return null;
  }
}

// ------------------------------------------------------------------ reading the ticket
/** An open ticket: its Discord channel right now. */
async function fromChannel(ticket: Ticket): Promise<Source | null> {
  const live = await ticketLive(ticket.ticketId, null).catch(() => null);
  if (!live || live.gone || !live.messages.length) return null;
  const lines: Line[] = live.messages.map((m) => ({
    author: m.author,
    role: m.bot ? "bot" : m.authorId === ticket.openedBy ? "opener" : "staff",
    time: m.at,
    text: squash(
      [m.content, ...m.embeds.flatMap((e) => [e.title ?? "", e.description ?? "", ...e.fields.map((f) => `${f.name}: ${f.value}`)])].filter(Boolean).join(" | "),
    ),
    images: [...m.attachments.filter((a) => a.image).map((a) => a.url), ...m.embeds.map((e) => e.image).filter((x): x is string => Boolean(x))],
  }));
  return { key: `c:${live.messages[live.messages.length - 1].id}:${live.messages.length}`, lines, loadImage: fetchImage };
}

/** A closed ticket: its transcript (both the old and the current page layout). */
async function fromTranscript(ticket: Ticket): Promise<Source | null> {
  if (!ticket.transcriptId) return null;
  const id = ticket.transcriptId;
  const file = await openTranscriptFile(id, "index.html").catch(() => null);
  if (!file) return null;
  const data = await file.read(0, Math.max(0, file.size - 1));
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(await new Response(data).arrayBuffer());
  const root = parse(new TextDecoder().decode(bytes), { comment: false, blockTextElements: { script: false, style: false, noscript: false, pre: true } });
  const lines: Line[] = root.querySelectorAll(".msg").map((msg: HTMLElement) => {
    const author = msg.querySelector(".author");
    let name = "";
    for (const child of author?.childNodes ?? []) {
      const cls = (child as HTMLElement).getAttribute?.("class") ?? "";
      if (/staff-badge|claimer-badge|timestamp|userid/.test(cls)) continue;
      name += child.text;
    }
    name = squash(name.replace(/\(\d{5,25}\)/g, "")) || "Unknown";
    const authorId = msg.getAttribute("data-author-id") ?? "";
    const staff = /\bis-staff\b/.test(msg.getAttribute("class") ?? "") || Boolean(author?.querySelector(".staff-badge"));
    const bot = /\b(bot|app)\b/i.test(author?.querySelector(".staff-badge")?.text ?? "");
    const content = msg.querySelector(".content")?.text ?? "";
    const embeds = msg.querySelectorAll(".embed-box").map((e) => e.text);
    const images = msg
      .querySelectorAll(".attachment img, img.embed-image, img.attachment-preview")
      .map((img) => (img.getAttribute("src") ?? "").trim())
      .filter((src, i, all) => src && all.indexOf(src) === i && mediaTypeOf(src) && !/^avatars\/|emojis\//.test(src));
    return {
      author: name,
      role: bot ? "bot" : authorId && authorId === ticket.openedBy ? "opener" : staff ? "staff" : "other",
      time: squash(author?.querySelector(".timestamp")?.text ?? ""),
      text: squash([content, ...embeds].filter(Boolean).join(" | ")),
      images,
    };
  });
  if (!lines.length) return null;
  const loadImage = async (ref: string): Promise<AiImage | null> => {
    if (/^https:\/\//.test(ref)) return fetchImage(ref);
    const mediaType = mediaTypeOf(ref);
    if (!mediaType || ref.includes("..")) return null;
    const f = await openTranscriptFile(id, decodeURIComponent(ref)).catch(() => null);
    if (!f || f.size > MAX_IMAGE_BYTES) return null;
    const d = await f.read(0, Math.max(0, f.size - 1));
    const b = d instanceof Uint8Array ? d : new Uint8Array(await new Response(d).arrayBuffer());
    return { mediaType, data: Buffer.from(b).toString("base64") };
  };
  return { key: `t:${id}`, lines, loadImage };
}

// ------------------------------------------------------------------ asking Claude
const COMMON = `You write short labels for Discord support tickets for the staff of Bear Nation, an 18+ furry community server, so staff can tell tickets apart at a glance. Staff open the ticket themselves for details. Use staff display names. Call the member "the member" or leave them out. Never include ages, birthdays, real names, addresses or ID numbers.`;

const SYSTEM_GENERAL = `${COMMON}

Reply with ONE plain sentence, at most 18 words. No JSON, no quotes, no labels. Past tense, what the member wanted and what happened:
"Asked about an announcement, Sasha explained why it was made."
"Reported spam DMs from a new member with screenshots, Kai banned them."
"Lost 2,000 Leaves to a store bug, refunded by Sasha."
"Wanted to join the staff team, still waiting on an admin."
Mention screenshots only if they matter, saying what they show in a few words. If there's almost nothing: "Opened, no messages sent."`;

const SYSTEM_MANUAL = `${COMMON}

This is a manual ticket: staff opened it themselves to deal with something specific about a member. Reply with 1–2 plain sentences, at most 35 words. No JSON, no quotes, no labels. Say why staff opened it (the issue, who's involved, what the screenshots show), what was said, and how it ended:
"Sasha opened it over insults in #general (screenshots of three messages); the member apologized and got a warning."
"Kibby asked the member about an alt account seen in VC; they admitted it and the alt was banned."`;

const SYSTEM_NSFW = `You read the conversation of an 18+ (NSFW) verification ticket for the staff of Bear Nation, an 18+ furry community server. The member sends an ID photo (and usually a selfie) and staff check they're 18 or older. You only see the text, not the photos.

Reply with JSON only, nothing before or after it:
{"result": "verified" | "denied" | "pending" | "no-id", "by": "display name of the staff member who verified or denied, or null", "issues": [], "note": null}
- result: "verified" if staff approved them / gave access, "denied" if staff refused, "pending" if still waiting on staff, "no-id" if the member never sent an ID.
- issues: short problems staff mentioned in the chat, e.g. "ID photo blurry", "no selfie", "ID expired", "staff unsure the ID is real". Empty list if none.
- note: for denied or no-id, the reason in under 8 words; otherwise null.
- Never include ages, birthdays, names or ID numbers.`;

function buildText(ticket: Ticket, lines: Line[], refs: Map<string, number>) {
  const head = `Ticket #${ticket.ticketId} · type: ${ticket.type} · topic: ${ticket.topic || "none"} · status: ${ticket.status}${ticket.escalated ? " · escalated" : ""}`;
  const rows = lines.map((l) => {
    const pics = l.images.map((r) => (refs.has(r) ? ` [image ${refs.get(r)}]` : " [image]")).join("");
    const who = l.role === "bot" ? `${l.author} (bot)` : l.role === "opener" ? `${l.author} (member who opened it)` : l.role === "staff" ? `${l.author} (staff)` : l.author;
    return `${l.time ? `[${l.time}] ` : ""}${who}: ${l.text || "(no text)"}${pics}`;
  });
  let body = rows.join("\n");
  // Very long tickets: keep the start (what it's about) and the end (how it ended)
  if (body.length > MAX_TEXT) body = `${body.slice(0, MAX_TEXT / 3)}\n…(middle of the conversation left out)…\n${body.slice(-(MAX_TEXT * 2) / 3)}`;
  return `${head}\n\nConversation:\n${body}`;
}

/** Plain-text description, cleaned of anything that isn't the sentence(s): JSON (even cut off), code fences, quotes, labels. */
function plainLine(text: string, maxSentences: number, maxWords: number) {
  let out = text.trim().replace(/^```\w*|```$/g, "").trim();
  if (out.startsWith("{") || /"(headline|summary|description|line)"\s*:/.test(out)) {
    const m = /"(?:line|headline|description|summary)"\s*:\s*"((?:[^"\\]|\\.)*)/.exec(out);
    out = m ? m[1].replace(/\\"/g, '"') : out.replace(/[{}"]/g, " ");
  }
  out = squash(out.replace(/^(headline|summary|description|label|line)\s*[:\-–]\s*/i, "").replace(/^["'“”]+|["'“”]+$/g, ""));
  const sentences = out.match(/[^.!?]+[.!?]+(?=\s|$)/g) ?? [out];
  let line = squash(sentences.slice(0, maxSentences).join(" ")) || out;
  const words = line.split(" ");
  if (words.length > maxWords + 4) line = `${words.slice(0, maxWords).join(" ")}…`;
  if (!line) throw new AiError("The AI didn't send a description back.");
  return line.slice(0, 300);
}

type NsfwFacts = { roles: string[] | null; hasApp: boolean; joinDob: Date | null; joinAge: number | null; statedAge: number | null; appliedAt: Date | null };

/** For 18+ verification tickets: the member's roles now, and the birthday from their join application. */
async function nsfwFacts(ticket: Ticket): Promise<NsfwFacts | null> {
  if (!isNsfwTicket(ticket.type) || !ticket.openedBy) return null;
  const [roles, app] = await Promise.all([memberRoleIdsCached(ticket.openedBy).catch(() => null), getJoinApplication(ticket.openedBy)]);
  const birth = applicationBirthday(app);
  const at = app?.submittedAt ? new Date(String(app.submittedAt instanceof Date ? app.submittedAt.toISOString() : app.submittedAt)) : null;
  return { roles, hasApp: Boolean(app), joinDob: birth.birthDate, joinAge: birth.age, statedAge: parseAge(birth.raw) ?? statedAgeOf(birth.raw), appliedAt: at && !Number.isNaN(at.getTime()) ? at : null };
}

/** "22, 10/12/2001" or "22 - 10/12/2001": the age they wrote before the date. */
const statedAgeOf = (raw: string | null) => {
  const m = raw ? /^\s*(\d{2})\s*(?:[,/\-–|]|and\b|\s+\d)/i.exec(raw) : null;
  const n = m ? Number(m[1]) : NaN;
  return n >= 13 && n <= 99 ? n : null;
};

const mdy = (d: Date) => `${String(d.getUTCMonth() + 1).padStart(2, "0")}/${String(d.getUTCDate()).padStart(2, "0")}/${d.getUTCFullYear()}`;

/** "Verified by Oberon. DOB 10/12/2001 (Age: 25)" (DOB from their join application), plus flags worked out here. */
function nsfwLine(text: string, facts: NsfwFacts) {
  const raw = text.match(/\{[\s\S]*\}?/)?.[0] ?? "";
  let r: { result?: string; by?: string | null; issues?: string[]; note?: string | null } = {};
  // The reply can be cut off before its closing brace: try closing it, else read the fields one by one
  const tries = [raw, `${raw}}`, `${raw}"}`, `${raw}"]}`, `${raw}]}`];
  const parsed = tries.map((t) => {
    try {
      return JSON.parse(t) as typeof r;
    } catch {
      return null;
    }
  }).find(Boolean);
  if (parsed) r = parsed;
  else {
    const pick = (k: string) => new RegExp(`"${k}"\\s*:\\s*"([^"]*)"`).exec(raw)?.[1];
    const list = /"issues"\s*:\s*\[([^\]]*)/.exec(raw)?.[1] ?? "";
    r = { result: pick("result"), by: pick("by"), note: pick("note"), issues: Array.from(list.matchAll(/"([^"]+)"/g), (m) => m[1]) };
  }
  const by = r.by && r.by !== "null" ? r.by : "staff";
  const note = r.note && r.note !== "null" ? r.note.replace(/[.\s]+$/, "") : "";
  let line = !r.result
    ? plainLine(text, 1, 14)
    : r.result === "verified"
      ? `Verified by ${by}.`
      : r.result === "denied"
        ? `Denied by ${by}${note ? `: ${note}` : ""}.`
        : r.result === "no-id"
          ? `No ID sent${note ? `: ${note}` : ""}.`
          : "Waiting for review.";
  const flags: string[] = [];
  if (facts.joinDob) {
    const age = calculateAge(facts.joinDob);
    line += ` DOB ${mdy(facts.joinDob)} (Age: ${age})`;
    if (age < 18) flags.push("Join app says under 18");
    // The age they wrote vs the DOB they wrote, as of the day they applied
    if (facts.statedAge !== null && facts.appliedAt && Math.abs(facts.statedAge - calculateAge(facts.joinDob, facts.appliedAt)) >= 1) flags.push(`Join app age (${facts.statedAge}) doesn't match its DOB`);
  } else if (facts.joinAge !== null) {
    line += ` Age ${facts.joinAge} (join app, no DOB)`;
    if (facts.joinAge < 18) flags.push("Join app says under 18");
  } else {
    flags.push(facts.hasApp ? "No DOB on the join app" : "No join application found");
  }
  if (facts.roles === null) line += " Left the server.";
  else if (r.result === "verified" && !facts.roles.includes(ADULT_VERIFIED_ROLE)) flags.push("Doesn't have the 18+ Verified role");
  else if (r.result === "denied" && facts.roles.includes(ADULT_VERIFIED_ROLE)) flags.push("Denied here but has the 18+ Verified role");
  for (const issue of (Array.isArray(r.issues) ? r.issues : []).slice(0, 3)) if (typeof issue === "string" && issue.trim()) flags.push(squash(issue).slice(0, 60));
  return { line, flags };
}

// ------------------------------------------------------------------ public
const view = (d: Doc, stale: boolean): TicketSummary => ({
  ticketId: d._id,
  headline: d.headline,
  summary: d.summary,
  flags: d.flags ?? [],
  generatedAt: d.generatedAt?.toISOString() ?? null,
  checkedAt: d.checkedAt?.toISOString() ?? null,
  images: d.images ?? 0,
  messages: d.messages ?? 0,
  stale,
});

/** Saved summaries for these tickets (the page asks for the visible rows). `stale` = worth refreshing. */
export async function savedSummaries(tickets: Ticket[]) {
  const docs = await (await col()).find({ _id: { $in: tickets.map((t) => t.ticketId) } }).toArray();
  const byId = new Map(docs.map((d) => [d._id, d]));
  const out: Record<number, TicketSummary> = {};
  for (const t of tickets) {
    const d = byId.get(t.ticketId);
    if (!d) continue;
    const sinceCheck = Date.now() - (d.checkedAt?.getTime() ?? 0);
    const stale =
      (d.version ?? 1) !== VERSION ||
      (t.status === "Open" ? sinceCheck > RECHECK_MS : Boolean(t.transcriptId) && d.key.split("|")[0] !== `t:${t.transcriptId}`) ||
      // 18+ verification: look at the member's roles and join app again once a day (no AI call unless they changed)
      (isNsfwTicket(t.type) && sinceCheck > 86_400_000);
    out[t.ticketId] = view(d, stale);
  }
  return out;
}

/** Reads the ticket and writes (or refreshes) its summary. Only calls the AI when something changed. */
export async function summarizeTicket(ticketId: number, panel: PanelUser, force = false): Promise<TicketSummary> {
  if (!aiEnabled()) throw new SummaryError("AI summaries are off: add ANTHROPIC_API_KEY in Vercel.", 503);
  const ticket = await getTicket(ticketId);
  if (!ticket || (panel.level !== "admin" && isNsfwTicket(ticket.type))) throw new SummaryError("Ticket not found.", 404);
  const c = await col();
  const saved = await c.findOne({ _id: ticketId });

  const source = ticket.status === "Open" ? ((await fromChannel(ticket)) ?? (await fromTranscript(ticket))) : ((await fromTranscript(ticket)) ?? (await fromChannel(ticket)));
  if (!source) {
    if (saved) return view(saved, false);
    throw new SummaryError(ticket.transcriptId ? "Couldn't read this ticket's transcript." : "There's nothing left to read: this ticket has no transcript.", 404);
  }
  // 18+ verification: the member's roles and join-app birthday are part of the key (a change rewrites the line)
  const facts = await nsfwFacts(ticket);
  const key = facts ? `${source.key}|${facts.roles === null ? "left" : facts.roles.includes(ADULT_VERIFIED_ROLE) ? "18+" : "no18"}|${facts.joinDob?.toISOString().slice(0, 10) ?? facts.joinAge ?? "-"}` : source.key;
  if (saved && saved.key === key && (saved.version ?? 1) === VERSION && !force) {
    await c.updateOne({ _id: ticketId }, { $set: { checkedAt: new Date() } });
    return view({ ...saved, checkedAt: new Date() }, false);
  }

  // Every call to the AI counts (refreshes too), per UTC day
  const usage = (await getMongoClient()).db(process.env.MONGODB_DB ?? "website").collection<{ _id: string; n: number }>("ai_usage");
  const day = `ticket-summary:${new Date().toISOString().slice(0, 10)}`;
  const used = await usage.findOneAndUpdate({ _id: day }, { $inc: { n: 1 } }, { upsert: true, returnDocument: "after" });
  if ((used?.n ?? 1) > DAILY_LIMIT) {
    await usage.updateOne({ _id: day }, { $inc: { n: -1 } });
    throw new SummaryError(`The daily limit of ${DAILY_LIMIT} ticket summaries has been reached. Try again tomorrow.`, 429);
  }

  // Screenshots (never from 18+ verification tickets: those are ID photos): the member's first, then staff's, then the bot's
  const refs = new Map<string, number>();
  const parts: AiPart[] = [];
  if (!isNsfwTicket(ticket.type)) {
    const order = (role: Line["role"]) => (role === "opener" ? 0 : role === "bot" ? 2 : 1);
    const ordered = [...source.lines].sort((a, b) => order(a.role) - order(b.role)).flatMap((l) => l.images);
    for (const ref of ordered) {
      if (refs.size >= MAX_IMAGES || refs.has(ref)) continue;
      const img = await source.loadImage(ref);
      if (!img) continue;
      refs.set(ref, refs.size + 1);
      parts.push({ type: "text", text: `[image ${refs.size}]` }, { type: "image", image: img });
    }
  }
  parts.unshift({ type: "text", text: buildText(ticket, source.lines, refs) });

  const manual = /manual/i.test(ticket.type);
  const system = facts ? SYSTEM_NSFW : manual ? SYSTEM_MANUAL : SYSTEM_GENERAL;
  const text = await askClaude({ system, parts, maxTokens: facts ? 250 : manual ? 200 : 120 });
  const { line, flags } = facts ? nsfwLine(text, facts) : { line: plainLine(text, manual ? 2 : 1, manual ? 38 : 20), flags: [] as string[] };
  const now = new Date();
  const doc: Doc = { _id: ticketId, headline: line, summary: "", flags, key, version: VERSION, messages: source.lines.length, images: refs.size, model: AI_MODEL, generatedAt: now, checkedAt: now };
  await c.replaceOne({ _id: ticketId }, doc, { upsert: true });
  return view(doc, false);
}
