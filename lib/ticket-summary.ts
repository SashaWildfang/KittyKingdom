// Admin → Tickets: a short description of each ticket, shown under it.
//  - Most tickets: one AI sentence ("Asked about an announcement, Sasha explained why it was made").
//  - Manual tickets (opened by staff): 1–3 sentences from the stronger model, with why it was opened.
//  - 18+ verification tickets: no AI at all. Built from our own data: "Verified by Oberon · Age Provided:
//    24, ID Age: 24 ✓", from the join application, the verification record the Ticket Bot saves
//    (users.nsfwIdDob, typed in by staff from the ID), their roles and whether they sent photos.
// Each description also gets tags (codes like "no-photo", "dob-mismatch") that the page can filter by.
// The AI reads the conversation and screenshots (from the live channel while open, the transcript once
// closed). ID photos are never sent anywhere.
//
// website.ticket_summaries {_id: ticketId, headline, flags, tags, key, version, messages, images, model, generatedAt, checkedAt}

import { Long } from "mongodb";
import { parse, type HTMLElement } from "node-html-parser";
import type { PanelUser } from "./admin";
import { people } from "./admin-people";
import { AI_MODEL, AI_MODEL_DETAILED, AiError, aiEnabled, askClaude, type AiImage, type AiPart } from "./ai";
import { calculateAge, parseAge } from "./dates";
import { memberRoleIdsCached } from "./discord-member";
import { applicationBirthday, getJoinApplication } from "./join-application";
import { getBotCollection, getMongoClient } from "./mongodb";
import { notify } from "./notifications";
import { ticketLive } from "./ticket-live";
import { getTicket, isNsfwTicket, type Ticket } from "./tickets";
import { openTranscriptFile } from "./transcript-store";

/** Bump when the wording rules change: saved descriptions from an older version are written again */
const VERSION = 6;
const MAX_IMAGES = 20;
const MAX_IMAGE_BYTES = 3_750_000;
const MAX_TEXT = 150_000;
/** 0 = no daily limit (TICKET_SUMMARY_DAILY_LIMIT sets one) */
const DAILY_LIMIT = Number(process.env.TICKET_SUMMARY_DAILY_LIMIT || 0);
const ADULT_VERIFIED_ROLE = "1358469974552870913";
/** Open tickets are checked for new messages at most this often */
export const RECHECK_MS = 10 * 60_000;
/** 18+ tickets cost nothing to rebuild (no AI): their roles / records are looked at again this often */
const NSFW_RECHECK_MS = 60 * 60_000;

/** Every tag the page can filter by. `bad` ones show red and some notify admins. */
export const TICKET_TAGS: Record<string, { label: string; bad: boolean }> = {
  "dob-mismatch": { label: "DOB mismatch", bad: true },
  "under-18": { label: "Under 18", bad: true },
  "no-photo": { label: "No photo submitted", bad: true },
  "no-join-app": { label: "No join application", bad: true },
  "no-app-dob": { label: "No DOB on join app", bad: true },
  "app-age-mismatch": { label: "Join app age ≠ its DOB", bad: true },
  "no-role": { label: "Verified, no 18+ role", bad: true },
  "id-not-recorded": { label: "ID DOB not recorded", bad: false },
  left: { label: "Left the server", bad: false },
  deleted: { label: "Deleted account", bad: false },
};

export class SummaryError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export type TicketSummary = { ticketId: number; headline: string; summary: string; flags: string[]; tags: string[]; generatedAt: string | null; checkedAt: string | null; images: number; messages: number; stale: boolean };

type Doc = { _id: number; headline: string; summary: string; flags?: string[]; tags?: string[]; key: string; version?: number; messages: number; images: number; model: string; generatedAt: Date; checkedAt: Date; notified?: boolean };

async function col() {
  const client = await getMongoClient();
  return client.db(process.env.MONGODB_DB ?? "website").collection<Doc>("ticket_summaries");
}

