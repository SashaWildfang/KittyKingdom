import { NextResponse } from "next/server";
import { requirePanel } from "../../../../lib/admin";
import { applyChange, automodChanges, automodPlaces, getAutomodConfig, planChange, type AutomodChange } from "../../../../lib/automod";
import { getMongoClient } from "../../../../lib/mongodb";
import { hasOperatorKeys } from "../../../../lib/validate";

export const dynamic = "force-dynamic";

/** AutoMod settings, the channels/roles to pick from, and recent setting changes (staff can look). */
export async function GET(request: Request) {
  const panel = await requirePanel(request);
  if (panel instanceof NextResponse) return panel;
  const [config, places, changes] = await Promise.all([getAutomodConfig(), automodPlaces().catch(() => ({ channels: [], roles: [] })), automodChanges()]);
  return NextResponse.json({ ok: true, config, places, changes, canEdit: panel.level === "admin" }, { headers: { "Cache-Control": "no-store" } });
}

/** One settings change (admins; staff may only switch raid mode). */
export async function POST(request: Request) {
  const panel = await requirePanel(request);
  if (panel instanceof NextResponse) return panel;
  const body = (await request.json().catch(() => null)) as AutomodChange | null;
  if (!body || typeof body !== "object" || hasOperatorKeys(body)) return NextResponse.json({ ok: false, error: "Invalid change." }, { status: 400 });
  const plan = await planChange(body, panel.level);
  if (typeof plan === "string") return NextResponse.json({ ok: false, error: plan }, { status: plan.startsWith("Only admins") ? 403 : 400 });
  try {
    await applyChange(plan, { discordId: panel.discordId, name: panel.name });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Couldn't save that." }, { status: 409 });
  }
  const client = await getMongoClient();
  await client
    .db(process.env.MONGODB_DB ?? "website")
    .collection("admin_audit")
    .insertOne({ at: new Date(), action: "automod-change", change: body.type, summary: plan.summary, adminDiscordId: panel.discordId, adminName: panel.name });
  return NextResponse.json({ ok: true, message: `${plan.summary}. The bot picks this up within about 15 seconds.`, config: await getAutomodConfig() });
}
