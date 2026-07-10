import { NextResponse } from "next/server";
import { clearSession } from "../../../../lib/auth";

export async function POST(request: Request) {
  const origin = new URL(request.url).origin;
  await clearSession();
  return NextResponse.redirect(`${origin}/home?logout=success`, 303);
}