type Line = { author: string; authorId: string | null; role: "opener" | "staff" | "bot" | "other"; time: string; text: string; images: string[] };
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
    authorId: m.authorId,
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
      authorId: authorId || null,
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
const COMMON = `You write short labels for Discord support tickets for the staff of Bear Nation, an 18+ furry community server, so staff can tell tickets apart at a glance. Staff open the ticket themselves for details. Use staff display names. Call the member "the member" or leave them out. Never include ages, birthdays, real names, addresses or ID numbers. Always write a label from what's there, even if the ticket is messy; never say you can't.`;

const SYSTEM_GENERAL = `${COMMON}

Reply with ONE plain sentence, at most 18 words. No JSON, no quotes, no labels. Past tense, what the member wanted and what happened:
"Asked about an announcement, Sasha explained why it was made."
"Reported spam DMs from a new member with screenshots, Kai banned them."
"Lost 2,000 Leaves to a store bug, refunded by Sasha."
"Wanted to join the staff team, still waiting on an admin."
Mention screenshots only if they matter, saying what they show in a few words. If there's truly nothing: "Opened, no messages sent."`;

const SYSTEM_MANUAL = `${COMMON}

This is a manual ticket: a staff member opened it themselves to deal with something about a member (a rule break, a report against them, a question, an appeal, a check-in…). The first bot message may only say it was opened by staff: the reason is in what people say after it and in the screenshots, so read all of it.

Reply with 1–3 plain sentences, at most 50 words. No JSON, no quotes, no labels. Cover: why staff opened it (the issue, who's involved, what the screenshots show), what was said, and how it ended or what it's waiting on:
"Sasha opened it over insults in #general (screenshots of three messages); the member apologized and got a warning."
"Kibby asked the member about an alt account seen in VC; they admitted it and the alt was banned."
"Spindle checked in after reports of DM harassment (two screenshots); the member denied it and staff are still reviewing."`;

function buildText(ticket: Ticket, lines: Line[], refs: Map<string, number>) {
  const head = `Ticket #${ticket.ticketId} · type: ${ticket.type} · topic: ${ticket.topic || "none"} · status: ${ticket.status}${ticket.escalated ? " · escalated" : ""}`;
  const rows = lines.map((l) => {
    const pics = l.images.map((r) => (refs.has(r) ? ` [image ${refs.get(r)}]` : " [image]")).join("");
    const who = l.role === "bot" ? `${l.author} (bot)` : l.role === "opener" ? `${l.author} (member the ticket is for)` : l.role === "staff" ? `${l.author} (staff)` : l.author;
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
  if (words.length > maxWords + 6) line = `${words.slice(0, maxWords).join(" ")}…`;
  if (!line) throw new AiError("The AI didn't send a description back.");
  return line.slice(0, 400);
}

// ------------------------------------------------------------------ 18+ verification (no AI)
/** "22, 10/12/2001" or "22 - 10/12/2001": the age they wrote before the date (a plain date isn't an age). */
const statedAgeOf = (raw: string | null) => {
  if (!raw || /^\s*\d{1,4}[/.\-]\d{1,2}[/.\-]\d{1,4}/.test(raw)) return null;
  const m = /^\s*(\d{2})\s*(?:,|\s[-–|]\s|\band\b|\s+\d)/i.exec(raw);
  const n = m ? Number(m[1]) : NaN;
  return n >= 13 && n <= 99 ? n : null;
};
const mdy = (d: Date) => `${String(d.getUTCMonth() + 1).padStart(2, "0")}/${String(d.getUTCDate()).padStart(2, "0")}/${d.getUTCFullYear()}`;
const sameDay = (a: Date, b: Date) => a.toISOString().slice(0, 10) === b.toISOString().slice(0, 10);
const isoDate = (v: unknown) => {
  const m = typeof v === "string" ? /^(\d{4})-(\d{2})-(\d{2})/.exec(v) : null;
  const d = m ? new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))) : v instanceof Date ? v : null;
  return d && !Number.isNaN(d.getTime()) ? d : null;
};

