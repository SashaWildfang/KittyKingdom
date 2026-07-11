import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "../../lib/auth";
import { DiscordUnlinkForm } from "../discord-unlink-form";
import { getDiscordInviteSummary } from "../../lib/discord";
import { getJoinApplicationsCollection } from "../../lib/mongodb";
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
  "name-saved": "Name saved successfully.",
  "invalid-name": "Name must be 3–12 characters and use letters, numbers, or spaces only.",
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
  unlinked: "Discord account unlinked. Discord-only features are disabled until you link again.",
};

const monthNames: Record<string, number> = {
  jan: 0,
  january: 0,
  feb: 1,
  february: 1,
  mar: 2,
  march: 2,
  apr: 3,
  april: 3,
  may: 4,
  jun: 5,
  june: 5,
  jul: 6,
  july: 6,
  aug: 7,
  august: 7,
  sep: 8,
  sept: 8,
  september: 8,
  oct: 9,
  october: 9,
  nov: 10,
  november: 10,
  dec: 11,
  december: 11,
};

function normalizeDate(value: unknown) {
  if (!value) return null;
  const text = String(value).trim();
  const direct = new Date(text);
  if (!Number.isNaN(direct.getTime())) return direct;

  const match = text.match(
    /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s+(\d{1,2})(?:st|nd|rd|th)?[,]?\s+(\d{4})\b/i,
  );
  if (!match) return null;

  const month = monthNames[match[1].toLowerCase().replace(/\.$/, "")];
  const day = Number(match[2]);
  const year = Number(match[3]);
  if (month === undefined || !day || !year) return null;
  const parsed = new Date(Date.UTC(year, month, day));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getAge(dateOfBirth: unknown, storedAge: unknown) {
  const date = normalizeDate(dateOfBirth);
  if (date) {
    const now = new Date();
    let age = now.getFullYear() - date.getUTCFullYear();
    const monthDiff = now.getMonth() - date.getUTCMonth();
    if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < date.getUTCDate()))
      age -= 1;
    return age;
  }
  return typeof storedAge === "number" ? storedAge : null;
}

