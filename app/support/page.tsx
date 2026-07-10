import Link from "next/link";

export default function SupportPage() {
  return (
    <main className="auth-screen">
      <div className="auth-backdrop" />
      <section className="auth-card minehut-card">
        <Link className="auth-logo" href="/" aria-label="Kitty Kingdom home">
          <img
            className="auth-logo-img"
            src="/logo.png"
            alt="Kitty Kingdom logo"
          />
        </Link>
        <h1>Account Help</h1>
        <p className="auth-intro">
          Need help with your Kitty Kingdom account? Contact a staff member in
          Discord while the support flow is being built.
        </p>
        <Link className="form-button" href="/login">
          Back to login
        </Link>
      </section>
    </main>
  );
}
