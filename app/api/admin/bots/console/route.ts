import { NextResponse } from "next/server";
import { requirePanel } from "../../../../../lib/admin";
import { allStatuses, consoleConfigured } from "../../../../../lib/bot-console";
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
  if (!consoleConfigured()) return NextResponse.json({ ok: true, configured: false, servers: [], actions }, { headers: { "Cache-Control": "no-store" } });
  return NextResponse.json({ ok: true, configured: true, servers: await allStatuses(), actions }, { headers: { "Cache-Control": "no-store" } });
}
