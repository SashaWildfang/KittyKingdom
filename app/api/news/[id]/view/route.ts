import { NextResponse } from "next/server";
import { addNewsView } from "../../../../../lib/news";
import { HOUR, clientIp, hit } from "../../../../../lib/rate-limit";

export const dynamic = "force-dynamic";

/** Counts a read of a news post: at most once per visitor (IP) per post per day. Sent by the article page. */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return NextResponse.json({ ok: false }, { status: 403 });
  const ua = request.headers.get("user-agent") ?? "";
  if (/bot|crawl|spider|preview|slurp|facebookexternalhit|discord/i.test(ua)) return NextResponse.json({ ok: true, counted: false });
  const first = await hit(`news-view:${await clientIp()}:${params.id}`, 1, 24 * HOUR).catch(() => ({ ok: false }));
  if (!first.ok) return NextResponse.json({ ok: true, counted: false });
  const views = await addNewsView(params.id).catch(() => null);
  return NextResponse.json({ ok: views !== null, counted: views !== null, views });
}
