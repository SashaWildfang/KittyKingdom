import { NextResponse } from "next/server";
import { pingDatabase } from "../../../../lib/status";

export const dynamic = "force-dynamic";

/** For the Main Bot's minute check (and anyone curious): is the website up, and can it reach its database? */
export async function GET() {
  const db = await pingDatabase();
  return NextResponse.json({ ok: true, db: db.ok, dbMs: db.ms }, { headers: { "Cache-Control": "no-store" } });
}
