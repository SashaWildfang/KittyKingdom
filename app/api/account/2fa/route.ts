import { NextResponse } from "next/server";
import { getCurrentUser } from "../../../../lib/auth";
import { readJson } from "../../../../lib/store-auth";
import { TwoFactorError, confirmSetup, disableTwoFactor, regenerateBackupCodes, startSetup, twoFactorStatus } from "../../../../lib/two-factor-account";

export const dynamic = "force-dynamic";
const NO_STORE = { "Cache-Control": "no-store" };

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Please log in." }, { status: 401 });
  return NextResponse.json({ ok: true, ...twoFactorStatus(user) }, { headers: NO_STORE });
}

/** { action: "start" | "confirm" | "regenerate" | "disable", code?, password? } */
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) return NextResponse.json({ ok: false, error: "Invalid request origin." }, { status: 403 });
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Please log in." }, { status: 401 });
  const body = await readJson(request);
  const code = typeof body.code === "string" ? body.code : "";
  try {
    switch (body.action) {
      case "start":
        return NextResponse.json({ ok: true, ...(await startSetup(user)) }, { headers: NO_STORE });
      case "confirm":
        return NextResponse.json({ ok: true, ...(await confirmSetup(user, code)), message: "Two-factor authentication is on." }, { headers: NO_STORE });
      case "regenerate":
        return NextResponse.json({ ok: true, ...(await regenerateBackupCodes(user, code)), message: "New backup codes made. The old ones no longer work." }, { headers: NO_STORE });
      case "disable":
        await disableTwoFactor(user, typeof body.password === "string" ? body.password : "", code);
        return NextResponse.json({ ok: true, message: "Two-factor authentication is off." }, { headers: NO_STORE });
      default:
        return NextResponse.json({ ok: false, error: "Unknown action." }, { status: 400 });
    }
  } catch (error) {
    if (error instanceof TwoFactorError) return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    console.error("2FA request failed", error);
    return NextResponse.json({ ok: false, error: "That didn't work. Try again." }, { status: 500 });
  }
}
