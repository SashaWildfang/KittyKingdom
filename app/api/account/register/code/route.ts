import { NextResponse } from "next/server";
import { HOUR, allow, clientIp } from "../../../../../lib/rate-limit";
import { newRegistrationCode } from "../../../../../lib/registration";

export const dynamic = "force-dynamic";

/** A fresh /link code for the sign-up in progress (the old one stops working). */
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) return NextResponse.json({ ok: false, error: "Invalid request origin." }, { status: 403 });
  if (!(await allow([{ key: `regcode:${await clientIp()}`, limit: 15, windowMs: HOUR }]))) {
    return NextResponse.json({ ok: false, error: "You've made a lot of codes. Please wait a bit before getting another." }, { status: 429 });
  }
  const code = await newRegistrationCode();
  if (!code) return NextResponse.json({ ok: false, error: "Start a new sign-up first." }, { status: 409 });
  return NextResponse.json({ ok: true, ...code }, { headers: { "Cache-Control": "no-store" } });
}
