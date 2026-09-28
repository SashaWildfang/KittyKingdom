import { readNewsMedia } from "../../../../lib/news-media";

export const dynamic = "force-dynamic";

/** A news image or video (public, cached for a year since files never change). */
export async function GET(_request: Request, { params }: { params: { file: string } }) {
  const id = params.file.split(".")[0];
  const media = await readNewsMedia(id).catch(() => null);
  if (!media) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(media.data), {
    headers: {
      "Content-Type": media.type,
      "Content-Length": String(media.data.length),
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "Accept-Ranges": "none",
    },
  });
}
