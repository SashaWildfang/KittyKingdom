// Admin → Tickets: a one-line AI description of each ticket ("Asked about an announcement, Sasha explained
// why it was made"). Staff who want more open the ticket.
// Claude reads the conversation and up to MAX_IMAGES screenshots: from the live Discord channel while
// the ticket is open, and from its transcript once it's closed. Summaries are saved, so each ticket is
// only read again when something new happened (a new message, or the transcript arriving).
//
// Privacy: NSFW verification tickets hold ID photos, so their images are never sent. Their outcome comes
// from the server instead: whether the member has the 18+ Verified role now.
//
// website.ticket_summaries {_id: ticketId, headline, summary, key, messages, images, model, generatedAt, checkedAt}

import { parse, type HTMLElement } from "node-html-parser";
import type { PanelUser } from "./admin";
import { AI_MODEL, AiError, aiEnabled, askClaude, type AiImage, type AiPart } from "./ai";
import { memberRoleIdsCached } from "./discord-member";
import { getMongoClient } from "./mongodb";
import { ticketLive } from "./ticket-live";
import { getTicket, isNsfwTicket, type Ticket } from "./tickets";
import { openTranscriptFile } from "./transcript-store";

const MAX_IMAGES = 4;
/** Bump when the wording rules change: saved descriptions from an older version are written again */
const VERSION = 2;
const ADULT_VERIFIED_ROLE = "1358469974552870913";
const MEMBER_ROLE = "1358469854725931038";
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

export type TicketSummary = { ticketId: number; headline: string; summary: string; generatedAt: string | null; checkedAt: string | null; images: number; messages: number; stale: boolean };

type Doc = { _id: number; headline: string; summary: string; key: string; version?: number; messages: number; images: number; model: string; generatedAt: Date; checkedAt: Date };

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
const SYSTEM = `You label Discord support tickets for the staff of Bear Nation, an 18+ furry community server, so staff can tell tickets apart at a glance. Staff open the ticket themselves if they want details.

Reply with ONE short plain sentence, at most 15 words. No JSON, no quotes, no headline, no labels, no lists.
- Say what the member wanted and what happened, past tense, like:
  "Asked about an announcement, Sasha explained why it was made."
  "Reported spam DMs from a new member with screenshots, Kai banned them."
  "Lost 2,000 Leaves to a store bug, refunded by Sasha."
  "Wanted to join the staff team, still waiting on an admin."
- Use staff display names. Call the member "the member" or leave them out.
- Mention screenshots only if they matter, in a few words ("with screenshots of the DMs").
- Never include ages, birthdays, real names, addresses or ID numbers.
- 18+ verification tickets: just the result, e.g. "18+ verification, approved (now 18+ Verified)." or "18+ verification, denied: ID unreadable." Use the "Server check" line for whether they're verified now.
- If there's almost nothing in the ticket, say so in a few words ("Opened, no messages sent.").`;

function buildText(ticket: Ticket, lines: Line[], refs: Map<string, number>, serverCheck: string | null) {
  const head = `Ticket #${ticket.ticketId} · type: ${ticket.type} · topic: ${ticket.topic || "none"} · status: ${ticket.status}${ticket.escalated ? " · escalated" : ""}${serverCheck ? `\nServer check: ${serverCheck}` : ""}`;
  const rows = lines.map((l) => {
    const pics = l.images.map((r) => (refs.has(r) ? ` [image ${refs.get(r)}]` : " [image not included]")).join("");
    const who = l.role === "bot" ? `${l.author} (bot)` : l.role === "opener" ? `${l.author} (member who opened it)` : l.role === "staff" ? `${l.author} (staff)` : l.author;
    return `${l.time ? `[${l.time}] ` : ""}${who}: ${l.text || "(no text)"}${pics}`;
  });
  let body = rows.join("\n");
  // Very long tickets: keep the start (what it's about) and the end (how it ended)
  if (body.length > MAX_TEXT) body = `${body.slice(0, MAX_TEXT / 3)}\n…(middle of the conversation left out)…\n${body.slice(-(MAX_TEXT * 2) / 3)}`;
  return `${head}\n\nConversation:\n${body}`;
}

