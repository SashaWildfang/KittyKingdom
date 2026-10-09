import { NextResponse } from "next/server";
import { requirePanel } from "../../../../../lib/admin";
import { storeItems } from "../../../../../lib/giveaways";

export const dynamic = "force-dynamic";

/** Admins: store items that can be giveaway prizes. */
export async function GET(request: Request) {
  const panel = await requirePanel(request, "admin");
  if (panel instanceof NextResponse) return panel;
  try {
    return NextResponse.json({ ok: true, items: await storeItems() }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Giveaway items failed", error);
    return NextResponse.json({ ok: false, error: "Couldn't load the store items." }, { status: 500 });
  }
}