function formatDob(dateOfBirth: unknown) {
  const date = normalizeDate(dateOfBirth);
  if (!date) return dateOfBirth ? String(dateOfBirth) : "Not available";
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

async function getJoinApplicationProfile(discordId: unknown) {
  if (!discordId) return null;
  try {
    const joinApplications = await getJoinApplicationsCollection();
    return (await joinApplications.findOne({
      $or: [
        { discordId: String(discordId) },
        { discord_id: String(discordId) },
        { userId: String(discordId) },
        { user_id: String(discordId) },
        { id: String(discordId) },
      ],
    })) as Record<string, unknown> | null;
  } catch {
    return null;
  }
}

function getApplicationAgeAndDob(application: Record<string, unknown> | null) {
  if (!application) return { ageSource: null, dobSource: null };
  const ageAndDob =
    application.ageAndDob ??
    application.age_and_dob ??
    application.ageDOB ??
    application.ageDob ??
    null;
  const dobSource =
    application.dateOfBirth ??
    application.date_of_birth ??
    application.dob ??
    application.DoB ??
    application.DOB ??
    application.birthdate ??
    ageAndDob;
  const ageSource = application.age ?? application.Age;
  return { ageSource, dobSource };
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
  const application = await getJoinApplicationProfile(user.discordId);
  const { ageSource, dobSource } = getApplicationAgeAndDob(application);
  const age = getAge(dobSource ?? user.dateOfBirth, ageSource ?? user.age);
  const dob = formatDob(dobSource ?? user.dateOfBirth);
  const displayName = typeof user.displayName === "string" ? user.displayName : null;
  const heading = displayName ? `Welcome ${displayName}` : "My Account";

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
            My Account
          </a>
          <form action="/api/account/logout" method="post">
            <button className="primary-pill logout-pill" type="submit">
              Logout
            </button>
          </form>
        </div>
      </nav>

      <section className="account-hero" aria-label="My Account">
        <p className="eyebrow">Member portal</p>
        <h1>{heading}</h1>
        <p>
          Manage your Kitty Kingdom profile, Discord link, password, and account
          preferences.
        </p>
        {status ? (
          <p
            className={`auth-status account-status-banner ${status === "linked" ? "account-status-success" : ""}`}
          >
            {statusMessages[status] ?? `Status: ${status}`}
          </p>
        ) : null}
      </section>

      <section className="account-dashboard" aria-label="Account dashboard">
        <nav className="account-menu" aria-label="Account menu">
          <a href="#account-details">Account Details</a>
          <a href="#discord-account">Discord</a>
          <a href="#security">Security</a>
          <a href="#preferences">Preferences</a>
          <a href="#delete-account">Delete Account</a>
        </nav>

        <div className="account-summary-panel">
          <div>
            <span>Email</span>
            <strong>{user.email}</strong>
          </div>
          <div>
            <span>Username</span>
            <strong>{user.username ?? "Not set"}</strong>
          </div>
          <div className="summary-discord-card">
            <span>Discord</span>
            <strong>{user.discord?.username ?? user.discordId ?? "Not linked"}</strong>
            {user.discordId ? <span className="summary-linked-badge">✓ Linked</span> : null}
          </div>
          <div>
            <span>Age</span>
            <strong>{age ?? "Not available"}</strong>
          </div>
          <div>
            <span>Date of Birth</span>
            <strong>{dob}</strong>
          </div>
        </div>

        <div className="account-main-grid">
          <section className="account-section-card" id="account-details">
            <h2>Account Details</h2>
            <form action="/api/account/name" method="post" autoComplete="off">
              <label>
                Name
                <input
                  name="displayName"
                  autoComplete="off"
                  defaultValue={displayName ?? ""}
                  placeholder="Your name"
                  minLength={3}
                  maxLength={12}
                  pattern="[A-Za-z0-9 ]{3,12}"
                  required
                />
              </label>
              <p className="form-note">3–12 characters. Letters, numbers, and spaces only.</p>
              <button type="submit">Save name</button>
            </form>

            <form action="/api/account/username" method="post" autoComplete="off">
              <h3>Username</h3>
              <p className="form-note">
                Username can only be set once. If you need to change your username later,
                contact the staff team on Discord.
              </p>
              {user.username ? (
                <p className="form-note">
                  Your username is <strong>{user.username}</strong>.
                </p>
              ) : (
                <>
                  <label>
                    New username
                    <input
                      name="newUsername"
                      autoComplete="off"
                      placeholder="YourUsername"
                      pattern="[A-Za-z0-9_]{3,20}"
                      required
                    />
                  </label>
                  <label>
                    Confirm username
                    <input
                      name="confirmUsername"
                      autoComplete="off"
                      placeholder="YourUsername"
                      pattern="[A-Za-z0-9_]{3,20}"
                      required
                    />
                  </label>
                  <button type="submit">Save username</button>
                </>
              )}
            </form>
          </section>

          <div className="account-section-card discord-account-card" id="discord-account">
            <span className="discord-mark">
              <DiscordIcon />
            </span>
            <div>
              <div className="discord-title-row">
                <h2>Discord Account</h2>
              </div>
              <p>
                {user.discordId
                  ? "Your Discord account is linked. Relink if you need to refresh your Discord member details."
                  : "Link Discord so your website account can match your community member identity."}
              </p>
            </div>
            <div className="discord-actions-row">
              <Link className="discord-link-button" href="/api/auth/discord">
                <DiscordIcon />
                {user.discordId ? "Relink Discord" : "Link Discord Account"}
              </Link>
              {user.discordId ? <DiscordUnlinkForm /> : null}
            </div>
          </div>

          <form
            className="account-section-card"
            id="security"
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

        </div>

        <section className="account-section-card preferences-section" id="preferences">
          <h2>Preferences</h2>
          <p>Paw cursor is off by default. You can enable it on this device.</p>
          <PawSetting />
        </section>

        <form
          className="account-danger-zone"
          id="delete-account"
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
