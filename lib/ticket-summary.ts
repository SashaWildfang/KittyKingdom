// Admin → Tickets: a short AI description of each ticket (a headline and 2–3 specific sentences).
// Claude reads the conversation and up to MAX_IMAGES screenshots: from the live Discord channel while
// the ticket is open, and from its transcript once it's closed. Summaries are saved, so each ticket is
// only read again when something new happened (a new message, or the transcript arriving).
//
// Privacy: NSFW verification tickets hold ID photos, so their images are never sent, and the AI is
// told to leave out ages, birthdays, real names, ID numbers and other personal details.
//
// website.ticket_summaries {_id: ticketId, headline, summary, key, messages, images, model, generatedAt, checkedAt}

import { parse, type HTMLElement } from "node-html-parser";
import type { PanelUser } from "./admin";
import { AI_MODEL, AiError, aiEnabled, askClaude, type AiImage, type AiPart } from "./ai";
import { getMongoClient } from "./mongodb";
import { ticketLive } from "./ticket-live";
import { getTicket, isNsfwTicket, type Ticket } from "./tickets";
import { openTranscriptFile } from "./transcript-store";

const MAX_IMAGES = 6;
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

type Doc = { _id: number; headline: string; summary: string; key: string; messages: number; images: number; model: string; generatedAt: Date; checkedAt: Date };

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
const SYSTEM = `You write short descriptions of Discord support tickets for the staff team of Bear Nation, an 18+ furry community server, so staff can tell what each ticket was about at a glance.

Reply with JSON only: {"headline": "...", "summary": "..."}
- headline: at most 9 words, specific (e.g. "Report: harassment in #general by a new member", "Lost 5,000 Leaves after a store purchase bug", "Asked to change their verified 18+ role").
- summary: 2–3 sentences. Be concrete: what the member wanted or reported, the key details (names of people involved, channels, amounts, items, rule numbers, dates), what any screenshots actually show, what staff said or did, and how it ended (or that it's still waiting on someone).
- Refer to the member who opened it as "the member" (or by their display name), and to staff by display name.
- Never include ages, birthdays, real names, addresses, ID numbers, or anything read off an ID document or other personal documents. For verification tickets just say whether it was approved, denied or is pending, and why if staff said.
- Don't guess. If there's very little in the ticket, say so briefly.`;

function buildText(ticket: Ticket, lines: Line[], refs: Map<string, number>) {
  const head = `Ticket #${ticket.ticketId} · type: ${ticket.type} · topic: ${ticket.topic || "none"} · status: ${ticket.status}${ticket.escalated ? " · escalated" : ""}`;
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

function parseReply(text: string) {
  const json = text.match(/\{[\s\S]*\}/)?.[0];
  try {
    const v = JSON.parse(json ?? "") as { headline?: unknown; summary?: unknown };
    const headline = squash(String(v.headline ?? "")).slice(0, 120);
    const summary = squash(String(v.summary ?? "")).slice(0, 900);
    if (headline || summary) return { headline, summary };
  } catch {
    // fall through
  }
  const plain = squash(text);
  if (!plain) throw new AiError("The AI didn't send a description back.");
  return { headline: plain.split(/(?<=[.!?])\s/)[0].slice(0, 120), summary: plain.slice(0, 900) };
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
    const stale = t.status === "Open" ? Date.now() - (d.checkedAt?.getTime() ?? 0) > RECHECK_MS : Boolean(t.transcriptId) && d.key !== `t:${t.transcriptId}`;
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
  if (saved && saved.key === source.key && !force) {
    await c.updateOne({ _id: ticketId }, { $set: { checkedAt: new Date() } });
    return view({ ...saved, checkedAt: new Date() }, false);
  }

  const since = new Date(Date.now() - 86_400_000);
  if ((await c.countDocuments({ generatedAt: { $gte: since } })) >= DAILY_LIMIT) throw new SummaryError(`The daily limit of ${DAILY_LIMIT} ticket summaries has been reached. Try again tomorrow.`, 429);

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
  parts.unshift({ type: "text", text: buildText(ticket, source.lines, refs) });

  const reply = parseReply(await askClaude({ system: SYSTEM, parts, maxTokens: 500 }));
  const now = new Date();
  const doc: Doc = { _id: ticketId, ...reply, key: source.key, messages: source.lines.length, images: refs.size, model: AI_MODEL, generatedAt: now, checkedAt: now };
  await c.replaceOne({ _id: ticketId }, doc, { upsert: true });
  return view(doc, false);
}
