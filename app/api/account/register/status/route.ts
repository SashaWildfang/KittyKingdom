import { NextResponse } from "next/server";
import { registrationState } from "../../../../../lib/registration";

export const dynamic = "force-dynamic";

/** Where this browser's sign-up stands; finishes the account as soon as Discord is linked. */
export async function GET(request: Request) {
  const state = await registrationState(new URL(request.url).origin);
  return NextResponse.json({ ok: true, ...state }, { headers: { "Cache-Control": "no-store" } });
}
