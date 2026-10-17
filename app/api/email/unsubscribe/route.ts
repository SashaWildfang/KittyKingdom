import { NextResponse } from "next/server";
import { checkUnsubscribe, unsubscribe } from "../../../../lib/email-prefs";
import type { EmailPrefKey } from "../../../../lib/email-prefs-shared";

export const dynamic = "force-dynamic";

/**
 * Turns notification emails off from the link in an email (no login needed; the link is signed).
 * Mail apps' one-click "Unsubscribe" button POSTs here too (RFC 8058), with the details in the query.
 */
export async function POST(request: Request) {
  const params = new URL(request.url).searchParams;
  const u = params.get("u") ?? "";
  const k = params.get("k") ?? "";
  const s = params.get("s") ?? "";
  if (!checkUnsubscribe(u, k, s)) return NextResponse.json({ ok: false, error: "That unsubscribe link isn't valid. Change your emails in Settings → Email instead." }, { status: 400 });
  await unsubscribe(u, k as EmailPrefKey | "all");
  return NextResponse.json({ ok: true });
}
