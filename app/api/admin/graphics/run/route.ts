import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../../lib/admin";
import { runStat } from "../../../../../lib/graphics/stats";
import type { Params } from "../../../../../lib/graphics/spec";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Works out one graphic: ?id=chat-hours&range=30&tz=… (cached five minutes per set of options). */
export async function GET(request: Request) {
  const admin = await requireAdmin(request);
  if (admin instanceof NextResponse) return admin;
  const q = new URL(request.url).searchParams;
  const id = q.get("id") ?? "";
  const params: Params = {};
  q.forEach((v, k) => {
    if (k !== "id") params[k as keyof Params] = v;
  });
  try {
    return NextResponse.json({ ok: true, spec: await runStat(id, params) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Graphic failed", id, error);
    return NextResponse.json({ ok: false, error: error instanceof Error && error.message === "Unknown graphic." ? error.message : "Couldn't work that graphic out. Try a different range." }, { status: 500 });
  }
}
