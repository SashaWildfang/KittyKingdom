import { NextResponse } from "next/server";
import { requirePanel } from "../../../../lib/admin";
import { GiveawayError, createGiveaway, listGiveaways } from "../../../../lib/giveaways";

export const dynamic = "force-dynamic";

function fail(error: unknown) {
  if (error instanceof GiveawayError) return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
  console.error("Giveaways failed", error);
  return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500 });
}

/** Admins: giveaways by status (?status=scheduled|running|ended|cancelled|all&search=). */
export async function GET(request: Request) {
  const panel = await requirePanel(request, "admin");
  if (panel instanceof NextResponse) return panel;
  const u = new URL(request.url);
  try {
    const data = await listGiveaways(u.searchParams.get("status") ?? "all", u.searchParams.get("search") ?? "");
    return NextResponse.json({ ok: true, ...data }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return fail(error);
  }
}

/** Admins: create a giveaway. */
export async function POST(request: Request) {
  const panel = await requirePanel(request, "admin");
  if (panel instanceof NextResponse) return panel;
  try {
    const body = await request.json().catch(() => ({}));
    return NextResponse.json({ ok: true, ...(await createGiveaway(body, panel.discordId)) });
  } catch (error) {
    return fail(error);
  }
}
