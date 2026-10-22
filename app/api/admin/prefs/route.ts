import { NextResponse } from "next/server";
import { requirePanel } from "../../../../lib/admin";
import { STAFF_ALERTS, deleteView, getPrefs, saveView, setMuted } from "../../../../lib/admin-prefs";

export const dynamic = "force-dynamic";

/** Your own panel preferences: saved views and which staff alerts you get. */
export async function GET(request: Request) {
  const panel = await requirePanel(request);
  if (panel instanceof NextResponse) return panel;
  const prefs = await getPrefs(panel.discordId);
  return NextResponse.json({ ok: true, ...prefs, alerts: STAFF_ALERTS.map((a) => ({ key: a.key, label: a.label, help: a.help, on: !prefs.muted.includes(a.key) })) }, { headers: { "Cache-Control": "no-store" } });
}

/** {op: "save-view", scope, name, value} · {op: "delete-view", scope, id} · {op: "alerts", muted: [...]} */
export async function POST(request: Request) {
  const panel = await requirePanel(request);
  if (panel instanceof NextResponse) return panel;
  try {
    const body = (await request.json().catch(() => ({}))) as { op?: string; scope?: string; name?: string; value?: unknown; id?: string; muted?: unknown };
    if (body.op === "save-view" && body.value && typeof body.value === "object") {
      return NextResponse.json({ ok: true, view: await saveView(panel.discordId, String(body.scope ?? ""), String(body.name ?? ""), body.value as Record<string, unknown>) });
    }
    if (body.op === "delete-view") {
      await deleteView(panel.discordId, String(body.scope ?? ""), String(body.id ?? ""));
      return NextResponse.json({ ok: true });
    }
    if (body.op === "alerts" && Array.isArray(body.muted)) {
      return NextResponse.json({ ok: true, muted: await setMuted(panel.discordId, body.muted.map(String)) });
    }
    return NextResponse.json({ ok: false, error: "Nothing to change." }, { status: 400 });
  } catch {
    return NextResponse.json({ ok: false, error: "Couldn't save that." }, { status: 400 });
  }
}
