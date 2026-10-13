import { NextResponse } from "next/server";
import { requirePanel } from "../../../../../../../lib/admin";
import { PanelError, recentLogs, serverByKey } from "../../../../../../../lib/bot-console";

export const dynamic = "force-dynamic";

/** Admins: the last ~150 lines of a bot's console. */
export async function GET(request: Request, { params }: { params: { server: string } }) {
  const panel = await requirePanel(request, "admin");
  if (panel instanceof NextResponse) return panel;
  const server = serverByKey(params.server);
  if (!server) return NextResponse.json({ ok: false, error: "Unknown bot." }, { status: 404 });
  try {
    return NextResponse.json({ ok: true, lines: await recentLogs(server), at: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Couldn't read the console." }, { status: e instanceof PanelError ? e.status : 502 });
  }
}
