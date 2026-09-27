import { verifyTranscriptToken } from "../../../../../../../lib/admin";
import { transcriptFile } from "../../../../../../../lib/tickets";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

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
  { params }: { params: { messageId: string; token: string; path: string[] } },
) {
  if (!verifyTranscriptToken(params.messageId, params.token)) {
    return new Response("This transcript link has expired. Reopen it from the Admin tab.", { status: 403 });
  }

  const name = params.path.map((part) => decodeURIComponent(part)).join("/");
  const file = await transcriptFile(params.messageId, name).catch(() => null);
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

  // Byte ranges, so videos can be seeked (and play at all in Safari)
  let data = file;
  let status = 200;
  const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get("range") ?? "");
  if (range && (range[1] || range[2])) {
    const size = file.length;
    const start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]));
    const end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
    if (start >= size || start > end) {
      return new Response(null, { status: 416, headers: { ...headers, "Content-Range": `bytes */${size}` } });
    }
    data = file.subarray(start, end + 1);
    status = 206;
    headers["Content-Range"] = `bytes ${start}-${end}/${size}`;
  }
  headers["Content-Length"] = String(data.length);

  // Streamed in chunks so larger attachments (videos) aren't held back by response size limits
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const chunk = 256 * 1024;
      for (let i = 0; i < data.length; i += chunk) controller.enqueue(data.subarray(i, i + chunk));
      controller.close();
    },
  });
  return new Response(stream, { status, headers });
}
