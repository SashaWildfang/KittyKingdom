import Link from "next/link";

export default function TermsPage() {
  return (
    <main className="legal-page">
      <section className="legal-card">
        <Link className="auth-logo" href="/" aria-label="Kitty Kingdom home">
          <img className="auth-logo-img" src="/logo.png" alt="Kitty Kingdom logo" />
        </Link>
        <h1>Terms of Service</h1>
        <p>
          By using Kitty Kingdom, you agree to follow community rules, respect other members, and use the platform safely and honestly.
        </p>
        <p>
          Member-only areas, dating profiles, Discord linking, store features, and leaderboards may be moderated or restricted to protect the community.
        </p>
        <p>
          These starter terms should be reviewed and replaced with final legal language before public launch.
        </p>
        <Link className="form-button" href="/register">Back to sign up</Link>
      </section>
    </main>
  );
}
