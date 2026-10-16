import { NextResponse } from "next/server";
import { cmLimits, requireGiveawayManager } from "../../../../lib/giveaway-access";
import { GiveawayError, createGiveaway, listGiveaways } from "../../../../lib/giveaways";

export const dynamic = "force-dynamic";

function fail(error: unknown) {
  if (error instanceof GiveawayError) return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
  console.error("Giveaways failed", error);
  return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500 });
}

/** Admins and Community Managers: giveaways by status (?status=review|scheduled|running|ended|cancelled|all&search=). */
export async function GET(request: Request) {
  const panel = await requireGiveawayManager(request);
  if (panel instanceof NextResponse) return panel;
  const u = new URL(request.url);
  try {
    const [data, limits] = await Promise.all([listGiveaways(u.searchParams.get("status") ?? "all", u.searchParams.get("search") ?? ""), cmLimits()]);
    return NextResponse.json({ ok: true, ...data, isAdmin: panel.isAdmin, limits }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return fail(error);
  }
}

/** Create a giveaway (a Community Manager's goes to an admin when it's over a limit). */
export async function POST(request: Request) {
  const panel = await requireGiveawayManager(request);
  if (panel instanceof NextResponse) return panel;
  try {
    const body = await request.json().catch(() => ({}));
    return NextResponse.json({ ok: true, ...(await createGiveaway(body, panel)) });
  } catch (error) {
    return fail(error);
  }
}
