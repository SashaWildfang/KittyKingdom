import Link from "next/link";

export default function ForgotPasswordPage() {
  return (
    <main className="auth-screen">
      <div className="auth-backdrop" />
      <section className="auth-card minehut-card">
        <Link className="auth-logo" href="/" aria-label="Kitty Kingdom home">
          <img className="auth-logo-img" src="/logo.png" alt="Kitty Kingdom logo" />
        </Link>
        <h1>Password Reset</h1>
        <p className="auth-intro">Password reset emails are the next account feature. For now, contact staff if you need help logging in.</p>
        <Link className="form-button" href="/login">Back to login</Link>
      </section>
    </main>
  );
}
