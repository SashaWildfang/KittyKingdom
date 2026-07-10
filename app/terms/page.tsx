import Link from "next/link";

export default function TermsPage() {
  return (
    <main className="legal-page">
      <section className="legal-card wide-card">
        <Link
          className="auth-logo"
          href="/home"
          aria-label="Kitty Kingdom home"
        >
          <img
            className="auth-logo-img"
            src="/logo.png"
            alt="Kitty Kingdom logo"
          />
        </Link>
        <h1>Terms of Service</h1>
        <p>
          <strong>Last updated:</strong> July 2026
        </p>
        <p>
          By accessing Kitty Kingdom, creating an account, joining linked
          Discord services, or using member features, you agree to these Terms
          of Service.
        </p>
        <h2>Eligibility</h2>
        <p>
          Kitty Kingdom is intended for members who are 18 years of age or
          older. Some Discord areas and dating-related features may require ID
          verification or additional staff approval.
        </p>
        <h2>Community conduct</h2>
        <p>
          You agree to follow the community rules, respect other members and
          staff, avoid harassment, spam, raids, impersonation, scams, illegal
          content, and any behavior that harms the safety or comfort of the
          community.
        </p>
        <h2>Accounts and security</h2>
        <p>
          You are responsible for your account credentials and activity. Staff
          may restrict, suspend, or remove access when accounts are misused,
          compromised, or violate community rules.
        </p>
        <h2>Member features</h2>
        <p>
          Leaderboards, profiles, dating features, store items, custom roles,
          Discord linking, and future website tools may change, be moderated, or
          be removed as the community evolves.
        </p>
        <h2>Moderation</h2>
        <p>
          Kitty Kingdom staff may review content, remove content, restrict
          access, or take moderation action to protect the server, members, and
          platform integrity.
        </p>
        <h2>Purchases and perks</h2>
        <p>
          Server store items, roles, boosters, and supporter perks are subject
          to availability and community rules. Abuse, chargebacks, or rule
          violations may affect access to perks.
        </p>
        <h2>Changes</h2>
        <p>
          These terms may be updated as Kitty Kingdom grows. Continued use of
          the site or Discord community after updates means you accept the
          revised terms.
        </p>
        <Link className="form-button" href="/register">
          Back to sign up
        </Link>
      </section>
    </main>
  );
}
