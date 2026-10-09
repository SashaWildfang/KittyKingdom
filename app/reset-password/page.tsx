import Link from "next/link";
import { findResetUser } from "../../lib/password-reset";
import { PasswordField } from "../password-field";
import { SiteLogo } from "../ui-icons";

export const dynamic = "force-dynamic";

const messages: Record<string, string> = {
  requirements: "Your new password needs 8+ characters with at least one number and one symbol.",
  mismatch: "The two passwords didn't match.",
};

export default async function ResetPasswordPage({ searchParams }: { searchParams: { token?: string; status?: string } }) {
  const token = searchParams.token ?? "";
  const valid = token ? Boolean(await findResetUser(token)) : false;

  return (
    <main className="auth-screen">
      <div className="auth-backdrop" />
      <section className="auth-card minehut-card">
        <Link className="auth-logo" href="/" aria-label="Kitty Kingdom home">
          <SiteLogo className="auth-logo-img" alt="Kitty Kingdom logo" />
        </Link>
        <h1>Choose a new password</h1>
        {valid ? (
          <>
            {searchParams.status && messages[searchParams.status] ? <p className="auth-status">{messages[searchParams.status]}</p> : null}
            <form className="auth-form" action="/api/account/password-reset/confirm" method="post">
              <input type="hidden" name="token" value={token} />
              <PasswordField
                autoComplete="new-password"
                label="New password"
                name="newPassword"
                placeholder="8+ characters, a number and a symbol"
                minLength={8}
              />
              <PasswordField autoComplete="new-password" label="Confirm new password" name="confirmPassword" placeholder="Type it again" minLength={8} />
              <button type="submit">
                Save new password <span aria-hidden="true">→</span>
              </button>
            </form>
          </>
        ) : (
          <>
            <p className="auth-status">This reset link has expired or was already used.</p>
            <Link className="form-button" href="/forgot-password">
              Send a new link
            </Link>
          </>
        )}
      </section>
    </main>
  );
}
