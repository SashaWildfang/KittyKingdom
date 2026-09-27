import { NextResponse } from "next/server";
import { accountAction, getAccount, type AccountAction, isAccountAction } from "../../../../../lib/accounts-admin";
import { requireAdmin } from "../../../../../lib/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 15;


export async function GET(request: Request, { params }: { params: { accountId: string } }) {
  const admin = await requireAdmin(request);
  if (admin instanceof NextResponse) return admin;
  const account = await getAccount(params.accountId);
  if (!account) return NextResponse.json({ ok: false, error: "Account not found." }, { status: 404 });
  return NextResponse.json({ ok: true, account }, { headers: { "Cache-Control": "no-store" } });
}

/** { action } — send-reset | temp-password | sign-out | verify-email */
export async function POST(request: Request, { params }: { params: { accountId: string } }) {
  const admin = await requireAdmin(request);
  if (admin instanceof NextResponse) return admin;
  const body = (await request.json().catch(() => ({}))) as { action?: string; confirm?: unknown };
  if (!isAccountAction(body.action)) {
    return NextResponse.json({ ok: false, error: "Unknown action." }, { status: 400 });
  }
  // Deleting needs the typed confirmation too, not just a click
  if (body.action === "delete" && body.confirm !== "CONFIRM") {
    return NextResponse.json({ ok: false, error: "Type CONFIRM to delete this account." }, { status: 400 });
  }
  try {
    const result = await accountAction(params.accountId, body.action as AccountAction, admin, new URL(request.url).origin);
    const account = body.action === "delete" ? null : await getAccount(params.accountId);
    return NextResponse.json({ ok: true, ...result, account, deleted: body.action === "delete" }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "That didn't work." }, { status: 400 });
  }
}
