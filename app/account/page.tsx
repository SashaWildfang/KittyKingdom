import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "../../lib/auth";
import { PawSetting } from "../paw-setting";

const statusMessages: Record<string, string> = {
  "username-saved": "Username saved. Usernames can only be set once.",
  "username-taken": "That username is already taken.",
  "username-locked": "Your username is already set and cannot be changed.",
  "username-mismatch": "The username confirmation did not match.",
  "invalid-username":
    "Username must be 3–20 characters using letters, numbers, or underscores.",
  "password-saved": "Password updated.",
  "password-invalid": "Current password was not correct.",
  "password-requirements":
    "New password must be 8+ characters with at least one number and one symbol.",
  "service-unavailable": "Account settings are temporarily unavailable.",
  linked: "Discord account linked.",
};

function getAge(dateOfBirth: unknown, storedAge: unknown) {
  if (dateOfBirth) {
    const date = new Date(String(dateOfBirth));
    if (!Number.isNaN(date.getTime())) {
      const now = new Date();
      let age = now.getFullYear() - date.getFullYear();
      const monthDiff = now.getMonth() - date.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < date.getDate()))
        age -= 1;
      return age;
    }
  }
  return typeof storedAge === "number" ? storedAge : null;
}

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
  if (!user) redirect("/login?account=login-required");

  const status =
    searchParams.account ??
    searchParams.discord ??
    searchParams.verify ??
    searchParams.login;
  const age = getAge(user.dateOfBirth, user.age);

  return (
    <main className="auth-screen">
      <div className="auth-backdrop" />
      <section
        className="auth-card account-card compact-account-card"
        aria-label="My Account"
      >
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
          Manage your account settings when you are ready. Username and date of
          birth are locked after being set.
        </p>
        {status ? (
          <p className="auth-status">
            {statusMessages[status] ?? `Status: ${status}`}
          </p>
        ) : null}

        <div className="account-summary-grid">
          <div>
            <span>Email</span>
            <strong>{user.email}</strong>
          </div>
          <div>
            <span>Username</span>
            <strong>{user.username ?? "Not set"}</strong>
          </div>
          <div>
            <span>Discord</span>
            <strong>
              {user.discord?.username ?? user.discordId ?? "Not linked"}
            </strong>
          </div>
          <div>
            <span>Age</span>
            <strong>{age ?? "Not available"}</strong>
          </div>
        </div>

        <div className="account-settings-grid compact-settings-grid">
          <form
            className="auth-form"
            action="/api/account/username"
            method="post"
            autoComplete="off"
          >
            <h2>Username</h2>
            {user.username ? (
              <p className="form-note">
                Your username is set to <strong>{user.username}</strong>.
                Usernames can only be set once.
              </p>
            ) : (
              <>
                <label>
                  New username
                  <input
                    name="newUsername"
                    autoComplete="off"
                    placeholder="YourMCName"
                    pattern="[A-Za-z0-9_]{3,20}"
                    required
                  />
                </label>
                <label>
                  Confirm username
                  <input
                    name="confirmUsername"
                    autoComplete="off"
                    placeholder="YourMCName"
                    pattern="[A-Za-z0-9_]{3,20}"
                    required
                  />
                </label>
                <button type="submit">Save username</button>
              </>
            )}
          </form>

          <form
            className="auth-form"
            action="/api/account/password"
            method="post"
          >
            <h2>Password</h2>
            <label>
              Current password
              <input
                name="currentPassword"
                autoComplete="current-password"
                type="password"
                required
              />
            </label>
            <label>
              New password
              <input
                name="newPassword"
                autoComplete="new-password"
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
              {user.discordId
                ? "Your Discord account is linked."
                : "Connect Discord so your website account can match your community member identity."}
            </p>
            <Link className="form-button" href="/api/auth/discord">
              {user.discordId
                ? "Relink Discord account"
                : "Link Discord account"}
            </Link>
          </div>

          <div className="auth-form">
            <h2>Preferences</h2>
            <p>
              Paw cursor is off by default. You can enable it on this device.
            </p>
            <PawSetting />
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
