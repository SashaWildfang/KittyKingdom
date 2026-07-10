import Link from "next/link";
import { PasswordField } from "../password-field";

const passwordPattern = "(?=.*\\d)(?=.*[^A-Za-z0-9]).{8,}";

const statusMessages: Record<string, string> = {
  "check-email":
    "Check your inbox for the confirmation link before logging in.",
  "terms-required":
    "You must accept the Terms of Service and Privacy Policy before signing up.",
  "password-requirements":
    "Password must be 8+ characters and include at least one number and one symbol.",
  "email-exists": "An account already exists for that email.",
  "email-provider-needed":
    "The account was created, but the confirmation email could not be sent. Check the email provider settings.",
  "service-unavailable":
    "Registration is temporarily unavailable. Please try again shortly.",
  "database-unreachable":
    "The account database is not reachable right now. Please try again after the database network settings are updated.",
};

export default function RegisterPage({
  searchParams,
}: {
  searchParams: { register?: string };
}) {
  const status = searchParams.register;

  return (
    <main className="auth-screen">
      <div className="auth-backdrop" />
      <section className="auth-card minehut-card" aria-label="Register">
        <Link className="auth-logo" href="/" aria-label="Kitty Kingdom home">
          <img
            className="auth-logo-img"
            src="/logo.png"
            alt="Kitty Kingdom logo"
          />
        </Link>
        <h1>Kitty Kingdom</h1>
        <div
          className="auth-tabs"
          role="tablist"
          aria-label="Authentication tabs"
        >
          <Link href="/login">Login</Link>
          <span className="active-tab">Sign up</span>
        </div>
        <p className="auth-intro">
          Create your account. We&apos;ll send an email confirmation link before
          login is enabled.
        </p>
        {status && statusMessages[status] ? (
          <p className="auth-status">{statusMessages[status]}</p>
        ) : null}
        <form
          className="auth-form"
          action="/api/account/register"
          method="post"
        >
          <label>
            <span className="input-label">
              Email <span className="required-mark">*</span>
            </span>
            <span className="input-shell">
              <span className="field-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" role="img">
                  <path d="M4.75 5h14.5C20.22 5 21 5.78 21 6.75v10.5c0 .97-.78 1.75-1.75 1.75H4.75C3.78 19 3 18.22 3 17.25V6.75C3 5.78 3.78 5 4.75 5Zm.62 2 6.63 5.05L18.63 7H5.37Zm13.63 1.63-6.4 4.88a1 1 0 0 1-1.2 0L5 8.63V17h14V8.63Z" />
                </svg>
              </span>
              <input
                autoComplete="email"
                name="email"
                placeholder="you@example.com"
                required
                type="email"
              />
            </span>
          </label>
          <PasswordField
            autoComplete="new-password"
            helpText="8+ characters with at least one number and one symbol."
            label="Password"
            minLength={8}
            name="password"
            pattern={passwordPattern}
            placeholder="Create a password"
          />
          <label className="policy-check">
            <input
              name="acceptedPolicies"
              required
              type="checkbox"
              value="yes"
            />
            <span>
              I have read, understand, and accept the{" "}
              <Link href="/terms">Terms of Service</Link> and{" "}
              <Link href="/privacy">Privacy Policy</Link>.
            </span>
          </label>
          <button type="submit">
            Sign Up <span aria-hidden="true">→</span>
          </button>
        </form>
        <p className="auth-switch">
          Already have an account? <Link href="/login">Login</Link>
        </p>
        <Link className="auth-help" href="/support">
          Need help signing up?
        </Link>
      </section>
    </main>
  );
}
