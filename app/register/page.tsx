import Link from "next/link";
import { RegisterForm } from "../register-form";

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
        <RegisterForm />
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
