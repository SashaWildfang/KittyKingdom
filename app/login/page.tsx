import Link from "next/link";
import { PasswordField } from "../password-field";

const statusMessages: Record<string, string> = {
  invalid: "Email, username, or password was not recognized, or the email is not verified yet.",
  success: "You are signed in.",
  "login-required": "Please log in before opening account settings.",
  "service-unavailable": "Login is temporarily unavailable. Please try again shortly.",
  "missing-token": "The verification link is missing its token.",
  "invalid-or-expired": "The verification link is invalid or expired.",
};

export default function LoginPage({ searchParams }: { searchParams: { login?: string; account?: string; discord?: string; verify?: string } }) {
  const status = searchParams.login ?? searchParams.account ?? searchParams.discord ?? searchParams.verify;

  return (
    <main className="auth-screen">
      <div className="auth-backdrop" />
      <section className="auth-card minehut-card" aria-label="Login">
        <Link className="auth-logo" href="/" aria-label="Kitty Kingdom home">
          <span className="brand-crest">KK</span>
        </Link>
        <h1>Kitty Kingdom</h1>
        <div className="auth-tabs" role="tablist" aria-label="Authentication tabs">
          <span className="active-tab">Login</span>
          <Link href="/register">Sign up</Link>
        </div>
        <p className="auth-intro">Welcome back — log into your Kitty Kingdom account.</p>
        {status && statusMessages[status] ? <p className="auth-status">{statusMessages[status]}</p> : null}
        <form className="auth-form" action="/api/account/login" method="post">
          <label>
            <span className="input-label">Email or username <span className="required-mark">*</span></span>
            <span className="input-shell">
              <span className="field-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" role="img"><path d="M4.75 5h14.5C20.22 5 21 5.78 21 6.75v10.5c0 .97-.78 1.75-1.75 1.75H4.75C3.78 19 3 18.22 3 17.25V6.75C3 5.78 3.78 5 4.75 5Zm.62 2 6.63 5.05L18.63 7H5.37Zm13.63 1.63-6.4 4.88a1 1 0 0 1-1.2 0L5 8.63V17h14V8.63Z" /></svg>
              </span>
              <input autoComplete="username" name="identifier" placeholder="you@example.com or YourMCName" required type="text" />
            </span>
          </label>
          <PasswordField autoComplete="current-password" label="Password" name="password" placeholder="Enter your password" />
          <div className="form-helper-row">
            <span />
            <Link href="/forgot-password">Forgot password?</Link>
          </div>
          <button type="submit">Login <span aria-hidden="true">→</span></button>
        </form>
        <p className="auth-switch">Don&apos;t have an account? <Link href="/register">Sign up</Link></p>
        <Link className="auth-help" href="/support">Need help logging in?</Link>
      </section>
    </main>
  );
}
