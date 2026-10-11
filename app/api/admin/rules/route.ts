import { NextResponse } from "next/server";
import { requirePanel } from "../../../../lib/admin";
import { getMongoClient } from "../../../../lib/mongodb";
import { RULE_NAMES } from "../../../../lib/rules-source";
import { checkRules, getRulesState, partsChanged, resetRules, saveRules } from "../../../../lib/rules-store";
import { hasOperatorKeys } from "../../../../lib/validate";

export const dynamic = "force-dynamic";
const NO_STORE = { "Cache-Control": "no-store" };

async function audit(action: string, adminDiscordId: string, adminName: string) {
  const client = await getMongoClient();
  await client.db(process.env.MONGODB_DB ?? "website").collection("admin_audit").insertOne({ at: new Date(), action, adminDiscordId, adminName });
}

/** Admins: the rules as they are now, and the channels/roles they can mention. */
export async function GET(request: Request) {
  const panel = await requirePanel(request, "admin");
  if (panel instanceof NextResponse) return panel;
  try {
    return NextResponse.json({ ok: true, ...(await getRulesState()), names: RULE_NAMES }, { headers: NO_STORE });
  } catch (error) {
    console.error("Admin rules failed", error);
    return NextResponse.json({ ok: false, error: "Couldn't load the rules." }, { status: 500 });
  }
}

/** Admins: save the rules (Discord's #rules updates within a minute; the website right away). */
export async function PUT(request: Request) {
  const panel = await requirePanel(request, "admin");
  if (panel instanceof NextResponse) return panel;
  const body = (await request.json().catch(() => null)) as { source?: unknown } | null;
  if (!body || hasOperatorKeys(body)) return NextResponse.json({ ok: false, error: "Invalid rules." }, { status: 400 });
  const source = checkRules(body.source);
  if (typeof source === "string") return NextResponse.json({ ok: false, error: source }, { status: 400 });
  const before = await getRulesState();
  await saveRules(source, { discordId: panel.discordId, name: panel.name });
  await audit("rules-edit", panel.discordId, panel.name);
  const reposts = partsChanged(before.source, source);
  return NextResponse.json(
    {
      ok: true,
      message: reposts
        ? "Saved. The parts changed, so delete the old #rules messages and run /rules post again (the website is already updated)."
        : "Saved. #rules in Discord updates within a minute; the website already shows it.",
      ...(await getRulesState()),
    },
    { headers: NO_STORE },
  );
}

/** Admins: go back to the rules in the bot's code file. */
export async function DELETE(request: Request) {
  const panel = await requirePanel(request, "admin");
  if (panel instanceof NextResponse) return panel;
  await resetRules();
  await audit("rules-reset", panel.discordId, panel.name);
  return NextResponse.json({ ok: true, message: "Back to the original rules. #rules in Discord updates within a minute.", ...(await getRulesState()) }, { headers: NO_STORE });
}
