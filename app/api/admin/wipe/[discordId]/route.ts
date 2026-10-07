import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../../lib/admin";
import { requireTwoFactorForAction } from "../../../../../lib/admin-2fa";
import { WipeError, executeWipe, previewWipe } from "../../../../../lib/owner-wipe";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function fail(error: unknown) {
  if (error instanceof WipeError) return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
  console.error("Wipe failed", error);
  return NextResponse.json({ ok: false, error: "That didn't work right now. Please try again." }, { status: 500 });
}

/** Owner only: what wiping this member would remove (nothing changes). */
export async function GET(request: Request, props: { params: Promise<{ discordId: string }> }) {
  const params = await props.params;
  const admin = await requireAdmin(request);
  if (admin instanceof NextResponse) return admin;
  try {
    return NextResponse.json({ ok: true, ...(await previewWipe(params.discordId, admin)) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return fail(error);
  }
}

/** Owner only, with 2FA: { confirm: "<their Discord id>" } wipes everything except safety records. */
export async function POST(request: Request, props: { params: Promise<{ discordId: string }> }) {
  const params = await props.params;
  const admin = await requireAdmin(request);
  if (admin instanceof NextResponse) return admin;
  const twoFactor = await requireTwoFactorForAction();
  if (twoFactor) return twoFactor;
  const body = (await request.json().catch(() => ({}))) as { confirm?: unknown };
  if (String(body.confirm ?? "").trim() !== params.discordId) {
    return NextResponse.json({ ok: false, error: "Type their Discord id exactly to confirm." }, { status: 400 });
  }
  try {
    return NextResponse.json({ ok: true, ...(await executeWipe(params.discordId, admin)) });
  } catch (error) {
    return fail(error);
  }
}
