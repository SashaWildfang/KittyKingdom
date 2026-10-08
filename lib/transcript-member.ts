// Members' own copy of a ticket transcript, built on the website from the staff transcript in the
// log channel. Works for every transcript the bot ever made (the old single-column pages from before
// August 2026 and the current sidebar layout): the messages are read out of the page and drawn again
// in the current format, with every image, video, file, sticker and media embed swapped for a
// "redacted" note. Only avatars and custom emojis are kept.
//
// Redaction doesn't rely on this file alone: the member file route only ever serves avatars/ and
// emojis/ out of the zip, and the page's Content-Security-Policy blocks outside media.

import { parse, type HTMLElement, type Node } from "node-html-parser";
import { openTranscriptFile } from "./transcript-store";

const RENDER_VERSION = 3;
/** The current transcript stylesheet, served by both viewers (old zips carry an old style.css) */
export const TRANSCRIPT_CSS_FILE = "kk-transcript.css";

export type MemberTicketMeta = {
  ticketId: number;
  created: string | null;
  resolvedAt: string | null;
  claimedBy: string | null;
  type?: string | null;
  topic?: string | null;
  escalated?: boolean;
};

/** How transcripts look (Admin → Bots → Ticket Bot → Transcripts). */
export type TranscriptLook = {
  title: string;
  accent: string;
  groupMessages: boolean;
  dayDividers: boolean;
  staffBadges: boolean;
  memberNote: string;
};

export const DEFAULT_LOOK: TranscriptLook = {
  title: "Kitty Kingdom Support",
  accent: "#ff8b3d",
  groupMessages: true,
  dayDividers: true,
  staffBadges: true,
  memberNote: "This is your copy of the ticket. Images, videos, files and stickers are removed for privacy.",
};

// Set for the length of one (synchronous) build, like staffCopy
let look: TranscriptLook = DEFAULT_LOOK;

type Message = {
  authorId: string | null;
  name: string;
  avatar: string | null;
  badge: { text: string; cls: string } | null;
  time: string;
  reply: string | null;
  content: string;
  forwarded: string | null;
  embeds: string[];
  media: string[];
  reactions: string | null;
  buttons: { label: string; cls: string }[];
};

// ------------------------------------------------------------------
// Safe HTML: only formatting survives, media becomes a note
// ------------------------------------------------------------------
const escapeHtml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const KEEP = new Set(["b", "strong", "i", "em", "u", "s", "del", "strike", "code", "pre", "br", "span", "div", "p", "blockquote", "ul", "ol", "li", "mark", "small", "sub", "sup", "h1", "h2", "h3", "hr"]);
const DROP = new Set(["script", "style", "noscript", "template", "svg", "canvas", "form", "input", "button", "textarea", "select", "option", "link", "meta", "head", "title", "base", "source", "track"]);
const MEDIA = new Set(["video", "audio", "iframe", "object", "embed", "picture"]);
const VOID = new Set(["br", "hr"]);

const EMOJI_SRC = /^(?:emojis\/[\w.-]{1,80}|https:\/\/cdn\.discordapp\.com\/emojis\/\d{5,25}\.(?:png|gif|webp)(?:\?[\w=&.]{0,40})?)$/;
const AVATAR_SRC = /^avatars\/[\w.-]{1,80}$/;
// Links straight to files people uploaded (Discord's CDN, or the transcript's own folders)
const MEDIA_LINK = /^(?:https?:\/\/(?:cdn\.discordapp\.com|media\.discordapp\.net)\/(?:attachments|ephemeral-attachments|stickers)\/|attachments\/|embeds\/|stickers\/)/i;

export const redactedNote = (what: string) => `<div class="redacted-media">⚠️ [${what} Redacted for Privacy]</div>`;

// Staff copies (Admin viewer) keep every image, video and file; member copies redact them. The build
// is synchronous, so this is set for the length of one build.
let staffCopy = false;
// Media staff copies may show: files inside the transcript, or https links
const SAFE_MEDIA_SRC = /^(?:(?:attachments|embeds|stickers|avatars|emojis)\/(?!.*\.\.)[^"<>\s]{1,200}|https:\/\/[^"<>\s]{1,600})$/i;

