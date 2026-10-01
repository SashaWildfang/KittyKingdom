import { NextResponse } from "next/server";
import { getViewAs } from "../auth";
import { datingAccess } from "./access";

const MESSAGES = {
  "signed-out": "Log in to use Dating.",
  unlinked: "Link your Discord account to use Dating.",
  "not-member": "You need to be in the Kitty Kingdom Discord to use Dating.",
  "not-adult": "Dating is for 18+ Verified members. Open a verification ticket in the server to get verified.",
} as const;

/**
 * The signed-in 18+ member, or a ready-made error response. `readOnly` is true while an admin is
 * viewing the site as this member: nothing may be recorded on their behalf (views, read receipts…).
 */
export async function requireDating() {
  const access = await datingAccess();
  if (!access.ok) return NextResponse.json({ ok: false, error: MESSAGES[access.reason], reason: access.reason }, { status: access.reason === "signed-out" ? 401 : 403 });
  return { ...access, readOnly: Boolean(await getViewAs().catch(() => null)) };
}

/** Same-site check for anything that changes data (the admin panel uses the same rule). */
export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}
