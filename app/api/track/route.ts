import { NextResponse } from "next/server";
import { recordDuration, recordView } from "../../../lib/analytics";
import { getCurrentUser } from "../../../lib/auth";
import { hasOperatorKeys } from "../../../lib/validate";

export const dynamic = "force-dynamic";

// Per-instance limiter: plenty for real browsing, stops a script from flooding the stats
const recent = new Map<string, number[]>();
function allowed(key: string) {
  const now = Date.now();
  const hits = (recent.get(key) ?? []).filter((t) => now - t < 60_000);
  if (hits.length >= 60) return false;
  hits.push(now);
  recent.set(key, hits);
  if (recent.size > 5000) recent.clear();
  return true;
}

const ok = () => new NextResponse(null, { status: 204, headers: { "Cache-Control": "no-store" } });

/** Page view beacons from the site's own pages: { type: "view", ... } or { type: "leave", id, ms }. */
export async function POST(request: Request) {
  try {
    // Only this site's own pages may report views
    const origin = request.headers.get("origin");
    const site = request.headers.get("sec-fetch-site");
    if ((origin && origin !== new URL(request.url).origin) || (site && site !== "same-origin")) return ok();

    const ip = (request.headers.get("x-forwarded-for")?.split(",")[0] ?? "local").trim();
    if (!allowed(ip)) return ok();

    // sendBeacon posts text/plain, so read the raw text
    const text = (await request.text()).slice(0, 2000);
    const body = JSON.parse(text || "{}") as Record<string, unknown>;
    if (!body || typeof body !== "object" || Array.isArray(body) || hasOperatorKeys(body)) return ok();

    if (body.type === "leave") {
      await recordDuration(body.id, body.vid, body.ms);
      return ok();
    }
    if (body.type === "view") {
      const user = await getCurrentUser().catch(() => null);
      const id = await recordView(body, { signedIn: Boolean(user), linked: Boolean(user?.discordId) });
      return NextResponse.json({ id }, { headers: { "Cache-Control": "no-store" } });
    }
    return ok();
  } catch {
    return ok();
  }
}
