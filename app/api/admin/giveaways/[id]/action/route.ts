import { NextResponse } from "next/server";
import { requirePanel } from "../../../../../../lib/admin";
import { GiveawayError, giveawayAction, type GiveawayAction } from "../../../../../../lib/giveaways";

export const dynamic = "force-dynamic";

const ACTIONS: GiveawayAction[] = ["end", "cancel", "reroll", "start", "handed", "duplicate"];

/** Admins: {action: end|cancel|reroll|start|handed|duplicate, count?, userId?}. */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const panel = await requirePanel(request, "admin");
  if (panel instanceof NextResponse) return panel;
  try {
    const body = (await request.json().catch(() => ({}))) as { action?: string; count?: number; userId?: string };
    if (!ACTIONS.includes(body.action as GiveawayAction)) return NextResponse.json({ ok: false, error: "Unknown action." }, { status: 400 });
    return NextResponse.json(await giveawayAction(params.id, body.action as GiveawayAction, panel.discordId, { count: body.count, userId: body.userId }));
  } catch (error) {
    if (error instanceof GiveawayError) return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    console.error("Giveaway action failed", error);
    return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500 });
  }
}