async function nsfwDescription(ticket: Ticket, source: Source | null) {
  const id = ticket.openedBy;
  const [roles, app, record, who] = await Promise.all([
    id ? memberRoleIdsCached(id).catch(() => null) : Promise.resolve(null),
    id ? getJoinApplication(id) : Promise.resolve(null),
    // The bot stores ids as 64-bit numbers (a plain JS number would round them)
    id ? getBotCollection("users").then((c) => c.findOne({ discordId: { $in: [Long.fromString(id), id] } } as never, { projection: { nsfwVerifiedBy: 1, nsfwVerifiedAt: 1, nsfwIdDob: 1, verificationHistory: 1 } })).catch(() => null) : Promise.resolve(null),
    id ? people([id]).catch(() => ({}) as Record<string, { deleted?: boolean; inServer?: boolean }>) : Promise.resolve({} as Record<string, { deleted?: boolean; inServer?: boolean }>),
  ]);
  // Leaving resets verification (Moderation db/verification_reset.py): fall back to the last 18+ verification
  // in their history so older tickets still show what happened
  const past = ((record?.verificationHistory ?? []) as Record<string, unknown>[]).filter((h) => h.nsfwVerifiedAt || h.nsfwVerifiedBy).pop() ?? null;
  const fromHistory = !record?.nsfwVerifiedAt && !record?.nsfwVerifiedBy && Boolean(past);
  const rec = (fromHistory ? past : record) as Record<string, unknown> | null;
  const verifiedBy = rec?.nsfwVerifiedBy ? String(rec.nsfwVerifiedBy) : null;
  const verifierName = verifiedBy ? ((await people([verifiedBy]).catch(() => ({}) as Record<string, { name?: string }>))[verifiedBy]?.name ?? "staff") : null;
  const birth = applicationBirthday(app);
  const appDob = birth.birthDate;
  const idDob = isoDate(rec?.nsfwIdDob);
  const has18 = Boolean(roles?.includes(ADULT_VERIFIED_ROLE));
  const verified = Boolean(rec?.nsfwVerifiedAt || rec?.nsfwVerifiedBy) || has18;
  // Photos the member sent: the opener's, or on old transcripts without author ids, anyone who isn't staff or the bot
  const lines = source?.lines ?? [];
  const hasOpener = lines.some((l) => l.role === "opener");
  const photos = lines.filter((l) => (hasOpener ? l.role === "opener" : l.role === "other")).reduce((n, l) => n + l.images.length, 0);

  const tags: string[] = [];
  const parts: string[] = [];
  // Who verified them is already in the Handled by column, so it's only written when nobody's listed there
  const handled = Boolean(ticket.claimedBy || ticket.resolvedBy);
  if (!verified) parts.push(ticket.status === "Open" ? "Waiting for review" : "Not verified");
  else if (fromHistory) parts.push(handled ? "Verified (reset when they left)" : `Verified by ${verifierName ?? "staff"} (reset when they left)`);
  else if (!handled) parts.push(`Verified by ${verifierName ?? "staff"}`);
  const appAge = appDob ? calculateAge(appDob) : birth.age;
  const idAge = idDob ? calculateAge(idDob) : null;
  const match = appDob && idDob ? sameDay(appDob, idDob) : appAge !== null && idAge !== null ? appAge === idAge : null;
  parts.push(`Age Provided: ${appAge ?? "?"}, ID Age: ${idAge ?? "not recorded"}${match === true ? " ✓" : match === false ? " ✗" : ""}`);
  const flags: string[] = [];
  if (!app) tags.push("no-join-app");
  else if (!appDob) tags.push("no-app-dob");
  if (match === false) {
    tags.push("dob-mismatch");
    flags.push(`DOB mismatch: join app ${appDob ? mdy(appDob) : `age ${appAge}`}, ID ${idDob ? mdy(idDob) : `age ${idAge}`}`);
  }
  if ((appAge !== null && appAge < 18) || (idAge !== null && idAge < 18)) tags.push("under-18");
  const stated = statedAgeOf(birth.raw) ?? parseAge(birth.raw);
  const appliedAt = isoDate(app?.submittedAt instanceof Date ? app.submittedAt : typeof app?.submittedAt === "string" ? app.submittedAt : null);
  if (stated !== null && appDob && appliedAt && Math.abs(stated - calculateAge(appDob, appliedAt)) >= 1) tags.push("app-age-mismatch");
  if (source && photos === 0) tags.push("no-photo");
  if (verified && !idDob) tags.push("id-not-recorded");
  const person = id ? who[id] : undefined;
  if (person?.deleted) tags.push("deleted");
  else if (roles === null) tags.push("left");
  else if (verified && !has18 && !fromHistory) tags.push("no-role");
  for (const t of tags) if (TICKET_TAGS[t] && !(t === "dob-mismatch")) flags.push(TICKET_TAGS[t].label);
  const key = `nsfw|${source?.key ?? "-"}|${verifiedBy ?? "-"}|${idDob?.toISOString().slice(0, 10) ?? "-"}|${appDob?.toISOString().slice(0, 10) ?? appAge ?? "-"}|${appAge}|${idAge}|${roles === null ? "left" : has18 ? "18" : "no"}|${photos}`;
  return { line: parts.join(" · "), flags, tags, key, photos };
}

