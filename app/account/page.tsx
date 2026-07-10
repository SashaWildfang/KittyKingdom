import Link from "next/link";

export default function AccountPage({ searchParams }: { searchParams: { account?: string; discord?: string; verify?: string } }) {
  const status = searchParams.account ?? searchParams.discord ?? searchParams.verify;

  return (
    <main className="auth-screen">
      <div className="auth-backdrop" />
      <section className="auth-card account-card" aria-label="Account settings">
        <Link className="auth-logo" href="/" aria-label="Kitty Kingdom home">
          <span className="brand-crest">KK</span>
        </Link>
        <h1>Account Settings</h1>
        <p className="auth-intro">Finish your member profile, create a username, and link Discord.</p>
        {status ? <p className="auth-status">Status: {status}</p> : null}
        <div className="account-settings-grid">
          <form className="auth-form" action="/api/account/username" method="post">
            <h2>Create username</h2>
            <label>
              Username
              <input name="username" pattern="[A-Za-z0-9_]{3,20}" placeholder="YourMCName" required />
            </label>
            <button type="submit">Save username</button>
          </form>
          <div className="auth-form discord-settings-card">
            <h2>Discord</h2>
            <p>Connect Discord so your website account can match your community member identity.</p>
            <Link className="form-button" href="/api/auth/discord">Link Discord account</Link>
          </div>
        </div>
        <Link className="auth-help" href="/">Back to homepage</Link>
      </section>
    </main>
  );
}
