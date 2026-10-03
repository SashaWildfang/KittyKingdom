import { NextResponse } from "next/server";
import { requirePanel } from "../../../../lib/admin";
import { BanRequestError, canReviewBans, decideBanRequest, listBanRequests, pendingBanRequests } from "../../../../lib/ban-requests";

export const dynamic = "force-dynamic";
const NO_STORE = { "Cache-Control": "no-store" };

/** Staff: Jr Mod ban requests. ?count=1 for just the number waiting; ?filter=all for the history. */
export async function GET(request: Request) {
  const panel = await requirePanel(request);
  if (panel instanceof NextResponse) return panel;
  const params = new URL(request.url).searchParams;
  if (params.get("count")) return NextResponse.json({ ok: true, pending: await pendingBanRequests() }, { headers: NO_STORE });
  const [list, canReview] = await Promise.all([listBanRequests(params.get("filter") === "all" ? "all" : "pending"), canReviewBans(panel.discordId)]);
  return NextResponse.json({ ok: true, ...list, canReview, me: panel.discordId }, { headers: NO_STORE });
}

/** Mod+: { id, decision: "approve" | "deny", note, confirm: "CONFIRM" } */
export async function POST(request: Request) {
  const panel = await requirePanel(request);
  if (panel instanceof NextResponse) return panel;
  const body = (await request.json().catch(() => ({}))) as { id?: unknown; decision?: unknown; note?: unknown; confirm?: unknown };
  try {
    if (body.decision !== "approve" && body.decision !== "deny") throw new BanRequestError("Pick approve or deny.");
    const res = await decideBanRequest(String(body.id ?? ""), { discordId: panel.discordId, name: panel.name }, body.decision, String(body.note ?? ""), String(body.confirm ?? ""));
    return NextResponse.json({ ok: true, ...res }, { headers: NO_STORE });
  } catch (error) {
    if (error instanceof BanRequestError) return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    console.error("Ban request decision failed", error);
    return NextResponse.json({ ok: false, error: "That didn't work. Try again." }, { status: 500 });
  }
}
