import { NextResponse } from "next/server";
import { requirePanel } from "../../../../../../../../lib/admin";
import { RemovedError, storedFile } from "../../../../../../../../lib/removed-messages";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Admins: one stored media file from a removed-messages archive, streamed from Discord (ranges pass through for video). */
export async function GET(request: Request, { params }: { params: { c: string; m: string; i: string } }) {
  const panel = await requirePanel(request, "admin");
  if (panel instanceof NextResponse) return panel;
  try {
    const att = await storedFile(params.c, params.m, Number(params.i));
    const range = request.headers.get("range");
    const upstream = await fetch(att.url, { headers: range ? { Range: range } : {}, cache: "no-store" });
    if (!upstream.ok && upstream.status !== 206) return new Response("That file isn't available right now.", { status: 502 });
    const headers = new Headers();
    for (const h of ["content-type", "content-length", "content-range", "accept-ranges"]) {
      const v = upstream.headers.get(h);
      if (v) headers.set(h, v);
    }
    if (!headers.get("content-type") && att.content_type) headers.set("content-type", att.content_type);
    const download = new URL(request.url).searchParams.get("download") === "1";
    // ASCII fallback plus a UTF-8 filename* (headers can't hold emoji or non-Latin names directly)
    const ascii = att.filename.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "");
    headers.set("Content-Disposition", `${download ? "attachment" : "inline"}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(att.filename)}`);
    headers.set("Cache-Control", "private, max-age=900");
    headers.set("X-Content-Type-Options", "nosniff");
    headers.set("Content-Security-Policy", "sandbox; default-src 'none'; img-src 'self'; media-src 'self'; style-src 'unsafe-inline'");
    return new Response(upstream.body, { status: upstream.status, headers });
  } catch (error) {
    if (error instanceof RemovedError) return new Response(error.message, { status: error.status });
    console.error("Removed media failed", error);
    return new Response("Something went wrong.", { status: 500 });
  }
}
