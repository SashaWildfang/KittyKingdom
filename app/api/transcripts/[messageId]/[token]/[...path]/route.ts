import { verifyMemberTranscriptToken } from "../../../../../../lib/member-transcripts";
import { getTicketByTranscript } from "../../../../../../lib/tickets";
import { LOCAL_TIMES_SCRIPT, localizeTranscriptTimes } from "../../../../../../lib/transcript-local-times";
import { requestTimeZone } from "../../../../../../lib/timezone";
import { TRANSCRIPT_CSS } from "../../../../../../lib/transcript-member-css";
import { TRANSCRIPT_CSS_FILE, memberMayLoad, memberTranscriptPage } from "../../../../../../lib/transcript-member";
import { transcriptLook } from "../../../../../../lib/bot-settings/live";
import { openTranscriptFile } from "../../../../../../lib/transcript-store";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const IMAGE_TYPES: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp" };

// The member copy runs sandboxed with no way to load media: only its own avatars/emojis and
// Discord's emoji CDN. Even a missed <img>/<video> for an upload could not load.
const PAGE_CSP = [
  "sandbox allow-scripts allow-popups allow-popups-to-escape-sandbox",
  "default-src 'none'",
  "img-src 'self' data: https://cdn.discordapp.com/emojis/",
  "media-src 'none'",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'unsafe-inline'",
  "connect-src 'none'",
  "frame-src 'none'",
  "form-action 'none'",
  "base-uri 'none'",
  "frame-ancestors 'self'",
].join("; ");

const base = { "Cache-Control": "private, max-age=3600", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer" };

/** A member's redacted transcript: the page, its stylesheet, and the avatars/emojis it shows. */
export async function GET(request: Request, { params }: { params: { messageId: string; token: string; path: string[] } }) {
  if (!verifyMemberTranscriptToken(params.messageId, params.token)) {
    return new Response("This transcript link has expired. Open it again from My Account → Transcripts.", { status: 403 });
  }
  const name = params.path.map((part) => decodeURIComponent(part)).join("/");

  if (name === "index.html") {
    const [ticket, style] = await Promise.all([getTicketByTranscript(params.messageId).catch(() => null), transcriptLook().catch(() => undefined)]);
    if (!ticket) return new Response("Transcript not found.", { status: 404 });
    const meta = { ticketId: ticket.ticketId, created: ticket.created, resolvedAt: ticket.resolvedAt, claimedBy: ticket.claimedBy, type: ticket.type, topic: ticket.topic, escalated: ticket.escalated };
    const page = await memberTranscriptPage(params.messageId, meta, LOCAL_TIMES_SCRIPT, style).catch((error) => {
      console.error("Member transcript failed", error);
      return null;
    });
    if (!page) return new Response("This transcript couldn't be loaded from Discord right now. Please try again in a minute.", { status: 502 });
    // Times in the viewer's own time zone (the site's kk_tz cookie, same as everywhere else)
    return new Response(localizeTranscriptTimes(page, requestTimeZone(request)), { headers: { ...base, "Cache-Control": "private, no-store", "Content-Type": "text/html; charset=utf-8", "Content-Security-Policy": PAGE_CSP } });
  }

  if (name === TRANSCRIPT_CSS_FILE || name === "style.css") {
    return new Response(TRANSCRIPT_CSS, { headers: { ...base, "Content-Type": "text/css; charset=utf-8" } });
  }

  // Profile pictures and custom emojis only: uploads, media embeds and stickers are never served here
  if (!memberMayLoad(name)) return new Response("Not available in your copy of the transcript.", { status: 404 });
  const file = await openTranscriptFile(params.messageId, name).catch(() => null);
  if (!file || file.size > 5 * 1024 * 1024) return new Response("File not found in transcript.", { status: 404 });
  let data: Uint8Array;
  try {
    const read = await file.read(0, Math.max(0, file.size - 1));
    data = read instanceof Uint8Array ? read : new Uint8Array(await new Response(read).arrayBuffer());
  } catch {
    return new Response("This file couldn't be loaded from Discord right now.", { status: 502 });
  }
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return new Response(new Uint8Array(data), {
    headers: { ...base, "Content-Type": IMAGE_TYPES[ext] ?? "application/octet-stream", "Content-Security-Policy": "sandbox; default-src 'none'" },
  });
}
