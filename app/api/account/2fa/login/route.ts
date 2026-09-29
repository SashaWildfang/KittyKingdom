import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { setSession } from "../../../../../lib/auth";
import { getUsersCollection } from "../../../../../lib/mongodb";
import { TwoFactorError, checkSecondFactor } from "../../../../../lib/two-factor-account";
import { clearTwoFactorLogin, pendingTwoFactorUser } from "../../../../../lib/two-factor-login";
import { isFormPost, safeNext } from "../../../../../lib/validate";

export const maxDuration = 10;

/** Second step of logging in: the authenticator (or backup) code. */
export async function POST(request: Request) {
  const origin = new URL(request.url).origin;
  if (!isFormPost(request)) return NextResponse.redirect(`${origin}/login`, 303);
  const user = await pendingTwoFactorUser();
  if (!user) return NextResponse.redirect(`${origin}/login?login=2fa-expired`, 303);

  const form = await request.formData();
  const code = String(form.get("code") ?? "").slice(0, 20);
  const mode = form.get("mode") === "backup" ? "backup" : "app";
  try {
    const how = await checkSecondFactor(user, code);
    if (!how) return NextResponse.redirect(`${origin}/login/2fa?error=wrong&mode=${mode}`, 303);
    await clearTwoFactorLogin();
    await (await getUsersCollection()).updateOne({ _id: user._id }, { $set: { lastLoginAt: new Date() } });
    await setSession(user._id, typeof user.sessionVersion === "number" ? user.sessionVersion : 0);
    // A backup code was used: show how many are left on the Security section
    if (how === "backup") return NextResponse.redirect(`${origin}/account?login=backup-used#security`, 303);
    // Came from a link that needed logging in (see the login route)
    const jar = await cookies();
    const next = safeNext(jar.get("kk_next")?.value);
    if (next) {
      jar.delete("kk_next");
      return NextResponse.redirect(`${origin}${next}`, 303);
    }
    return NextResponse.redirect(user.username ? `${origin}/home?login=success` : `${origin}/account?login=success`, 303);
  } catch (error) {
    if (error instanceof TwoFactorError && error.status === 429) return NextResponse.redirect(`${origin}/login/2fa?error=locked&mode=${mode}`, 303);
    console.error("2FA login failed", error);
    return NextResponse.redirect(`${origin}/login/2fa?error=unavailable&mode=${mode}`, 303);
  }
}
