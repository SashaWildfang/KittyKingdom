import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "../../lib/auth";
import { DiscordUnlinkForm } from "../discord-unlink-form";
import { getDiscordInviteSummary } from "../../lib/discord";
import { getJoinApplicationsCollection } from "../../lib/mongodb";
import type { CSSProperties } from "react";
import { SiteNav } from "../site-nav";
import { VerifyEmailBanner } from "../verify-email-banner";
import { BrandIcon } from "../brand-icon";
import { getMemberRoleSummary } from "../../lib/discord-member";
import { formatPhone, SOCIALS, type SocialLink } from "../../lib/contact";
import { calculateAge, formatDateOfBirth, parseAge, parseDateOfBirth } from "../../lib/dates";
import { getRoleState } from "../../lib/member-roles";
import { CollapsibleCard } from "./collapsible-card";
import { RoleManager } from "./role-manager";

const statusMessages: Record<string, string> = {
  "contact-saved": "Contact details and social links saved.",
  "invalid-phone": "That phone number doesn't look right. Include your country code, e.g. +1 555 123 4567.",
  "invalid-twitter": "That Twitter / X handle isn't valid. Use @handle or an x.com link.",
  "invalid-telegram": "That Telegram username isn't valid. Use @username (5+ characters) or a t.me link.",
  "invalid-youtube": "That YouTube channel isn't valid. Use @channel or a youtube.com link.",
  "invalid-steam": "That Steam profile isn't valid. Use your custom ID or a steamcommunity.com link.",
  "username-saved": "Username saved. Usernames can only be set once.",
  "username-taken": "That username is already taken.",
  "username-locked": "Your username is already set and cannot be changed.",
  "username-mismatch": "The username confirmation did not match.",
  "invalid-username":
    "Username must be 3–20 characters using letters, numbers, or underscores.",
  "name-saved": "Name saved successfully.",
  "invalid-name": "Name must be 3–12 characters and use letters, numbers, or spaces only.",
  "password-saved": "Password updated. Other devices have been signed out.",
  "password-reset": "Your new password is saved and you're signed in. Other devices have been signed out.",
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

const successStatuses = new Set(["password-reset", "username-saved", "name-saved", "password-saved", "success", "linked", "unlinked", "contact-saved"]);

// What to show in a social link's input box: the short handle/ID when there is one, else the full link
function socialInputValue(link: SocialLink | undefined) {
  if (!link) return "";
  return link.handle === "Steam profile" || link.handle === "YouTube channel" ? link.url : link.handle;
}

function rankStyle(colors: string[]): CSSProperties {
  // One color for normal roles; Discord's gradient roles have two (or three for holographic)
  const stops = colors.length === 1 ? [colors[0], colors[0]] : colors;
  return { "--rank-gradient": `linear-gradient(90deg, ${stops.join(", ")})` } as CSSProperties;
}

function formatMonthYear(date: Date) {
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(date);
}

function getAge(dobSource: unknown, ageSource: unknown) {
  // The birth date is the most reliable source; otherwise use a stated age ("36" or "36 years old")
  const birthDate = parseDateOfBirth(dobSource);
  if (birthDate) return calculateAge(birthDate);
  return parseAge(ageSource) ?? parseAge(dobSource);
}

function formatDob(dobSource: unknown) {
  const birthDate = parseDateOfBirth(dobSource);
  return birthDate ? formatDateOfBirth(birthDate) : "Not available";
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
  const [application, roles, roleState] = await Promise.all([
    getJoinApplicationProfile(user.discordId),
    getMemberRoleSummary(user.discordId),
    user.discordId ? getRoleState(String(user.discordId)).catch(() => null) : Promise.resolve(null),
  ]);
  const socials = (user.socials ?? {}) as Partial<Record<string, SocialLink>>;
  const phone = typeof user.phone === "string" ? user.phone : null;
  const { ageSource, dobSource } = getApplicationAgeAndDob(application);
  const age = getAge(dobSource ?? user.dateOfBirth, ageSource ?? user.age);
  const dob = formatDob(dobSource ?? user.dateOfBirth);
  const displayName = typeof user.displayName === "string" ? user.displayName : null;
  const heading = displayName ? `Welcome back, ${displayName}` : "My Account";
  const shownName = displayName ?? user.username ?? user.email.split("@")[0];
  const discordLinked = Boolean(user.discordId);
  const discordName = discordLinked ? String(user.discord?.username ?? user.discordId) : null;
  const memberSince = user.createdAt instanceof Date ? formatMonthYear(user.createdAt) : null;
  const statusText = status ? statusMessages[status] ?? `Status: ${status}` : null;
  const statusTone = status && successStatuses.has(status) ? "success" : "error";

  return (
    <main className="site-shell account-site-shell">
      <div className="leaf-field" aria-hidden="true" />
      <SiteNav signedIn discordOnline={discord.online} />

      <section className="account-hero acct-hero" aria-label="My Account">
        <p className="eyebrow">Member portal</p>
        <h1>{heading}</h1>
        <p>Manage your Kitty Kingdom profile, Discord link, and account security — all in one place.</p>
      </section>

      {user.emailVerified === false ? (
        <div className="acct-banner-wrap">
          <VerifyEmailBanner email={user.email} />
        </div>
      ) : null}

      {statusText ? (
        <div className={`acct-status acct-status--${statusTone}`} role="status">
          <span aria-hidden="true">{statusTone === "success" ? "✓" : "!"}</span>
          {statusText}
        </div>
      ) : null}

      {user.mustChangePassword ? (
        <div className="acct-temp-password" role="alert">
          <strong>🔑 You&apos;re using a temporary password from staff.</strong>
          <span>Please choose your own password now.</span>
          <a href="#security">Change password →</a>
        </div>
      ) : null}

      <div className="acct-layout">
        {/* ---------- Sidebar: profile summary + section links ---------- */}
        <aside className="acct-sidebar">
          <div className="acct-profile-card">
            <div className="acct-avatar">
              {discordLinked ? (
                <img src={`/api/discord/avatar/${user.discordId}`} alt="" width="88" height="88" />
              ) : (
                <span aria-hidden="true">{shownName.charAt(0).toUpperCase()}</span>
              )}
            </div>
            <h2>{shownName}</h2>
            {user.username ? <p className="acct-handle">@{user.username}</p> : null}
            {roles.isStaff ? <p className="acct-staff-line">Staff Member</p> : null}
            {roles.rank ? (
              <div className="acct-rank-row">
                <span className="acct-rank" style={rankStyle(roles.rank.colors)} title="Your highest Discord role">
                  <i aria-hidden="true" />
                  <span>{roles.rank.name}</span>
                </span>
              </div>
            ) : null}
            {roleState?.inServer ? (
              <div className="acct-server-status" aria-label="Server status">
                {roleState.level !== null ? (
                  <span className="acct-level" title="Your level in the Discord server">
                    ⭐ Level <strong>{roleState.level}</strong>
                  </span>
                ) : null}
                <ul>
                  {roleState.status
                    .filter((r) => r.key !== "patreon" || r.has)
                    .map((r) => (
                      <li key={r.key} className={r.has ? "is-on" : undefined} title={r.has ? `You have ${r.label}` : `You don't have ${r.label} yet`}>
                        <span aria-hidden="true">{r.icon}</span> {r.label}
                        <i aria-hidden="true">{r.has ? "✓" : "–"}</i>
                      </li>
                    ))}
                </ul>
              </div>
            ) : (
              <div className="acct-badges">
                <span className={`acct-badge ${discordLinked ? "acct-badge--discord" : "acct-badge--muted"}`}>
                  {discordLinked ? "Discord linked" : "Discord not linked"}
                </span>
              </div>
            )}
            {SOCIALS.some((s) => socials[s.key]) ? (
              <div className="acct-social-icons">
                {SOCIALS.filter((s) => socials[s.key]).map((s) => (
                  <a
                    key={s.key}
                    href={socials[s.key]!.url}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    title={`${s.label}: ${socials[s.key]!.handle}`}
                    aria-label={`${s.label}: ${socials[s.key]!.handle}`}
                  >
                    <BrandIcon network={s.key} />
                  </a>
                ))}
              </div>
            ) : null}
            {memberSince ? <p className="acct-since">🍂 Member since {memberSince}</p> : null}
          </div>

          <nav className="acct-nav" aria-label="Account sections">
            <a href="#overview"><span aria-hidden="true">📋</span> Overview</a>
            {discordLinked ? <a href="#roles"><span aria-hidden="true">🎭</span> Server roles</a> : null}
            <a href="#profile"><span aria-hidden="true">👤</span> Profile</a>
            <a href="#contact"><span aria-hidden="true">🔗</span> Contact &amp; socials</a>
            <a href="#discord-account"><span aria-hidden="true">💬</span> Discord</a>
            <a href="#security"><span aria-hidden="true">🔒</span> Security</a>
            <a className="acct-nav-danger" href="#delete-account"><span aria-hidden="true">⚠️</span> Delete account</a>
          </nav>
        </aside>

        {/* ---------- Main column ---------- */}
        <div className="acct-main">
          <CollapsibleCard id="overview" title={"Overview"} description={"Your account details. Age and birthday come from your Discord join application."}>
            <dl className="acct-info-grid">
              <div>
                <dt>Email</dt>
                <dd>{user.email}</dd>
              </div>
              <div>
                <dt>Username</dt>
                <dd>{user.username ?? <span className="acct-muted">Not set</span>}</dd>
              </div>
              <div>
                <dt>Discord</dt>
                <dd>{discordName ?? <span className="acct-muted">Not linked</span>}</dd>
              </div>
              <div>
                <dt>Age</dt>
                <dd>{age ?? <span className="acct-muted">Not available</span>}</dd>
              </div>
              <div>
                <dt>Date of birth</dt>
                <dd>{dob === "Not available" ? <span className="acct-muted">Not available</span> : dob}</dd>
              </div>
              <div>
                <dt>Member since</dt>
                <dd>{memberSince ?? <span className="acct-muted">—</span>}</dd>
              </div>
            </dl>
          </CollapsibleCard>

          {discordLinked ? (
            <CollapsibleCard
              id="roles"
              title="Server roles"
              description="Pick your roles here and they update in Discord instantly, just like the role selector."
              summary={
                roleState
                  ? `${roleState.categories.reduce((n, c) => n + c.roles.filter((r) => r.has).length, 0)} picked · ${roleState.colorRoles.length}/${roleState.colorRoleTotal} colors`
                  : undefined
              }
            >
              <RoleManager initial={roleState} />
            </CollapsibleCard>
          ) : null}

          <CollapsibleCard id="profile" title={"Profile"} description={"How you appear around the site."}>
            <div className="acct-form-grid">
              <form className="acct-form" action="/api/account/name" method="post" autoComplete="off">
                <label>
                  Display name
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
                <button className="acct-button" type="submit">Save name</button>
              </form>

              <form className="acct-form" action="/api/account/username" method="post" autoComplete="off">
                {user.username ? (
                  <>
                    <label>
                      Username
                      <span className="acct-locked-field">
                        <input value={user.username} readOnly aria-readonly="true" />
                        <span aria-hidden="true">🔒</span>
                      </span>
                    </label>
                    <p className="form-note">
                      Usernames can only be set once. Need a change? Contact the staff team on Discord.
                    </p>
                  </>
                ) : (
                  <>
                    <label>
                      Username
                      <input name="newUsername" autoComplete="off" placeholder="YourUsername" pattern="[A-Za-z0-9_]{3,20}" required />
                    </label>
                    <label>
                      Confirm username
                      <input name="confirmUsername" autoComplete="off" placeholder="YourUsername" pattern="[A-Za-z0-9_]{3,20}" required />
                    </label>
                    <p className="form-note">3–20 letters, numbers, or underscores. This can only be set once.</p>
                    <button className="acct-button" type="submit">Save username</button>
                  </>
                )}
              </form>
            </div>
          </CollapsibleCard>

          <CollapsibleCard id="contact" title={"Contact & socials"} description={"All optional. Paste a link or type your @handle — leave a box empty to remove it."}>
            <form className="acct-form" action="/api/account/contact" method="post" autoComplete="off">
              <label>
                Phone number
                <input
                  name="phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  defaultValue={phone ? formatPhone(phone) : ""}
                  placeholder="+1 555 123 4567"
                  maxLength={24}
                />
              </label>
              <p className="form-note">🔒 Private — only you can see your phone number. Include your country code if you&apos;re outside the US/Canada.</p>
              <div className="acct-socials-grid">
                {SOCIALS.map((s) => (
                  <label key={s.key}>
                    <span className="acct-social-label">
                      <BrandIcon network={s.key} size={15} /> {s.label}
                    </span>
                    <input name={s.key} defaultValue={socialInputValue(socials[s.key])} placeholder={s.placeholder} maxLength={200} />
                  </label>
                ))}
              </div>
              <button className="acct-button" type="submit">Save contact details</button>
            </form>
          </CollapsibleCard>

          <section className="acct-card acct-discord" id="discord-account">
            <span className="acct-discord-icon">
              <DiscordIcon />
            </span>
            <div className="acct-discord-copy">
              <h2>Discord</h2>
              <p>
                {discordLinked ? (
                  <>
                    Linked as <strong>{discordName}</strong>. Relink to refresh your member details.
                  </>
                ) : (
                  "Link Discord so your website account matches your community member identity."
                )}
              </p>
            </div>
            <div className="acct-discord-actions">
              <Link className="discord-link-button" href="/api/auth/discord">
                <DiscordIcon />
                {discordLinked ? "Relink" : "Link Discord"}
              </Link>
              {discordLinked ? <DiscordUnlinkForm /> : null}
            </div>
          </section>

          <CollapsibleCard id="security" title={"Security"} description={"Change your password. You'll need your current one."}>
            <form className="acct-form" action="/api/account/password" method="post" autoComplete="off">
              <div className="acct-fields-row">
                <label>
                  Current password
                  <input name="currentAccountPassword" autoComplete="off" data-1p-ignore="true" data-lpignore="true" type="password" required />
                </label>
                <label>
                  New password
                  <input name="newAccountPassword" autoComplete="off" data-1p-ignore="true" data-lpignore="true" type="password" minLength={8} required />
                </label>
              </div>
              <p className="form-note">8+ characters with at least one number and one symbol.</p>
              <button className="acct-button" type="submit">Update password</button>
            </form>
          </CollapsibleCard>

          <details className="acct-card acct-danger" id="delete-account">
            <summary>
              <span>
                <span className="acct-danger-title">Delete account</span>
                <span className="acct-danger-sub">Permanently remove your website account</span>
              </span>
              <span className="acct-danger-chevron" aria-hidden="true">▾</span>
            </summary>
            <form className="acct-form" action="/api/account/delete" method="post" autoComplete="off">
              <p>
                This permanently deletes your website account and can&apos;t be undone. Type{" "}
                <strong>DELETE MY ACCOUNT</strong> and enter your password to confirm.
              </p>
              <div className="acct-fields-row">
                <label>
                  Confirmation
                  <input name="deleteConfirmation" autoComplete="off" placeholder="DELETE MY ACCOUNT" required />
                </label>
                <label>
                  Password
                  <input name="deletePassword" autoComplete="off" data-1p-ignore="true" data-lpignore="true" type="password" required />
                </label>
              </div>
              <button className="acct-button acct-button--danger" type="submit">Delete my account</button>
            </form>
          </details>
        </div>
      </div>
    </main>
  );
}
