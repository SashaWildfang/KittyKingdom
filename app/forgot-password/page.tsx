import Link from "next/link";

const CODE_STATUS: Record<string, string> = {
  failed: "That didn't work. Check your email or username and the code. Codes only work if two-factor is turned on for the account.",
  "too-many": "Too many tries. Please wait a while, or use the email link instead.",
  requirements: "Your new password needs 8+ characters with at least one number and one symbol.",
  mismatch: "Those two passwords don't match.",
};

/** Forgot password: an email link, or (for accounts with two-factor on) a code from the authenticator app. */
export default function ForgotPasswordPage({ searchParams }: { searchParams: { sent?: string; with?: string; status?: string } }) {
  const sent = searchParams.sent === "1";
  const withCode = searchParams.with === "code";
  const codeError = withCode && searchParams.status ? CODE_STATUS[searchParams.status] ?? CODE_STATUS.failed : null;
  return (
    <main className="auth-screen">
      <div className="auth-backdrop" />
      <section className="auth-card minehut-card">
        <Link className="auth-logo" href="/" aria-label="Kitty Kingdom home">
          <img className="auth-logo-img" src="/logo.png" alt="Kitty Kingdom logo" />
        </Link>
        <h1>Password Reset</h1>

        <nav className="fp-tabs" aria-label="How to reset">
          <Link href="/forgot-password" className={!withCode ? "is-on" : undefined} aria-current={!withCode ? "page" : undefined}>
            Email me a link
          </Link>
          <Link href="/forgot-password?with=code" className={withCode ? "is-on" : undefined} aria-current={withCode ? "page" : undefined}>
            Use my authenticator
          </Link>
        </nav>

        {withCode ? (
          <>
            <p className="auth-intro">
              Have two-factor turned on? Enter a code from your authenticator app (or one of your backup codes) and choose a new password. No email needed.
            </p>
            {codeError ? (
              <p className="auth-status auth-status--error" role="alert">
                {codeError}
              </p>
            ) : null}
            <form className="auth-form" action="/api/account/password-reset/two-factor" method="post">
              <label>
                <span className="input-label">
                  Email or username <span className="required-mark">*</span>
                </span>
                <span className="input-shell">
                  <input autoComplete="username" name="identifier" placeholder="you@example.com or YourUsername" required type="text" />
                </span>
              </label>
              <label>
                <span className="input-label">
                  Authenticator or backup code <span className="required-mark">*</span>
                </span>
                <span className="input-shell">
                  <input autoComplete="one-time-code" inputMode="text" name="code" placeholder="123456 or a backup code" required maxLength={20} type="text" />
                </span>
              </label>
              <label>
                <span className="input-label">
                  New password <span className="required-mark">*</span>
                </span>
                <span className="input-shell">
                  <input autoComplete="new-password" name="newPassword" required minLength={8} type="password" />
                </span>
              </label>
              <label>
                <span className="input-label">
                  Confirm new password <span className="required-mark">*</span>
                </span>
                <span className="input-shell">
                  <input autoComplete="new-password" name="confirmPassword" required minLength={8} type="password" />
                </span>
              </label>
              <button type="submit">
                Reset password <span aria-hidden="true">→</span>
              </button>
            </form>
            <p className="auth-intro fp-note">8+ characters with a number and a symbol. Every other device gets signed out.</p>
          </>
        ) : sent ? (
          <>
            <p className="auth-status">
              If that account exists, we&apos;ve emailed it a link to choose a new password. The link works for 1 hour.
            </p>
            <p className="auth-intro">Don&apos;t see it? Check your spam folder, or ask staff in the Discord for help.</p>
          </>
        ) : (
          <>
            <p className="auth-intro">Enter your email or username and we&apos;ll email you a link to choose a new password.</p>
            <form className="auth-form" action="/api/account/password-reset" method="post">
              <label>
                <span className="input-label">
                  Email or username <span className="required-mark">*</span>
                </span>
                <span className="input-shell">
                  <input autoComplete="username" name="identifier" placeholder="you@example.com or YourUsername" required type="text" />
                </span>
              </label>
              <button type="submit">
                Send reset link <span aria-hidden="true">→</span>
              </button>
            </form>
          </>
        )}
        <Link className="auth-help" href="/login">
          Back to login
        </Link>
      </section>
    </main>
  );
}
