import { NextResponse } from "next/server";
import { requirePanel } from "../../../../../lib/admin";
import { BOT_SERVERS } from "../../../../../lib/bot-console";
import { listIssues, resolveIssues } from "../../../../../lib/bot-health";
import { getMongoClient } from "../../../../../lib/mongodb";

export const dynamic = "force-dynamic";
const BOTS = new Set(BOT_SERVERS.map((s) => s.key));

/** Admins: problems the bots printed in their consoles (and offline alerts), newest first. */
export async function GET(request: Request) {
  const panel = await requirePanel(request, "admin");
  if (panel instanceof NextResponse) return panel;
  const p = new URL(request.url).searchParams;
  const bot = p.get("bot");
  const data = await listIssues({ bot: bot && BOTS.has(bot) ? bot : null, open: p.get("open") === "1" });
  return NextResponse.json({ ok: true, ...data }, { headers: { "Cache-Control": "no-store" } });
}

/** Admins: mark one issue, or all of a bot's (optionally only errors or warnings), as fixed. */
export async function POST(request: Request) {
  const panel = await requirePanel(request, "admin");
  if (panel instanceof NextResponse) return panel;
  const body = (await request.json().catch(() => null)) as { id?: unknown; bot?: unknown; level?: unknown } | null;
  const id = typeof body?.id === "string" && /^[a-z]+:[\w-]{1,40}$/.test(body.id) ? body.id : undefined;
  const bot = typeof body?.bot === "string" && BOTS.has(body.bot) ? body.bot : undefined;
  const level = body?.level === "error" || body?.level === "warning" ? body.level : undefined;
  if (!id && !bot) return NextResponse.json({ ok: false, error: "Pick an issue or a bot." }, { status: 400 });
  const n = await resolveIssues({ id, bot, level }, panel.name);
  const client = await getMongoClient();
  await client
    .db(process.env.MONGODB_DB ?? "website")
    .collection("admin_audit")
    .insertOne({ at: new Date(), action: "bot-issues-resolve", issue: id ?? null, bot: bot ?? null, count: n, adminDiscordId: panel.discordId, adminName: panel.name })
    .catch(() => undefined);
  return NextResponse.json({ ok: true, resolved: n });
}
