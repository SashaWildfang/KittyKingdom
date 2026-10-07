import { verifyTranscriptToken } from "../../../../../../../lib/admin";
import { LOCAL_TIMES_SCRIPT, localizeTranscriptTimes } from "../../../../../../../lib/transcript-local-times";
import { requestTimeZone } from "../../../../../../../lib/timezone";
import { getTicketByTranscript } from "../../../../../../../lib/tickets";
import { TRANSCRIPT_CSS } from "../../../../../../../lib/transcript-member-css";
import { TRANSCRIPT_CSS_FILE, buildStaffTranscript, isOldTranscript } from "../../../../../../../lib/transcript-member";
import { openTranscriptFile } from "../../../../../../../lib/transcript-store";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const RANGE_PIECE = 8 * 1024 * 1024;

const TYPES: Record<string, string> = {
  html: "text/html; charset=utf-8",
  css: "text/css; charset=utf-8",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
  bmp: "image/bmp",
  svg: "image/svg+xml",
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  m4v: "video/mp4",
  m4a: "audio/mp4",
  flac: "audio/flac",
  opus: "audio/ogg",
  mp3: "audio/mpeg",
  ogg: "audio/ogg",
  wav: "audio/wav",
  txt: "text/plain; charset=utf-8",
  json: "application/json",
  pdf: "application/pdf",
};

// The transcript is a web page generated from members' messages, so it runs sandboxed:
// its own search script works, but it can't reach the site, cookies or other pages.
const HTML_CSP = [
  "sandbox allow-scripts allow-popups allow-popups-to-escape-sandbox",
  "default-src 'self' data: blob:",
  "img-src 'self' data: blob: https://cdn.discordapp.com https://media.discordapp.net",
  "media-src 'self' data: blob:",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "script-src 'unsafe-inline'",
  "connect-src 'none'",
  "form-action 'none'",
  "frame-ancestors 'self'",
].join("; ");

export async function GET(
  request: Request,
  props: { params: Promise<{ messageId: string; token: string; path: string[] }> }
) {
  const params = await props.params;
  if (!verifyTranscriptToken(params.messageId, params.token)) {
    return new Response("This transcript link has expired. Reopen it from the Admin tab.", { status: 403 });
  }

  const name = params.path.map((part) => decodeURIComponent(part)).join("/");
  // The current stylesheet, for old transcripts redrawn in the current layout
  if (name === TRANSCRIPT_CSS_FILE) {
    return new Response(TRANSCRIPT_CSS, { headers: { "Content-Type": "text/css; charset=utf-8", "Cache-Control": "private, max-age=3600", "X-Content-Type-Options": "nosniff" } });
  }
  const file = await openTranscriptFile(params.messageId, name).catch(() => null);
  if (!file) return new Response("File not found in transcript.", { status: 404 });

  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const headers: Record<string, string> = {
    "Content-Type": TYPES[ext] ?? "application/octet-stream",
    "Cache-Control": "private, max-age=3600",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "Accept-Ranges": "bytes",
  };
  if (ext === "html" || ext === "svg") headers["Content-Security-Policy"] = HTML_CSP;
  else headers["Content-Security-Policy"] = "sandbox; default-src 'none'; img-src 'self'; media-src 'self'; style-src 'unsafe-inline'";
  if (!TYPES[ext]) headers["Content-Disposition"] = `attachment; filename="${name.split("/").pop()?.replace(/"/g, "") ?? "file"}"`;

  if (ext === "html") {
    const bytes = await file.read(0, Math.max(0, file.size - 1)).catch(() => null);
    if (!bytes) return new Response("This file couldn't be loaded from Discord right now. Try again.", { status: 502 });
    let page = new TextDecoder().decode(bytes instanceof Uint8Array ? bytes : new Uint8Array(await new Response(bytes).arrayBuffer()));
    // Transcripts from before the sidebar layout are redrawn in the current format (media kept)
    if (name === "index.html" && isOldTranscript(page)) {
      const ticket = await getTicketByTranscript(params.messageId).catch(() => null);
      if (ticket) {
        try {
          page = buildStaffTranscript(page, { ticketId: ticket.ticketId, created: ticket.created, resolvedAt: ticket.resolvedAt, claimedBy: ticket.claimedBy }, LOCAL_TIMES_SCRIPT);
        } catch (error) {
          console.error("Converting an old transcript failed; showing the original", error);
        }
      }
    }
    page = localizeTranscriptTimes(page, requestTimeZone(request));
    headers["Cache-Control"] = "private, no-store";
    if (!page.includes("data-kk-local-times")) page = page.includes("</body>") ? page.replace("</body>", `${LOCAL_TIMES_SCRIPT}</body>`) : page + LOCAL_TIMES_SCRIPT;
    delete headers["Accept-Ranges"];
    return new Response(page, { headers });
  }

  // Byte ranges, so videos can be seeked (and play at all in Safari). Open-ended ranges are
  // answered a piece at a time; players ask for the rest as they go.
  const size = file.size;
  let start = 0;
  let end = size - 1;
  let status = 200;
  const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get("range") ?? "");
  if (range && (range[1] || range[2])) {
    start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]));
    end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : Math.min(size - 1, start + RANGE_PIECE - 1);
    if (start >= size || start > end) {
      return new Response(null, { status: 416, headers: { ...headers, "Content-Range": `bytes */${size}` } });
    }
    status = 206;
    headers["Content-Range"] = `bytes ${start}-${end}/${size}`;
  }
  headers["Content-Length"] = String(end - start + 1);
  if (size === 0) return new Response(new Uint8Array(0), { status: 200, headers });

  let body: ReadableStream<Uint8Array> | Uint8Array;
  try {
    body = await file.read(start, end);
  } catch {
    return new Response("This file couldn't be loaded from Discord right now. Try again.", { status: 502 });
  }
  if (body instanceof Uint8Array) {
    // Streamed in chunks so larger attachments aren't held back by response size limits
    const data = body;
    body = new ReadableStream<Uint8Array>({
      start(controller) {
        const chunk = 256 * 1024;
        for (let i = 0; i < data.length; i += chunk) controller.enqueue(data.subarray(i, i + chunk));
        controller.close();
      },
    });
  }
  return new Response(body, { status, headers });
}
