import { NextResponse } from "next/server";
import { cleanSource, recordInviteClick } from "../../lib/growth";

export const dynamic = "force-dynamic";

const INVITE = "https://discord.com/invite/M9XKHFdYQV";

/**
 * kittykingdom.net/join?src=reddit → counts the click for that source, then opens the Discord
 * invite. Share this instead of the raw invite so Admin → Traffic shows which ads work.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const cookie = (request.headers.get("cookie") ?? "").match(/(?:^|;\s*)kk_src=([a-z0-9._-]{1,40})/)?.[1];
  // An ad's own ?src= wins; the site's buttons (?via=) keep whichever ad first brought the visitor
  const src = cleanSource(url.searchParams.get("src") ?? url.searchParams.get("ref")) ?? cookie ?? cleanSource(url.searchParams.get("via")) ?? "direct";
  await recordInviteClick(src).catch(() => undefined);
  const res = NextResponse.redirect(INVITE, 302);
  if (!cookie && src !== "direct" && !url.searchParams.get("via")) res.cookies.set("kk_src", src, { maxAge: 30 * 86_400, httpOnly: true, sameSite: "lax", secure: true, path: "/" });
  return res;
}