/** The one-line description, cleaned of anything that isn't the sentence (JSON, quotes, labels, code fences). */
function parseReply(text: string) {
  let out = text.trim().replace(/^```\w*|```$/g, "").trim();
  // Older habits: {"headline": "...", "summary": "..."}: keep the shortest useful part
  if (/^\{[\s\S]*\}$/.test(out)) {
    try {
      const v = JSON.parse(out) as Record<string, unknown>;
      out = String(v.description ?? v.headline ?? v.summary ?? Object.values(v)[0] ?? "");
    } catch {
      out = out.replace(/"(headline|summary|description)"\s*:\s*/gi, "").replace(/[{}"]/g, " ");
    }
  }
  out = squash(out.replace(/^(headline|summary|description|label)\s*[:\-–]\s*/i, "").replace(/^["'“”]+|["'“”]+$/g, ""));
  // One sentence, ~20 words at most
  const first = out.match(/^.*?[.!?](?=\s|$)/)?.[0] ?? out;
  const words = first.split(" ");
  const line = words.length > 22 ? `${words.slice(0, 20).join(" ")}…` : first;
  if (!line) throw new AiError("The AI didn't send a description back.");
  return { headline: line.slice(0, 200), summary: "" };
}

/** For 18+ verification tickets: the result, read from the server rather than from the ID photos. */
async function serverCheck(ticket: Ticket) {
  if (!isNsfwTicket(ticket.type) || !ticket.openedBy) return null;
  const roles = await memberRoleIdsCached(ticket.openedBy).catch(() => null);
  if (!roles) return "the member isn't in the server any more (or couldn't be checked).";
  if (roles.includes(ADULT_VERIFIED_ROLE)) return "the member HAS the 18+ Verified role now.";
  return `the member does NOT have the 18+ Verified role${roles.includes(MEMBER_ROLE) ? " (they are a verified member)" : ""}.`;
}

// ------------------------------------------------------------------ public
const view = (d: Doc, stale: boolean): TicketSummary => ({
  ticketId: d._id,
  headline: d.headline,
  summary: d.summary,
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
    const stale =
      (d.version ?? 1) !== VERSION || (t.status === "Open" ? Date.now() - (d.checkedAt?.getTime() ?? 0) > RECHECK_MS : Boolean(t.transcriptId) && d.key !== `t:${t.transcriptId}`);
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
  if (saved && saved.key === source.key && (saved.version ?? 1) === VERSION && !force) {
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

  // Screenshots: the member's and staff's own images first, never any from NSFW verification tickets
  const refs = new Map<string, number>();
  const parts: AiPart[] = [];
  if (!isNsfwTicket(ticket.type)) {
    const ordered = [...source.lines.filter((l) => l.role !== "bot"), ...source.lines.filter((l) => l.role === "bot")].flatMap((l) => l.images);
    for (const ref of ordered) {
      if (refs.size >= MAX_IMAGES || refs.has(ref)) continue;
      const img = await source.loadImage(ref);
      if (!img) continue;
      refs.set(ref, refs.size + 1);
      parts.push({ type: "text", text: `[image ${refs.size}]` }, { type: "image", image: img });
    }
  }
  parts.unshift({ type: "text", text: buildText(ticket, source.lines, refs, await serverCheck(ticket)) });

  const reply = parseReply(await askClaude({ system: SYSTEM, parts, maxTokens: 120 }));
  const now = new Date();
  const doc: Doc = { _id: ticketId, ...reply, key: source.key, version: VERSION, messages: source.lines.length, images: refs.size, model: AI_MODEL, generatedAt: now, checkedAt: now };
  await c.replaceOne({ _id: ticketId }, doc, { upsert: true });
  return view(doc, false);
}
