import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "../../lib/auth";
import { getDiscordInviteSummary } from "../../lib/discord";
import { OnlineStatus } from "../online-status";
import { PawSetting } from "../paw-setting";
import { ThemeToggle } from "../theme-toggle";

const statusMessages: Record<string, string> = {
  "username-saved": "Username saved. Usernames can only be set once.",
  "username-taken": "That username is already taken.",
  "username-locked": "Your username is already set and cannot be changed.",
  "username-mismatch": "The username confirmation did not match.",
  "invalid-username":
    "Username must be 3–20 characters using letters, numbers, or underscores.",
  "password-saved": "Password updated successfully.",
  "password-invalid": "Current password was not correct.",
  "password-requirements":
    "New password must be 8+ characters with at least one number and one symbol.",
  "delete-confirmation-invalid":
    "Type DELETE MY ACCOUNT exactly before deleting your account.",
  "delete-password-invalid": "Password was not correct, so the account was not deleted.",
  "service-unavailable": "Account settings are temporarily unavailable.",
  success: "Email verified. Welcome to Kitty Kingdom — finish your account details here.",
  linked:
    "Discord account linked. Your Discord ID and application details were synced.",
  invalid:
    "Discord linking could not be verified. Please start from the Link Discord button again.",
  "not-configured": "Discord linking is not configured yet. Please contact staff.",
  "token-failed":
    "Discord rejected the login callback. Please try linking Discord again.",
  "user-failed":
    "Discord connected, but your profile could not be loaded. Please try again.",
  "guild-required": "Join the Kitty Kingdom Discord before linking your account.",
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

function DiscordIcon() {
  return (
    <svg viewBox="0 0 127.14 96.36" role="img" aria-hidden="true">
      <path d="M107.7 8.07A105.15 105.15 0 0 0 81.47 0a72.06 72.06 0 0 0-3.36 6.83 97.68 97.68 0 0 0-29.11 0A72.37 72.37 0 0 0 45.64 0 105.89 105.89 0 0 0 19.39 8.09C2.79 32.65-1.71 56.6.54 80.21a105.73 105.73 0 0 0 32.17 16.15 77.7 77.7 0 0 0 6.89-11.11 68.42 68.42 0 0 1-10.85-5.18c.91-.66 1.8-1.34 2.66-2.03a75.57 75.57 0 0 0 64.32 0c.87.71 1.76 1.39 2.66 2.03a68.68 68.68 0 0 1-10.87 5.19 77 77 0 0 0 6.89 11.1 105.25 105.25 0 0 0 32.19-16.14c2.64-27.38-4.51-51.11-18.9-72.15ZM42.45 65.69C36.18 65.69 31 60 31 53s5-12.74 11.43-12.74S54 46 53.89 53s-5.05 12.69-11.44 12.69Zm42.24 0C78.41 65.69 73.25 60 73.25 53s5-12.74 11.44-12.74S96.23 46 96.12 53s-5.04 12.69-11.43 12.69Z" />
    </svg>
  );
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
  const [user, discord] = await Promise.all([
    getCurrentUser(),
    getDiscordInviteSummary(),
  ]);
  if (!user) redirect("/login?account=login-required");

  const status =
    searchParams.account ??
    searchParams.discord ??
    searchParams.verify ??
    searchParams.login;
  const age = getAge(user.dateOfBirth, user.age);

  return (
    <main className="site-shell account-site-shell">
      <div className="leaf-field" aria-hidden="true" />
      <nav className="topbar" aria-label="Main navigation">
        <a className="brand" href="/home" aria-label="Kitty Kingdom home">
          <img
            className="brand-logo-img"
            src="/logo.png"
            alt="Kitty Kingdom logo"
          />
          <span className="brand-copy">
            <strong>Kitty Kingdom</strong>
            <OnlineStatus initialOnline={discord.online} />
          </span>
        </a>
        <div className="tabs">
          <a href="/home">Home</a>
          <a href="/news">News</a>
          <a href="https://discord.com/invite/M9XKHFdYQV">Discord</a>
          <a href="/staff">Staff</a>
        </div>
        <div className="nav-actions">
          <ThemeToggle />
          <a className="login-link logged-in-link" href="/account">
            Account
          </a>
          <form action="/api/account/logout" method="post">
            <button className="primary-pill" type="submit">
              Logout
            </button>
          </form>
        </div>
      </nav>

      <section className="account-hero" aria-label="My Account">
        <p className="eyebrow">Member portal</p>
        <h1>My Account</h1>
        <p>
          Manage your Kitty Kingdom profile, Discord link, password, and account
          preferences.
        </p>
        {status ? (
          <p className="auth-status account-status-banner">
            {statusMessages[status] ?? `Status: ${status}`}
          </p>
        ) : null}
      </section>

      <section className="account-dashboard" aria-label="Account dashboard">
        <div className="account-summary-panel">
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
            <strong>{user.discord?.username ?? user.discordId ?? "Not linked"}</strong>
          </div>
          <div>
            <span>Age</span>
            <strong>{age ?? "Not available"}</strong>
          </div>
        </div>

        <div className="account-main-grid">
          <form
            className="account-section-card"
            action="/api/account/username"
            method="post"
            autoComplete="off"
          >
            <h2>Account Details</h2>
            {user.username ? (
              <p className="form-note">
                Your username is <strong>{user.username}</strong>. Usernames can
                only be set once.
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

          <div className="account-section-card discord-account-card">
            <span className="discord-mark">
              <DiscordIcon />
            </span>
            <div>
              <h2>Discord Account</h2>
              <p>
                {user.discordId
                  ? "Your Discord account is linked. Relink if you need to refresh your Discord member details."
                  : "Link Discord so your website account can match your community member identity."}
              </p>
            </div>
            <Link className="discord-link-button" href="/api/auth/discord">
              <DiscordIcon />
              {user.discordId ? "Relink Discord" : "Link Discord Account"}
            </Link>
          </div>

          <form
            className="account-section-card"
            action="/api/account/password"
            method="post"
            autoComplete="off"
          >
            <h2>Security</h2>
            <label>
              Current password
              <input
                name="currentAccountPassword"
                autoComplete="off"
                data-1p-ignore="true"
                data-lpignore="true"
                type="password"
                required
              />
            </label>
            <label>
              New password
              <input
                name="newAccountPassword"
                autoComplete="off"
                data-1p-ignore="true"
                data-lpignore="true"
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

          <div className="account-section-card">
            <h2>Preferences</h2>
            <p>Paw cursor is off by default. You can enable it on this device.</p>
            <PawSetting />
          </div>
        </div>

        <form
          className="account-danger-zone"
          action="/api/account/delete"
          method="post"
          autoComplete="off"
        >
          <div>
            <p className="eyebrow">Danger zone</p>
            <h2>Delete Account</h2>
            <p>
              This permanently deletes your website account. Type{" "}
              <strong>DELETE MY ACCOUNT</strong> and enter your password to
              confirm.
            </p>
          </div>
          <label>
            Confirmation
            <input
              name="deleteConfirmation"
              autoComplete="off"
              placeholder="DELETE MY ACCOUNT"
              required
            />
          </label>
          <label>
            Password
            <input
              name="deletePassword"
              autoComplete="off"
              data-1p-ignore="true"
              data-lpignore="true"
              type="password"
              required
            />
          </label>
          <button type="submit">Delete account</button>
        </form>
      </section>
    </main>
  );
}
