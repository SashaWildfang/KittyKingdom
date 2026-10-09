import { NextResponse } from "next/server";
import { readSeasonAsset } from "../../../lib/season-store";
import { SEASONS, type SeasonKey } from "../../../lib/seasons";

export const dynamic = "force-dynamic";

const FALLBACK: Record<string, (s: SeasonKey) => string> = {
  logo: () => "/logo.png",
  banner: () => "/banner.jpg",
  emote: (s) => SEASONS[s].defaultEmote,
};

/** A season's logo, banner or currency emote (?s=winter). Falls back to the built-in art. */
export async function GET(request: Request, { params }: { params: { kind: string } }) {
  const u = new URL(request.url);
  const season = (u.searchParams.get("s") ?? "fall") as SeasonKey;
  if (!SEASONS[season] || !FALLBACK[params.kind]) return new NextResponse("Not found", { status: 404 });
  const id = u.searchParams.get("id");
  const asset = await readSeasonAsset(season, params.kind, id).catch(() => null);
  if (!asset) return NextResponse.redirect(new URL(FALLBACK[params.kind](season), u.origin), 307);
  return new NextResponse(new Uint8Array(asset.data), {
    headers: {
      "Content-Type": asset.type,
      // Links carry the settings version (&v=) or the image id, so they can be cached hard
      "Cache-Control": u.searchParams.get("v") || id ? "public, max-age=31536000, immutable" : "public, max-age=300",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
