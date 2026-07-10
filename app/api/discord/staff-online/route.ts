import { NextResponse } from "next/server";
import { getServerStatsCollection } from "../../../../lib/mongodb";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const stats = await getServerStatsCollection();
    const doc = await stats.findOne({ _id: "live_staff_count" });
    const online =
      typeof doc?.online_count === "number" ? doc.online_count : null;
    return NextResponse.json({ online });
  } catch {
    return NextResponse.json({
      online: null,
      reason: "server-stats-unavailable",
    });
  }
}
