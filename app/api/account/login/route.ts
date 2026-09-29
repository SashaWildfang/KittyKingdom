import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { setSession, verifyPassword } from "../../../../lib/auth";
import { finishRegistration, setRegistrationCookie } from "../../../../lib/registration";
import { startTwoFactorLogin } from "../../../../lib/two-factor-login";
import { isDatabaseConnectionError } from "../../../../lib/db-errors";
import { getUsersCollection } from "../../../../lib/mongodb";
import { HOUR, MINUTE, allow, clientIp } from "../../../../lib/rate-limit";
import { cleanIdentifier, cleanPassword, isFormPost, safeNext } from "../../../../lib/validate";

export const maxDuration = 10;

export async function POST(request: Request) {
  const origin = new URL(request.url).origin;

  try {
    if (!isFormPost(request)) return NextResponse.redirect(`${origin}/login?login=invalid`, 303);
    const form = await request.formData();
    const identifier = cleanIdentifier(form.get("identifier"));
    const password = cleanPassword(form.get("password"));
    // Where to go afterwards (e.g. a transcript link from a Discord DM)
    const next = safeNext(form.get("next"));
    const keep = next ? `&next=${encodeURIComponent(next)}` : "";
    if (!identifier || !password) return NextResponse.redirect(`${origin}/login?login=invalid`, 303);

    // Slow down password guessing: per address and per account
    const ip = await clientIp();
    const allowed = await allow([
      { key: `login:ip:${ip}`, limit: 20, windowMs: 10 * MINUTE },
      { key: `login:id:${identifier}`, limit: 10, windowMs: 15 * MINUTE },
      { key: `login:day:${identifier}`, limit: 60, windowMs: 24 * HOUR },
    ]);
    if (!allowed) return NextResponse.redirect(`${origin}/login?login=too-many&identifier=${encodeURIComponent(identifier)}${keep}`, 303);

    const users = await getUsersCollection();
    const user = await users.findOne({
      $or: [{ email: identifier }, { username: identifier }],
    });

    if (!user || !verifyPassword(password, user.passwordSalt, user.passwordHash)) {
      return NextResponse.redirect(
        `${origin}/login?login=invalid&identifier=${encodeURIComponent(identifier)}${keep}`,
        303,
      );
    }

    // Sign-up not finished: confirm the email first, then link Discord (or, if both are done, finish it now)
    if (user.registration?.pending && user.emailVerified === true) {
      const done = user.discordId ? await finishRegistration(user) : null;
      if (!done?.ok) {
        await setRegistrationCookie(user._id);
        return NextResponse.redirect(`${origin}/register?step=link`, 303);
      }
    }

    if (!user.emailVerified) {
      return NextResponse.redirect(
        `${origin}/login?login=unverified&identifier=${encodeURIComponent(identifier)}${keep}`,
        303,
      );
    }

    // Two-factor on: the password was right, now ask for the code before signing in
    if (user.twoFactor?.enabled) {
      await startTwoFactorLogin(user._id);
      if (next) (await cookies()).set("kk_next", next, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 900 });
      return NextResponse.redirect(`${origin}/login/2fa`, 303);
    }

    await users.updateOne({ _id: user._id }, { $set: { lastLoginAt: new Date() } });
    await setSession(user._id, typeof user.sessionVersion === "number" ? user.sessionVersion : 0);
    return NextResponse.redirect(
      next
        ? `${origin}${next}`
        : user.username
          ? `${origin}/home?login=success`
          : `${origin}/account?login=success`,
      303,
    );
  } catch (error) {
    console.error("Login failed", error);
    const status = isDatabaseConnectionError(error)
      ? "database-unreachable"
      : "service-unavailable";
    return NextResponse.redirect(`${origin}/login?login=${status}`, 303);
  }
}
