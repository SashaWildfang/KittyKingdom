import { NextResponse } from "next/server";
import type { Document, UpdateFilter } from "mongodb";
import { createVerificationTokenEntry, maxActiveVerificationTokens } from "../../../../lib/auth";
import { sendVerificationEmail } from "../../../../lib/email";
import { getUsersCollection } from "../../../../lib/mongodb";
import { HOUR, allow, clientIp } from "../../../../lib/rate-limit";
import { cleanIdentifier, hasOperatorKeys } from "../../../../lib/validate";

export const maxDuration = 10;

// Same answer whether or not the account exists, so this can't be used to look people up
const GENERIC = "If that account still needs verifying, a new confirmation email is on its way. Check your inbox (and spam).";

/** Old GET links no longer send email (that allowed inbox flooding). */
export async function GET() {
  return NextResponse.json({ ok: false, message: "Use the resend button on the site." }, { status: 405, headers: { Allow: "POST" } });
}

/** { identifier } — resends the verification email, rate limited per address and per account. */
export async function POST(request: Request) {
  const origin = new URL(request.url).origin;
  const sameSite = request.headers.get("origin");
  if (sameSite && sameSite !== origin) return NextResponse.json({ ok: false, message: "Invalid request origin." }, { status: 403 });

  const body = (await request.json().catch(() => null)) as unknown;
  if (!body || typeof body !== "object" || hasOperatorKeys(body)) {
    return NextResponse.json({ ok: false, message: "Invalid request." }, { status: 400 });
  }
  const identifier = cleanIdentifier((body as { identifier?: unknown }).identifier);
  if (!identifier) return NextResponse.json({ ok: false, message: "Enter your email or username first." }, { status: 400 });

  const allowed = await allow([
    { key: `resend:ip:${await clientIp()}`, limit: 5, windowMs: HOUR },
    { key: `resend:id:${identifier}`, limit: 3, windowMs: HOUR },
  ]);
  if (!allowed) {
    return NextResponse.json({ ok: false, message: "You've asked for a few emails already. Please wait a while before trying again." }, { status: 429 });
  }

  try {
    const users = await getUsersCollection();
    const user = await users.findOne({ $or: [{ email: identifier }, { username: identifier }] });
    // Unfinished sign-ups confirm their email first, so they can ask for a new link too
    if (user && !user.emailVerified && typeof user.email === "string") {
      const { token, entry } = createVerificationTokenEntry();
      await users.updateOne(
        { _id: user._id },
        {
          // Add the new link without cancelling earlier ones (keeps the most recent few)
          $push: { emailVerificationTokens: { $each: [entry], $slice: -maxActiveVerificationTokens } } as unknown as UpdateFilter<Document>["$push"],
          $set: { updatedAt: new Date() },
        },
      );
      const result = await sendVerificationEmail(user.email, `${origin}/api/account/verify-email?token=${token}`, {
        discordName: user.discord?.globalName ?? user.discord?.username ?? null,
        newAccount: Boolean(user.registration?.pending),
      });
      if (!result.sent) console.error("Verification resend failed", result.reason);
    }
  } catch (error) {
    console.error("Verification resend failed", error);
  }
  return NextResponse.json({ ok: true, message: GENERIC });
}
