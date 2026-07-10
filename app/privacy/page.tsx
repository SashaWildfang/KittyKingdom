import Link from "next/link";

export default function PrivacyPage() {
  return (
    <main className="legal-page">
      <section className="legal-card">
        <Link className="auth-logo" href="/" aria-label="Kitty Kingdom home">
          <img className="auth-logo-img" src="/logo.png" alt="Kitty Kingdom logo" />
        </Link>
        <h1>Privacy Policy</h1>
        <p>
          Kitty Kingdom stores account information such as email, password hash, username, email verification status, and linked Discord profile data.
        </p>
        <p>
          This information is used for authentication, account settings, member features, moderation, and Discord community verification.
        </p>
        <p>
          This starter policy should be reviewed and replaced with final legal language before public launch.
        </p>
        <Link className="form-button" href="/register">Back to sign up</Link>
      </section>
    </main>
  );
}
