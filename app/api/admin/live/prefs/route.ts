import { NextResponse } from "next/server";
import { requirePanel } from "../../../../../lib/admin";
import { getLivePrefs, saveLivePrefs } from "../../../../../lib/live-chat";
import { readJson } from "../../../../../lib/store-auth";

export const dynamic = "force-dynamic";

/** Hidden channels and auto-follow, saved per staff member. */
export async function GET(request: Request) {
  const panel = await requirePanel(request);
  if (panel instanceof NextResponse) return panel;
  return NextResponse.json({ ok: true, prefs: await getLivePrefs(panel.discordId) });
}

export async function PATCH(request: Request) {
  const panel = await requirePanel(request);
  if (panel instanceof NextResponse) return panel;
  const body = await readJson(request);
  return NextResponse.json({ ok: true, prefs: await saveLivePrefs(panel.discordId, { hidden: body.hidden, autoFollow: body.autoFollow }) });
}
