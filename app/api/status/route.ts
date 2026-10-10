import { NextResponse } from "next/server";
import { getStatus } from "../../../lib/status";

export const dynamic = "force-dynamic";

/** Public: current status of every part, 90 days of uptime and incidents (status.kittykingdom.net). */
export async function GET() {
  try {
    return NextResponse.json({ ok: true, ...(await getStatus()) }, { headers: { "Cache-Control": "public, max-age=15, s-maxage=15" } });
  } catch (error) {
    console.error("Status failed", error);
    return NextResponse.json({ ok: false, error: "Couldn't load the status." }, { status: 500 });
  }
}