function staffMedia(node: HTMLElement, tag: string) {
  const src = (node.getAttribute("src") ?? node.querySelector("source")?.getAttribute("src") ?? "").trim();
  if (!SAFE_MEDIA_SRC.test(src)) return "";
  const cls = classes(node.getAttribute("class"));
  const c = cls ? ` class="${cls}"` : "";
  if (tag === "img") return `<img${c} src="${escapeHtml(src)}" alt="${escapeHtml((node.getAttribute("alt") ?? "").slice(0, 80))}" loading="lazy">`;
  if (tag === "video") return `<video${c} src="${escapeHtml(src)}" controls preload="metadata" playsinline${node.getAttribute("autoplay") !== undefined ? " autoplay loop muted" : ""}></video>`;
  if (tag === "audio") return `<audio${c} src="${escapeHtml(src)}" controls preload="metadata"></audio>`;
  return "";
}

function classes(value: string | undefined) {
  return (value ?? "")
    .split(/\s+/)
    .filter((c) => /^[A-Za-z0-9_-]{1,40}$/.test(c))
    .slice(0, 6)
    .join(" ");
}

function isElement(node: Node): node is HTMLElement {
  return node.nodeType === 1;
}

function hasClass(el: HTMLElement, name: string) {
  return classes(el.getAttribute("class")).split(" ").indexOf(name) >= 0;
}

/** The node's children as safe HTML. */
export function safeInner(el: HTMLElement): string {
  return el.childNodes.map(safeNode).join("");
}

// Upload links typed or pasted into a message
const MEDIA_URL_TEXT = /https?:\/\/(?:cdn\.discordapp\.com|media\.discordapp\.net)\/(?:attachments|ephemeral-attachments)\/\S+/gi;

function safeText(text: string) {
  if (staffCopy) return escapeHtml(text);
  return escapeHtml(text).replace(MEDIA_URL_TEXT, '<span class="redacted-link">[media link removed]</span>');
}

