import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../../lib/admin";
import { requireTwoFactorForAction } from "../../../../../lib/admin-2fa";
import { TicketDeleteError, cleanupBatch, cleanupFinish, cleanupPreview, type CleanupFilter } from "../../../../../lib/ticket-delete";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function filterFrom(body: Record<string, unknown>): CleanupFilter {
  const opener = String(body.opener ?? "any");
  return {
    olderThanMonths: Math.max(1, Math.min(120, Number(body.olderThanMonths) || 12)),
    includeNsfw: Boolean(body.includeNsfw),
    types: Array.isArray(body.types) ? body.types.map(String).slice(0, 20) : [],
    opener: (["any", "left", "deleted", "gone"].includes(opener) ? opener : "any") as CleanupFilter["opener"],
  };
}

/**
 * Admins: delete old closed tickets in bulk. {step: "preview"} counts them; {step: "batch"} deletes the next
 * few (call until remaining is 0); {step: "finish", deleted} renumbers and logs. Deleting needs 2FA.
 */
export async function POST(request: Request) {
  const admin = await requireAdmin(request);
  if (admin instanceof NextResponse) return admin;
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const f = filterFrom(body);
    if (body.step === "preview") return NextResponse.json({ ok: true, ...(await cleanupPreview(f)) });
    const no2fa = await requireTwoFactorForAction();
    if (no2fa) return no2fa;
    if (body.step === "batch") return NextResponse.json({ ok: true, ...(await cleanupBatch(admin, f)) });
    if (body.step === "finish") return NextResponse.json({ ok: true, ...(await cleanupFinish(admin, Math.max(0, Number(body.deleted) || 0), f)) });
    return NextResponse.json({ ok: false, error: "Unknown step." }, { status: 400 });
  } catch (error) {
    if (error instanceof TicketDeleteError) return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    console.error("Ticket clean-up failed", error);
    return NextResponse.json({ ok: false, error: "The clean-up stopped. Nothing past the last batch was deleted; you can run it again." }, { status: 500 });
  }
}