/** Admins (from the staff list the bot keeps) for alerts like a DOB mismatch. */
async function adminIds() {
  const client = await getMongoClient();
  const staff = await client.db(process.env.MONGODB_DB ?? "website").collection("staff").find({ role: { $regex: /^(owner|admin|sr\.? ?admin)$/i } }, { projection: { _id: 1 } }).toArray().catch(() => []);
  return staff.map((s) => String(s._id)).filter((x) => /^\d{15,21}$/.test(x));
}

// ------------------------------------------------------------------ public
const view = (d: Doc, stale: boolean): TicketSummary => ({
  ticketId: d._id,
  headline: d.headline,
  summary: d.summary,
  flags: d.flags ?? [],
  tags: d.tags ?? [],
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
      (isNsfwTicket(t.type)
        ? sinceCheck > (t.status === "Open" ? RECHECK_MS : NSFW_RECHECK_MS)
        : t.status === "Open"
          ? sinceCheck > RECHECK_MS
          : Boolean(t.transcriptId) && d.key.split("|")[0] !== `t:${t.transcriptId}`);
    out[t.ticketId] = view(d, stale);
  }
  return out;
}

/** Ticket numbers whose description has any of these tags (for the page's tag filter). */
export async function ticketIdsWithTags(tags: string[]) {
  if (!tags.length) return null;
  const docs = await (await col()).find({ tags: { $in: tags } }, { projection: { _id: 1 } }).toArray();
  return docs.map((d) => d._id);
}

/** How many tickets have each tag (for the filter menu). */
export async function tagCounts() {
  const rows = await (await col()).aggregate([{ $unwind: "$tags" }, { $group: { _id: "$tags", n: { $sum: 1 } } }]).toArray();
  return Object.fromEntries(rows.map((r) => [String(r._id), Number(r.n)])) as Record<string, number>;
}