function safeNode(node: Node): string {
  if (!isElement(node)) return node.nodeType === 3 ? safeText(node.text) : "";
  const tag = (node.rawTagName ?? "").toLowerCase();
  if (!tag) return safeInner(node);
  if (DROP.has(tag)) return "";
  if (MEDIA.has(tag)) {
    if (staffCopy) return tag === "video" || tag === "audio" ? staffMedia(node, tag) : "";
    return redactedNote(tag === "audio" ? "Audio" : tag === "video" ? "Video" : "Media");
  }
  if (tag === "img") {
    const src = (node.getAttribute("src") ?? "").trim();
    if (EMOJI_SRC.test(src)) {
      const alt = escapeHtml((node.getAttribute("alt") ?? "").slice(0, 60));
      return `<img class="chat-emoji" src="${escapeHtml(src)}" alt="${alt}" title="${alt}">`;
    }
    return staffCopy ? staffMedia(node, "img") : redactedNote("Image");
  }
  // Whole attachment / media-embed / sticker blocks from either format
  if (hasClass(node, "attachment") || hasClass(node, "missing-media") || hasClass(node, "redacted-media")) {
    return staffCopy ? `<div class="${classes(node.getAttribute("class"))}">${safeInner(node)}</div>` : redactedNote(mediaKind(node));
  }
  if (tag === "a") {
    const href = (node.getAttribute("href") ?? "").trim();
    if (MEDIA_LINK.test(href)) {
      if (!staffCopy) return `<span class="redacted-link">[media link removed]</span>`;
      if (SAFE_MEDIA_SRC.test(href)) return `<a href="${escapeHtml(href)}" class="${classes(node.getAttribute("class"))}" target="_blank" rel="noopener noreferrer">${safeInner(node)}</a>`;
    }
    const inner = safeInner(node);
    if (/^#user-\d{5,25}$/.test(href)) return `<a href="${href}" class="mention">${inner}</a>`;
    if (/^https?:\/\/[^\s"<>]{1,500}$/i.test(href)) return `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer nofollow">${inner}</a>`;
    return `<span class="${classes(node.getAttribute("class"))}">${inner}</span>`;
  }
  if (!KEEP.has(tag)) return safeInner(node);
  const cls = classes(node.getAttribute("class"));
  const title = node.getAttribute("title");
  const attrs = `${cls ? ` class="${cls}"` : ""}${title ? ` title="${escapeHtml(title.slice(0, 300))}"` : ""}`;
  return VOID.has(tag) ? `<${tag}${attrs}>` : `<${tag}${attrs}>${safeInner(node)}</${tag}>`;
}

function mediaKind(el: HTMLElement) {
  if (el.querySelector("video")) return "Video";
  if (el.querySelector("audio")) return "Audio";
  if (el.querySelector(".sticker-name") || /sticker/i.test(el.text)) return "Sticker";
  if (el.querySelector("img")) return "Image";
  if (/redacted/i.test(el.text)) {
    const m = /\[([^\]]{1,40}?) Redacted/i.exec(el.text);
    if (m) return m[1];
  }
  return "Attachment/Media";
}

// ------------------------------------------------------------------
// Reading messages out of either format
// ------------------------------------------------------------------
function textOf(el: HTMLElement | null) {
  return el ? el.text.replace(/\s+/g, " ").trim() : "";
}

function parseMessage(msg: HTMLElement): Message {
  const author = msg.querySelector(".author");
  const badgeEl = author?.querySelector(".staff-badge") ?? null;
  const userIdText = textOf(msg.querySelector(".userid"));
  const authorId = (msg.getAttribute("data-author-id") ?? "").match(/^\d{5,25}$/)?.[0] ?? userIdText.match(/\d{5,25}/)?.[0] ?? null;

  // Name: the author line without its badge, time and id
  let name = "";
  if (author) {
    for (const child of author.childNodes) {
      if (isElement(child) && (hasClass(child, "staff-badge") || hasClass(child, "timestamp") || hasClass(child, "userid"))) continue;
      name += child.nodeType === 3 ? child.text : isElement(child) ? child.text : "";
    }
  }
  name = name.replace(/\(\d{5,25}\)/g, "").replace(/\s+/g, " ").trim() || "Unknown";

  const avatarSrc = (msg.querySelector("img.avatar")?.getAttribute("src") ?? "").trim();
  const contentEl = msg.querySelector(".content");
  const body = msg.querySelector(".msg-content") ?? msg;

  let content = "";
  if (contentEl) content = safeInner(contentEl);
  else {
    // Unknown layout: everything in the message except the author line
    content = body.childNodes.filter((n) => !(isElement(n) && (hasClass(n, "author") || hasClass(n, "avatar")))).map(safeNode).join("");
  }

  // Media outside embeds (attachments, media embeds, stickers, notes about missing files)
  const media: string[] = [];
  for (const el of body.querySelectorAll(".attachment, .missing-media, .redacted-media")) {
    if (el.closest(".embed-box") || el.closest(".content") || el.closest(".forwarded")) continue;
    media.push(staffCopy ? safeNode(el) : redactedNote(mediaKind(el)));
  }
  for (const el of body.querySelectorAll("video, audio")) {
    if (el.closest(".attachment") || el.closest(".embed-box") || el.closest(".content")) continue;
    media.push(staffCopy ? safeNode(el) : redactedNote(el.rawTagName.toLowerCase() === "audio" ? "Audio" : "Video"));
  }
  // Loose images (not the avatar, not inside something already handled)
  for (const el of body.querySelectorAll("img")) {
    if (el.closest(".attachment") || el.closest(".embed-box") || el.closest(".content") || el.closest(".forwarded") || el.closest(".reactions") || el.closest(".author") || el.closest(".reply-line")) continue;
    if (hasClass(el, "avatar") || EMOJI_SRC.test((el.getAttribute("src") ?? "").trim())) continue;
    media.push(staffCopy ? `<div class="attachment">${safeNode(el)}</div>` : redactedNote("Image"));
  }

  const buttons = body.querySelectorAll(".discord-button, .button-row button").map((b) => ({
    label: safeInner(b),
    cls: classes(b.getAttribute("class")).split(" ").find((c) => /^btn-(primary|secondary|success|danger)$/.test(c)) ?? "btn-secondary",
  }));

  const reactions = body.querySelector(".reactions");
  const reactionUsers = body.querySelector(".reaction-users");
  const reply = body.querySelector(".reply-line");
  const forwarded = body.querySelector(".forwarded");

  return {
    authorId,
    name,
    avatar: AVATAR_SRC.test(avatarSrc) ? avatarSrc : null,
    badge: badgeEl ? { text: textOf(badgeEl), cls: classes(badgeEl.getAttribute("class")).split(" ").find((c) => /^badge-/.test(c)) ?? "badge-default" } : null,
    time: textOf(author?.querySelector(".timestamp") ?? msg.querySelector(".timestamp")),
    reply: reply ? safeInner(reply) : null,
    content,
    forwarded: forwarded ? safeInner(forwarded) : null,
    embeds: body
      .querySelectorAll(".embed-box")
      .filter((e) => !e.closest(".forwarded"))
      .map((e) => safeInner(e)),
    media,
    reactions: reactions ? safeInner(reactions) + (reactionUsers ? `<span class="reaction-users">${escapeHtml(textOf(reactionUsers))}</span>` : "") : null,
    buttons,
  };
}

/** "Opened by: Name" style values from the old or new info box. */
function metaValue(root: HTMLElement, label: RegExp) {
  for (const b of root.querySelectorAll(".meta-box b, .meta-box strong")) {
    if (!label.test(b.text)) continue;
    const siblings = b.parentNode ? b.parentNode.childNodes : [];
    let out = "";
    for (let i = siblings.indexOf(b) + 1; i < siblings.length; i++) {
      const node = siblings[i];
      if (isElement(node) && ["br", "b", "strong", "div"].indexOf(node.rawTagName.toLowerCase()) >= 0) break;
      out += node.text;
    }
    return out.replace(/\s+/g, " ").trim();
  }
  return "";
}

// ------------------------------------------------------------------
// Drawing the member page (the bot's current layout, media redacted)
// ------------------------------------------------------------------
const MT = new Intl.DateTimeFormat("en-US", { timeZone: "America/Denver", month: "2-digit", day: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true });

/** "09/27/2026 • 04:05 PM", the bot's own time format (the page script shows it in the viewer's zone). */
function mountainTime(iso: string | null) {
  if (!iso) return "Unknown";
  const p: Record<string, string> = {};
  MT.formatToParts(new Date(iso)).forEach((x) => (p[x.type] = x.value));
  return `${p.month}/${p.day}/${p.year} • ${p.hour}:${p.minute} ${String(p.dayPeriod ?? "").toUpperCase()}`;
}

function duration(from: string | null, to: string | null) {
  if (!from || !to) return "Unknown";
  let s = Math.max(0, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 1000));
  const d = Math.floor(s / 86400);
  s -= d * 86400;
  const h = Math.floor(s / 3600);
  s -= h * 3600;
  const m = Math.floor(s / 60);
  const parts = [d ? `${d}d` : "", h ? `${h}h` : "", m ? `${m}m` : ""].filter(Boolean);
  return parts.length ? parts.join(" ") : `${s}s`;
}

const SEARCH_SCRIPT = `<script>
(function () {
  var input = document.getElementById("searchInput");
  var count = document.getElementById("searchCount");
  var boxes = Array.prototype.slice.call(document.querySelectorAll(".filter-cb"));
  var msgs = Array.prototype.slice.call(document.querySelectorAll(".msg"));
  function clear() {
    Array.prototype.slice.call(document.querySelectorAll("mark[data-kk]")).forEach(function (m) {
      var parent = m.parentNode;
      parent.replaceChild(document.createTextNode(m.textContent), m);
      parent.normalize();
    });
  }
  function highlight(node, words) {
    var walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
    var nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(function (t) {
      var text = t.nodeValue, lower = text.toLowerCase(), frag = document.createDocumentFragment(), i = 0, hit = false;
      while (i < text.length) {
        var best = -1, len = 0;
        words.forEach(function (w) { var at = lower.indexOf(w, i); if (at >= 0 && (best < 0 || at < best)) { best = at; len = w.length; } });
        if (best < 0) break;
        hit = true;
        frag.appendChild(document.createTextNode(text.slice(i, best)));
        var mark = document.createElement("mark");
        mark.setAttribute("data-kk", "");
        mark.textContent = text.slice(best, best + len);
        frag.appendChild(mark);
        i = best + len;
      }
      if (!hit) return;
      frag.appendChild(document.createTextNode(text.slice(i)));
      t.parentNode.replaceChild(frag, t);
    });
  }
  function apply() {
    clear();
    var q = input.value.toLowerCase().trim();
    var words = q.split(/\\s+/).filter(Boolean);
    var ids = boxes.filter(function (b) { return b.checked; }).map(function (b) { return b.value; });
    var n = 0;
    msgs.forEach(function (m) {
      var okAuthor = !ids.length || ids.indexOf(m.getAttribute("data-author-id")) >= 0;
      var c = m.querySelector(".content");
      var okText = !words.length || (c && words.every(function (w) { return c.textContent.toLowerCase().indexOf(w) >= 0; }));
      m.style.display = okAuthor && okText ? "flex" : "none";
      if (okAuthor && okText && words.length && c) { highlight(c, words); n++; }
    });
    count.textContent = words.length ? n + " results" : "";
  }
  boxes.forEach(function (b) { b.addEventListener("change", apply); });
  input.addEventListener("input", apply);
})();
</script>`;

function badgeHtml(badge: Message["badge"], cls: "staff-badge" | "staff-team-badge") {
  return badge && look.staffBadges ? `<span class="${cls} ${badge.cls}">${escapeHtml(badge.text.toUpperCase())}</span>` : "";
}

// "09/27/2026 • 04:05 PM" (Mountain Time) -> day key and minutes, for day dividers and grouping
const MSG_TIME = /(\d{2})\/(\d{2})\/(\d{4}) • (\d{2}):(\d{2}) (AM|PM)/;
const DAY_LABEL = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "long", month: "long", day: "numeric", year: "numeric" });
function timeParts(text: string) {
  const m = MSG_TIME.exec(text);
  if (!m) return null;
  const [, mo, d, y, h, mi, ap] = m;
  const day = `${y}-${mo}-${d}`;
  const minutes = Date.UTC(Number(y), Number(mo) - 1, Number(d)) / 60000 + ((Number(h) % 12) + (ap === "PM" ? 12 : 0)) * 60 + Number(mi);
  return { day, minutes, label: DAY_LABEL.format(new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d), 12))), clock: `${h}:${mi} ${ap}` };
}

const TYPE_LABELS: Record<string, string> = { nsfw: "NSFW verification", support: "Support", "staff-application": "Staff application", manual: "Manual" };

function renderPage(meta: MemberTicketMeta, messages: Message[], people: { opener: string; closer: string }, fallbackBody: string | null, localTimesScript: string) {
  const created = mountainTime(meta.created);
  const closed = mountainTime(meta.resolvedAt);
  const accent = /^#[0-9a-f]{6}$/i.test(look.accent) ? look.accent : DEFAULT_LOOK.accent;
  const claimer = meta.claimedBy ? messages.find((m) => m.authorId === meta.claimedBy)?.name ?? null : null;
  const authors = new Set(messages.map((m) => m.authorId ?? m.name));
  const chips = [
    meta.type ? `<span class="tx-chip is-accent">${escapeHtml(TYPE_LABELS[meta.type] ?? meta.type)}</span>` : "",
    meta.escalated ? '<span class="tx-chip is-danger">Escalated</span>' : "",
    claimer ? `<span class="tx-chip">Claimed by ${escapeHtml(claimer)}</span>` : "",
    staffCopy ? '<span class="tx-chip">Staff copy</span>' : '<span class="tx-chip">Your copy</span>',
  ].join("");
  const out: string[] = [];
  out.push(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Ticket #${meta.ticketId} · ${escapeHtml(look.title)}</title>
<link rel="stylesheet" href="${TRANSCRIPT_CSS_FILE}">
<style>:root { --accent: ${accent}; }</style>
</head>
<body>
<div class="layout-container" id="top">
    <div class="main-content">
        <header class="tx-header">
            <p class="tx-kicker">${escapeHtml(look.title)}</p>
            <h1>Ticket #${meta.ticketId}</h1>
            <div class="tx-chips">${chips}</div>
            <div class="tx-stats">
                <div><small>Opened</small><b>${created} MT</b></div>
                <div><small>Closed</small><b>${closed} MT</b></div>
                <div><small>Open for</small><b>${duration(meta.created, meta.resolvedAt)}</b></div>
                <div><small>Messages</small><b>${messages.length}</b></div>
                <div><small>People</small><b>${authors.size}</b></div>
            </div>
        </header>
        <div class="header-times">Opened: ${created} MT | Closed: ${closed} MT</div>
        ${staffCopy || !look.memberNote.trim() ? "" : `<div class="member-note">🔒 ${escapeHtml(look.memberNote)}</div>`}
        <div class="tx-messages">
`);

  if (fallbackBody !== null) out.push(`<div class="fallback-body">${fallbackBody}</div>`);
  let prev = null as { author: string; minutes: number; day: string } | null;
  for (const m of messages) {
    const t = timeParts(m.time);
    if (look.dayDividers && t && t.day !== (prev ? prev.day : null)) {
      out.push(`<div class="day-divider"><span>${t.label}</span></div>`);
      prev = null;
    }
    const author = m.authorId ?? m.name;
    const continued = Boolean(look.groupMessages && prev && t && prev.author === author && t.minutes - prev.minutes <= 7 && m.reply === null);
    prev = t ? { author, minutes: t.minutes, day: t.day } : null;
    out.push(`
        <div class="msg${continued ? " is-continued" : ""}" data-author-id="${m.authorId ?? ""}">
            ${m.avatar ? `<img src="${m.avatar}" class="avatar" alt="">` : `<div class="participant-avatar-fallback avatar"></div>`}
            <div class="msg-content"${t ? ` data-time="${t.clock}"` : ""}>
                ${m.reply !== null ? `<div class="reply-line">${m.reply}</div>` : ""}
                <div class="author">${escapeHtml(m.name)} ${badgeHtml(m.badge, "staff-badge")} <span class="timestamp">${escapeHtml(m.time)}</span></div>
                <div class="content">${m.content}</div>`);
    if (m.forwarded !== null) out.push(`<div class="forwarded">${m.forwarded}</div>`);
    for (const e of m.embeds) out.push(`<div class="embed-box">${e}</div>`);
    out.push(...m.media);
    if (m.reactions !== null) out.push(`<div class="reactions">${m.reactions}</div>`);
    if (m.buttons.length) out.push(`<div class="button-row">${m.buttons.map((b) => `<div class="discord-button ${b.cls}">${b.label}</div>`).join("")}</div>`);
    out.push(`</div></div>`);
  }
  out.push(`
        </div>
        <div class="transcript-end" id="end">Ticket closed ${closed} MT</div>
    </div>
    <aside class="sidebar">
        <div class="meta-box">
            <b>Opened by:</b> ${escapeHtml(people.opener || "Unknown")}<br>
            <b>Closed by:</b> ${escapeHtml(people.closer || "Unknown")}<br>
            <b>Total Messages:</b> ${messages.length}
            <div class="search-container">
                <input type="text" id="searchInput" placeholder="Search messages…" aria-label="Search messages">
                <span id="searchCount"></span>
                <div class="tx-jump"><a href="#top">↑ Top</a><a href="#end">↓ End</a></div>
            </div>
        </div>
        <div class="participants-box">
            <b>Participants</b>`);

  // Everyone who wrote, staff first, then by how much they wrote
  const seen = new Map<string, { m: Message; count: number }>();
  for (const m of messages) {
    const key = m.authorId ?? m.name;
    const row = seen.get(key);
    if (row) row.count += 1;
    else seen.set(key, { m, count: 1 });
  }
  const rows = Array.from(seen.values()).sort((a, b) => Number(Boolean(b.m.badge)) - Number(Boolean(a.m.badge)) || b.count - a.count);
  for (const { m, count } of rows) {
    const claimerTag = meta.claimedBy && m.authorId === meta.claimedBy ? '<span class="claimer-badge">CLAIMER</span>' : "";
    out.push(`
        <label ${m.authorId ? `id="user-${m.authorId}" ` : ""}class="participant-row">
            <input type="checkbox" class="filter-cb" value="${m.authorId ?? ""}">
            ${m.avatar ? `<img src="${m.avatar}" class="participant-avatar" alt="">` : '<div class="participant-avatar-fallback"></div>'}
            <div class="participant-info">
                <div class="participant-name-row"><b>${escapeHtml(m.name)}</b> ${badgeHtml(m.badge, "staff-team-badge")} ${claimerTag}</div>
                ${m.authorId ? `<div class="participant-id">${m.authorId}</div>` : ""}
                <div class="participant-msgs">${count} message${count === 1 ? "" : "s"}</div>
            </div>
        </label>`);
  }
  out.push(`
        </div>
    </aside>
</div>
${SEARCH_SCRIPT}
${localTimesScript}
</body></html>`);
  return out.join("\n");
}

// ------------------------------------------------------------------
// Public
// ------------------------------------------------------------------
/** Turns a staff transcript page (old or new format) into the member's redacted copy. */
export function buildMemberTranscript(staffHtml: string, meta: MemberTicketMeta, localTimesScript = "", style: TranscriptLook = DEFAULT_LOOK) {
  staffCopy = false;
  look = style;
  try {
    return buildTranscript(staffHtml, meta, localTimesScript);
  } finally {
    look = DEFAULT_LOOK;
  }
}

/** A staff transcript (any format) redrawn in the current layout, with all its media (Admin viewer). */
export function buildStaffTranscript(staffHtml: string, meta: MemberTicketMeta, localTimesScript = "", style: TranscriptLook = DEFAULT_LOOK) {
  staffCopy = true;
  look = style;
  try {
    return buildTranscript(staffHtml, meta, localTimesScript);
  } finally {
    staffCopy = false;
    look = DEFAULT_LOOK;
  }
}

/** Pages the bot made before the sidebar layout (August 2026). */
export function isOldTranscript(html: string) {
  return !html.includes("layout-container");
}

function buildTranscript(staffHtml: string, meta: MemberTicketMeta, localTimesScript: string) {
  const root = parse(staffHtml, { comment: false, blockTextElements: { script: false, style: false, noscript: false, pre: true } });
  const messages = root.querySelectorAll(".msg").map(parseMessage);
  const people = { opener: metaValue(root, /opened by/i), closer: metaValue(root, /(deleted|closed) by/i) };
  if (!people.opener && messages.length) people.opener = messages[0].name;
  // Nothing recognisable: keep the page's text (still fully redacted) rather than show nothing
  const body = root.querySelector("body") ?? root;
  const fallback = messages.length ? null : safeInner(body);
  return renderPage(meta, messages, people, fallback, localTimesScript);
}

const rendered = new Map<string, string>();

/** The member copy of a transcript, cached for a while since it never changes. */
export async function memberTranscriptPage(messageId: string, meta: MemberTicketMeta, localTimesScript: string, style: TranscriptLook = DEFAULT_LOOK) {
  const key = `${RENDER_VERSION}:${messageId}:${JSON.stringify(style)}`;
  const hit = rendered.get(key);
  if (hit) return hit;
  const file = await openTranscriptFile(messageId, "index.html");
  if (!file) return null;
  const data = await file.read(0, Math.max(0, file.size - 1));
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(await new Response(data).arrayBuffer());
  const page = buildMemberTranscript(new TextDecoder().decode(bytes), meta, localTimesScript, style);
  rendered.set(key, page);
  while (rendered.size > 40) rendered.delete(rendered.keys().next().value as string);
  return page;
}

/** Files a member's copy may load from the zip: profile pictures and custom emojis, nothing else. */
export function memberMayLoad(path: string) {
  return /^(?:avatars|emojis)\/[\w.-]{1,80}\.(?:png|jpe?g|gif|webp)$/i.test(path);
}
