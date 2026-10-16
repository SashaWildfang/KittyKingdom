import { NextResponse } from "next/server";
import { requireGiveawayManager } from "../../../../../../lib/giveaway-access";
import { GiveawayError, giveawayAction, type GiveawayAction } from "../../../../../../lib/giveaways";

export const dynamic = "force-dynamic";

const ACTIONS: GiveawayAction[] = ["end", "cancel", "reroll", "start", "handed", "duplicate", "approve", "reject"];

/** {action: end|cancel|reroll|start|handed|duplicate|approve|reject, count?, userId?, reason?}. Approve and reject are for admins. */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const panel = await requireGiveawayManager(request);
  if (panel instanceof NextResponse) return panel;
  try {
    const body = (await request.json().catch(() => ({}))) as { action?: string; count?: number; userId?: string; reason?: string };
    if (!ACTIONS.includes(body.action as GiveawayAction)) return NextResponse.json({ ok: false, error: "Unknown action." }, { status: 400 });
    return NextResponse.json(await giveawayAction(params.id, body.action as GiveawayAction, panel, { count: body.count, userId: body.userId, reason: body.reason }));
  } catch (error) {
    if (error instanceof GiveawayError) return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    console.error("Giveaway action failed", error);
    return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500 });
  }
}
