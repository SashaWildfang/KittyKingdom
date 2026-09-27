import Link from "next/link";

export default function ForgotPasswordPage({ searchParams }: { searchParams: { sent?: string } }) {
  const sent = searchParams.sent === "1";
  return (
    <main className="auth-screen">
      <div className="auth-backdrop" />
      <section className="auth-card minehut-card">
        <Link className="auth-logo" href="/" aria-label="Kitty Kingdom home">
          <img className="auth-logo-img" src="/logo.png" alt="Kitty Kingdom logo" />
        </Link>
        <h1>Password Reset</h1>
        {sent ? (
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
