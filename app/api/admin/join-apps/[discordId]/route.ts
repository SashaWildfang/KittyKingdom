import { requireTwoFactorForAction } from "../../../../../lib/admin-2fa";
import { NextResponse } from "next/server";
import { requirePanel } from "../../../../../lib/admin";
import { JoinAppError, joinAppFor, queueJoinAction, type JoinAction } from "../../../../../lib/join-apps";
import { getMongoClient } from "../../../../../lib/mongodb";
import { readJson } from "../../../../../lib/store-auth";

export const dynamic = "force-dynamic";

/** One member's join application (for their profile). */
export async function GET(request: Request, props: { params: Promise<{ discordId: string }> }) {
  const params = await props.params;
  const panel = await requirePanel(request);
  if (panel instanceof NextResponse) return panel;
  return NextResponse.json({ ok: true, ...(await joinAppFor(params.discordId)) }, { headers: { "Cache-Control": "no-store" } });
}

/** { action: "accept" | "deny" | "ban", reason?, confirm? } - queued for the bot to carry out. */
export async function POST(request: Request, props: { params: Promise<{ discordId: string }> }) {
  const params = await props.params;
  const panel = await requirePanel(request);
  if (panel instanceof NextResponse) return panel;
  try {
    const body = await readJson(request);
    const action = String(body.action ?? "") as JoinAction;
    if (action === "ban") {
      const twoFactor = await requireTwoFactorForAction();
      if (twoFactor) return twoFactor;
    }
    if (action === "ban" && String(body.confirm ?? "").toUpperCase() !== "BAN") throw new JoinAppError("Type BAN to confirm the ban.");
    const queued = await queueJoinAction({ discordId: panel.discordId, name: panel.name }, params.discordId, action, String(body.reason ?? ""));
    const client = await getMongoClient();
    await client
      .db(process.env.MONGODB_DB ?? "website")
      .collection("admin_audit")
      .insertOne({ at: new Date(), action: `join-${action}`, targetDiscordId: params.discordId, reason: body.reason ?? null, adminDiscordId: panel.discordId, adminName: panel.name });
    const verb = action === "accept" ? "Accepting" : action === "deny" ? "Denying" : "Banning";
    return NextResponse.json({
      ok: true,
      ...queued,
      message: queued.queueOnline ? `${verb}… the bot is on it.` : `${verb} as soon as the bot is back online.`,
    });
  } catch (error) {
    if (error instanceof JoinAppError) return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    console.error("Join action failed", error);
    return NextResponse.json({ ok: false, error: "That didn't work. Try again." }, { status: 500 });
  }
}
