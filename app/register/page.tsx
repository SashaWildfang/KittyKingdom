import Link from "next/link";
import { PasswordField } from "../password-field";

const statusMessages: Record<string, string> = {
  "check-email": "Check your inbox for the confirmation link before logging in.",
  "email-mismatch": "The email fields do not match.",
  "password-too-short": "Password must be at least 8 characters.",
  "email-exists": "An account already exists for that email.",
  "email-provider-needed": "The account was created, but the confirmation email could not be sent. Check the email provider settings.",
  "service-unavailable": "Registration is temporarily unavailable. Please try again shortly.",
};

export default function RegisterPage({ searchParams }: { searchParams: { register?: string } }) {
  const status = searchParams.register;

  return (
    <main className="auth-screen">
      <div className="auth-backdrop" />
      <section className="auth-card minehut-card" aria-label="Register">
        <Link className="auth-logo" href="/" aria-label="Kitty Kingdom home">
          <span className="brand-crest">KK</span>
        </Link>
        <h1>Kitty Kingdom</h1>
        <div className="auth-tabs" role="tablist" aria-label="Authentication tabs">
          <Link href="/login">Login</Link>
          <span className="active-tab">Sign up</span>
        </div>
        <p className="auth-intro">Create your account. We&apos;ll send an email confirmation link before login is enabled.</p>
        {status && statusMessages[status] ? <p className="auth-status">{statusMessages[status]}</p> : null}
        <form className="auth-form" action="/api/account/register" method="post">
          <label>
            Email <span>*</span>
            <input autoComplete="email" name="email" placeholder="you@example.com" required type="email" />
          </label>
          <label>
            Confirm email <span>*</span>
            <input autoComplete="email" name="confirmEmail" placeholder="you@example.com" required type="email" />
          </label>
          <PasswordField autoComplete="new-password" label="Password *" minLength={8} name="password" placeholder="Create a password" />
          <button type="submit">Send confirmation email <span aria-hidden="true">→</span></button>
        </form>
        <p className="auth-switch">Already have an account? <Link href="/login">Login</Link></p>
        <Link className="auth-help" href="/support">Need help signing up?</Link>
      </section>
    </main>
  );
}
