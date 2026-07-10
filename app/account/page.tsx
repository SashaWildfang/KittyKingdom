import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "../../lib/auth";

const statusMessages: Record<string, string> = {
  "username-saved": "Username updated.",
  "username-taken": "That username is already taken.",
  "invalid-username":
    "Username must be 3–20 characters using letters, numbers, or underscores.",
  "password-saved": "Password updated.",
  "password-invalid": "Current password was not correct.",
  "password-requirements":
    "New password must be 8+ characters with at least one number and one symbol.",
  "service-unavailable": "Account settings are temporarily unavailable.",
};

export default async function AccountPage({
  searchParams,
}: {
  searchParams: {
    account?: string;
    discord?: string;
    verify?: string;
    login?: string;
  };
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login?account=login-required");
  }

  const status =
    searchParams.account ??
    searchParams.discord ??
    searchParams.verify ??
    searchParams.login;

  return (
    <main className="auth-screen">
      <div className="auth-backdrop" />
      <section className="auth-card account-card" aria-label="My Account">
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
        <h1>My Account</h1>
        <p className="auth-intro">
          Manage your username, password, and Discord connection when you are
          ready.
        </p>
        {status ? (
          <p className="auth-status">
            {statusMessages[status] ?? `Status: ${status}`}
          </p>
        ) : null}
        <div className="account-settings-grid">
          <form
            className="auth-form"
            action="/api/account/username"
            method="post"
          >
            <h2>Username</h2>
            <p className="form-note">
              Current: {user.username ?? "not set yet"}
            </p>
            <label>
              New username
              <input
                name="username"
                pattern="[A-Za-z0-9_]{3,20}"
                placeholder="YourMCName"
                required
              />
            </label>
            <button type="submit">Save username</button>
          </form>

          <form
            className="auth-form"
            action="/api/account/password"
            method="post"
          >
            <h2>Password</h2>
            <label>
              Current password
              <input name="currentPassword" type="password" required />
            </label>
            <label>
              New password
              <input
                name="newPassword"
                type="password"
                minLength={8}
                required
              />
            </label>
            <p className="form-note">
              8+ characters with at least one number and one symbol.
            </p>
            <button type="submit">Update password</button>
          </form>

          <div className="auth-form discord-settings-card">
            <h2>Discord</h2>
            <p>
              Connect Discord so your website account can match your community
              member identity.
            </p>
            <Link className="form-button" href="/api/auth/discord">
              Link Discord account
            </Link>
          </div>

          <form
            className="auth-form"
            action="/api/account/logout"
            method="post"
          >
            <h2>Session</h2>
            <p>
              You will be automatically signed out after a period of inactivity.
            </p>
            <button type="submit">Logout</button>
          </form>
        </div>
        <Link className="auth-help" href="/home">
          Back to homepage
        </Link>
      </section>
    </main>
  );
}
