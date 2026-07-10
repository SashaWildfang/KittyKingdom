import Link from "next/link";

export default function PrivacyPage() {
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
        <h1>Privacy Policy</h1>
        <p>
          <strong>Last updated:</strong> July 2026
        </p>
        <p>
          This Privacy Policy explains how Kitty Kingdom collects and uses
          information for the website, account system, Discord linking,
          moderation, and member features.
        </p>
        <h2>Information we collect</h2>
        <p>
          We may store your email address, username, password hash, email
          verification status, policy acceptance timestamp, session cookies,
          linked Discord account information, staff/member profile details, and
          feature activity needed for the site.
        </p>
        <h2>How information is used</h2>
        <p>
          Information is used to create and secure accounts, verify email
          addresses, support login, link Discord identities, operate member
          features, moderate the community, prevent abuse, and improve Kitty
          Kingdom.
        </p>
        <h2>Discord data</h2>
        <p>
          When Discord linking or public staff display features are used, Kitty
          Kingdom may request Discord profile details such as user ID, avatar,
          username, guild membership, or online invite counts through Discord
          APIs.
        </p>
        <h2>Cookies and sessions</h2>
        <p>
          We use secure session cookies to keep users logged in and protect
          account routes. You can clear cookies in your browser to end a
          session.
        </p>
        <h2>Data sharing</h2>
        <p>
          We do not sell personal data. Information may be shared with service
          providers that operate the website, database, email delivery, hosting,
          or Discord integrations, and when required for safety, moderation, or
          legal compliance.
        </p>
        <h2>Retention and deletion</h2>
        <p>
          Account and moderation records may be retained while your account
          exists or while needed for safety, abuse prevention, or community
          operations. Contact staff if you need account assistance.
        </p>
        <h2>Security</h2>
        <p>
          Passwords are stored as hashes, and sensitive configuration is stored
          in environment variables. No online system is perfect, so members
          should use strong unique passwords.
        </p>
        <Link className="form-button" href="/register">
          Back to sign up
        </Link>
      </section>
    </main>
  );
}
