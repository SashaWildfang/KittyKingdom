import { NextResponse } from "next/server";
import { requirePanel } from "../../../../../lib/admin";
import { allStatuses, consoleConfigured } from "../../../../../lib/bot-console";
import { listIssues } from "../../../../../lib/bot-health";
import { botVersions } from "../../../../../lib/bot-versions";
import { getMongoClient } from "../../../../../lib/mongodb";

export const dynamic = "force-dynamic";

/** Admins: every bot server's state and resources, and the latest start/stop/restart actions. */
export async function GET(request: Request) {
  const panel = await requirePanel(request, "admin");
  if (panel instanceof NextResponse) return panel;
  const client = await getMongoClient();
  const recent = await client
    .db(process.env.MONGODB_DB ?? "website")
    .collection("admin_audit")
    .find({ action: "bot-power" })
    .sort({ at: -1 })
    .limit(15)
    .toArray()
    .catch(() => []);
  const actions = recent.map((d) => ({ at: d.at instanceof Date ? d.at.toISOString() : null, server: String(d.server ?? ""), signal: String(d.signal ?? ""), by: String(d.adminName ?? ""), ok: d.ok !== false, error: d.error ? String(d.error) : null }));
  // Open issues per bot, for the badges on each bot (works even before SparkedHost is connected)
  const open = await listIssues({ open: true, limit: 0 })
    .then((d) => d.open)
    .catch(() => ({}));
  // Files each bot still needs uploaded, for the "Up to date?" badge
  const outdated = await botVersions()
    .then((list) => Object.fromEntries(list.map((v) => [v.bot, v.outdated.length + v.missing.length])))
    .catch(() => ({}));
  if (!consoleConfigured()) return NextResponse.json({ ok: true, configured: false, servers: [], actions, open, outdated }, { headers: { "Cache-Control": "no-store" } });
  return NextResponse.json({ ok: true, configured: true, servers: await allStatuses(), actions, open, outdated }, { headers: { "Cache-Control": "no-store" } });
}