/** Reads the ticket and writes (or refreshes) its description. Only calls the AI when something changed. */
export async function summarizeTicket(ticketId: number, panel: PanelUser, force = false): Promise<TicketSummary> {
  const ticket = await getTicket(ticketId);
  if (!ticket || (panel.level !== "admin" && isNsfwTicket(ticket.type))) throw new SummaryError("Ticket not found.", 404);
  const c = await col();
  const saved = await c.findOne({ _id: ticketId });
  const now = new Date();

  const source = ticket.status === "Open" ? ((await fromChannel(ticket)) ?? (await fromTranscript(ticket))) : ((await fromTranscript(ticket)) ?? (await fromChannel(ticket)));

  // 18+ verification: built from our own records, no AI (and never the ID photos)
  if (isNsfwTicket(ticket.type)) {
    const d = await nsfwDescription(ticket, source);
    if (saved && saved.key === d.key && (saved.version ?? 1) === VERSION && !force) {
      await c.updateOne({ _id: ticketId }, { $set: { checkedAt: now } });
      return view({ ...saved, checkedAt: now }, false);
    }
    const doc: Doc = { _id: ticketId, headline: d.line, summary: "", flags: d.flags, tags: d.tags, key: d.key, version: VERSION, messages: source?.lines.length ?? 0, images: 0, model: "records", generatedAt: now, checkedAt: now, notified: saved?.notified };
    // A closed ticket with a DOB mismatch, someone under 18 or no photos: tell the admins (once)
    const alarming = d.tags.filter((t) => ["dob-mismatch", "under-18", "no-photo"].includes(t));
    if (ticket.status !== "Open" && alarming.length && !saved?.notified) {
      doc.notified = true;
      const title = `⚠️ 18+ ticket #${ticketId}: ${alarming.map((t) => TICKET_TAGS[t].label).join(", ")}`;
      for (const to of await adminIds()) await notify(to, { type: "system", title, body: d.line, link: `/admin?tab=tickets&search=${ticketId}`, key: `ticket-flag:${ticketId}` }).catch(() => undefined);
    }
    await c.replaceOne({ _id: ticketId }, doc, { upsert: true });
    return view(doc, false);
  }

  if (!aiEnabled()) throw new SummaryError("AI summaries are off: add ANTHROPIC_API_KEY in Vercel.", 503);
  if (!source) {
    if (saved) return view(saved, false);
    throw new SummaryError(ticket.transcriptId ? "Couldn't read this ticket's transcript." : "There's nothing left to read: this ticket has no transcript.", 404);
  }
  if (saved && saved.key === source.key && (saved.version ?? 1) === VERSION && !force) {
    await c.updateOne({ _id: ticketId }, { $set: { checkedAt: now } });
    return view({ ...saved, checkedAt: now }, false);
  }

  if (DAILY_LIMIT > 0) {
    // Every call to the AI counts (refreshes too), per UTC day
    const usage = (await getMongoClient()).db(process.env.MONGODB_DB ?? "website").collection<{ _id: string; n: number }>("ai_usage");
    const day = `ticket-summary:${now.toISOString().slice(0, 10)}`;
    const used = await usage.findOneAndUpdate({ _id: day }, { $inc: { n: 1 } }, { upsert: true, returnDocument: "after" });
    if ((used?.n ?? 1) > DAILY_LIMIT) {
      await usage.updateOne({ _id: day }, { $inc: { n: -1 } });
      throw new SummaryError(`The daily limit of ${DAILY_LIMIT} ticket summaries has been reached. Try again tomorrow.`, 429);
    }
  }

  // Screenshots: the member's first, then staff's, then the bot's
  const refs = new Map<string, number>();
  const parts: AiPart[] = [];
  const order = (role: Line["role"]) => (role === "opener" ? 0 : role === "bot" ? 2 : 1);
  const ordered = [...source.lines].sort((a, b) => order(a.role) - order(b.role)).flatMap((l) => l.images);
  for (const ref of ordered) {
    if (refs.size >= MAX_IMAGES || refs.has(ref)) continue;
    const img = await source.loadImage(ref);
    if (!img) continue;
    refs.set(ref, refs.size + 1);
    parts.push({ type: "text", text: `[image ${refs.size}]` }, { type: "image", image: img });
  }
  parts.unshift({ type: "text", text: buildText(ticket, source.lines, refs) });

  const manual = /manual/i.test(ticket.type);
  const model = manual ? AI_MODEL_DETAILED : AI_MODEL;
  const text = await askClaude({ system: manual ? SYSTEM_MANUAL : SYSTEM_GENERAL, parts, maxTokens: manual ? 400 : 200, model });
  const line = plainLine(text, manual ? 3 : 1, manual ? 55 : 22);
  const doc: Doc = { _id: ticketId, headline: line, summary: "", flags: [], tags: [], key: source.key, version: VERSION, messages: source.lines.length, images: refs.size, model, generatedAt: now, checkedAt: now };
  await c.replaceOne({ _id: ticketId }, doc, { upsert: true });
  return view(doc, false);
}
