import { userTimeZone } from "../../lib/timezone";
import { accountGreeting } from "../../lib/greeting";
import { Backpack, ChevronDown, Crown, Gift, ShieldCheck, Check, CircleAlert, ClipboardList, FileText, Gavel, KeyRound, Lock, Mail, MessageCircle, Rocket, Sparkles, TriangleAlert, UserRound } from "lucide-react";
import { LeafEmote } from "../ui-icons";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { isStaffDiscordId } from "../../lib/admin";
import { getCurrentUser } from "../../lib/auth";
import { DiscordUnlinkForm } from "../discord-unlink-form";
import { getDiscordInviteSummary } from "../../lib/discord";
import { SiteNav } from "../site-nav";
import { VerifyEmailBanner } from "../verify-email-banner";
import { getMemberRoleSummary, guildId } from "../../lib/discord-member";
import { formatPhone } from "../../lib/contact";
import { formatDateOfBirth } from "../../lib/dates";
import { applicationBirthday, getJoinApplication } from "../../lib/join-application";
import { getRoleState } from "../../lib/member-roles";
import { CollapsibleCard } from "./collapsible-card";
import { LiveServerStatus } from "./live-server-status";
import { TwoFactorSettings } from "./two-factor-settings";
import { ChangePasswordForm } from "./change-password-form";
import { twoFactorStatus } from "../../lib/two-factor-account";
import { BoostsCard } from "./boosts-card";
import { DailyCard } from "./daily-card";
import { SupporterCard } from "./supporter-card";
import { getDailyStatus } from "../../lib/daily";
import { AccountInventory } from "./account-inventory";
import { DiscordLinkCode } from "./discord-link-code";
import { DailyReadyDot } from "./daily-ready";
import { memberTranscripts, ticketTypeLabel } from "../../lib/member-transcripts";
import { badgeHistory } from "../../lib/badge-history";
import { serverJoinDate } from "../../lib/member-directory";
import { myPunishments } from "../../lib/appeals";
import { profileExtras } from "../../lib/store-perks";
import { FlairBanner, FlairEffect, FlairName, Framed } from "../cosmetic-flair";

const shortDate = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/Denver" });
import { RoleManager } from "./role-manager";
import { AccountViews, StatsButton } from "./account-views";
import { ProfileBadges } from "./profile-badges";
import type { BadgeShowcase } from "../../lib/badges";
import { accountName } from "../../lib/names";

const statusMessages: Record<string, string> = {
  "contact-saved": "Phone number saved.",
  "invalid-phone": "That phone number doesn't look right. Include your country code, e.g. +44 for the UK or +1 for the US and Canada.",
  "fake-phone": "That phone number doesn't look real. Enter your actual number, or leave it blank.",
  "spam-name": "That display name looks like keyboard spam or isn't allowed. Try your real nickname.",
  "username-saved": "Username saved. Usernames can only be set once.",
  "username-taken": "That username is already taken.",
  "username-locked": "Your username is already set and cannot be changed.",
  "username-mismatch": "The username confirmation did not match.",
  "invalid-username":
    "Username must be 3–20 characters using letters, numbers, or underscores.",
  "name-saved": "Name saved successfully.",
  "invalid-name": "Name must be 3–18 characters and use letters, numbers, or spaces only.",
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
  "verify-required": "Only verified members can link. Finish the join application in the Discord (wait for staff to accept it), then try again.",
  "backup-used": "You signed in with a backup code. That code can't be used again. Check how many you have left below, and make new ones if you're running low.",
  "delete-staff-blocked": "Staff accounts can't be deleted. If you're leaving the team, ask an admin to remove your staff role first.",
  "staff-verify-required": "Verify your email to see the Staff page. Check your inbox for the link, or send a new one below.",
  "staff-link-required": "Link your Discord account to see the Staff page. Grab a code below and run /link in the server.",
  "link-required": "Link your Discord account to use the Store and Leaderboards. Grab a code below and run /link in the server.",
  "token-failed":
    "Discord rejected the login callback. Please try linking Discord again.",
  "user-failed":
    "Discord connected, but your profile could not be loaded. Please try again.",
  "guild-required": "Join the Kitty Kingdom Discord before linking your account.",
  unlinked: "Discord account unlinked. Discord-only features are disabled until you link again.",
};

const successStatuses = new Set(["password-reset", "username-saved", "name-saved", "password-saved", "success", "linked", "unlinked", "contact-saved"]);

/** 5400 → "1 hour 30 minutes" */
const lengthText = (seconds: number) => {
  const parts: string[] = [];
  let left = Math.round(seconds);
  for (const [name, size] of [["day", 86400], ["hour", 3600], ["minute", 60], ["second", 1]] as const) {
    const n = Math.floor(left / size);
    left -= n * size;
    if (n) parts.push(`${n} ${name}${n === 1 ? "" : "s"}`);
  }
  return parts.slice(0, 2).join(" ") || "a moment";
};
const PUNISHMENT_WORDS: Record<string, string> = { ban: "Ban", kick: "Kick", kick_unverified: "Kick", tempmute: "Mute", mute: "Mute", muzzle: "Muzzle", timeout: "Timeout", warn: "Warning" };

function formatMonthYear(date: Date) {
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: userTimeZone() }).format(date);
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
  const [application, roles, roleState, dailyStatus, serverId, staffAccount, transcripts, badgeDates, joinedServer, punishments, extras] = await Promise.all([
    getJoinApplication(user.discordId),
    getMemberRoleSummary(user.discordId),
    user.discordId ? getRoleState(String(user.discordId)).catch(() => null) : Promise.resolve(null),
    user.discordId ? getDailyStatus(String(user.discordId)).catch(() => null) : Promise.resolve(null),
    user.discordId ? guildId().catch(() => null) : Promise.resolve(null),
    isStaffDiscordId(user.discordId).catch(() => false),
    user.discordId ? memberTranscripts(String(user.discordId)).catch(() => null) : Promise.resolve(null),
    user.discordId ? badgeHistory(String(user.discordId)).catch(() => null) : Promise.resolve(null),
    serverJoinDate(user.discordId ? String(user.discordId) : null).catch(() => null),
    user.discordId ? myPunishments(String(user.discordId)).catch(() => null) : Promise.resolve(null),
    profileExtras(user.discordId ? String(user.discordId) : null).catch(() => null),
  ]);
  const tz = userTimeZone();
  const punDate = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: tz });
  const activeCount = punishments?.filter((p) => p.active).length ?? 0;
  const phone = typeof user.phone === "string" ? user.phone : null;
  // Birthday and age come from the Discord join application
  const birthday = applicationBirthday(application, { dateOfBirth: user.dateOfBirth, age: user.age });
  const age = birthday.age;
  const dob = birthday.birthDate ? formatDateOfBirth(birthday.birthDate) : "Not available";
  const displayName = typeof user.displayName === "string" ? user.displayName : null;
  // No display name set: their Discord nickname, then Discord username
  const shownName = accountName(user, roles);
  // Greets them by their own time of day (their time zone)
  const greeting = accountGreeting(shownName, userTimeZone());
  // Sections they folded (saved in a cookie so the page is drawn that way from the start)
  const collapsed = new Set((cookies().get("kk_collapsed")?.value ?? "").split(",").map((v) => decodeURIComponent(v)).filter(Boolean));
  const heading = displayName || user.discordId ? greeting.title : "My Account";
  const discordLinked = Boolean(user.discordId);
  const twoFactor = twoFactorStatus(user);
  const discordName = discordLinked ? String(user.discord?.username ?? roles.username ?? user.discordId) : null;
  // "Member since" is when they joined the Discord server (not when they signed up or applied)
  const memberSince = joinedServer ? formatMonthYear(joinedServer) : null;
  const statusText = status ? statusMessages[status] ?? `Status: ${status}` : null;
  // Today's daily reward is waiting (shown even while the card is folded)
  // (same rule as the Daily Reward card: not claimed yet, or the next claim has opened)
  const dailyReady = Boolean(dailyStatus && (!dailyStatus.claimedToday || Date.parse(dailyStatus.nextClaimAt) <= Date.now()));
  const statusTone = status && successStatuses.has(status) ? "success" : "error";

  return (
    <main className="site-shell account-site-shell">
      <div className="leaf-field" aria-hidden="true" />
      <SiteNav signedIn discordOnline={discord.online} />

      <section className="account-hero acct-hero" aria-label="My Account">
        <p className="eyebrow">{displayName || user.discordId ? `${greeting.eyebrow} · Member portal` : "Member portal"}</p>
        <h1>{heading}</h1>
        <p>{displayName || user.discordId ? greeting.line : "Manage your Kitty Kingdom profile, Discord link, and account security, all in one place."}</p>
      </section>

      {user.emailVerified === false ? (
        <div className="acct-banner-wrap">
          <VerifyEmailBanner email={user.email} />
        </div>
      ) : null}

      {statusText ? (
        <div className={`acct-status acct-status--${statusTone}`} role="status">
          <span aria-hidden="true">{statusTone === "success" ? <Check size={16} /> : <CircleAlert size={16} />}</span>
          {statusText}
        </div>
      ) : null}

      {user.mustChangePassword ? (
        <div className="acct-temp-password" role="alert">
          <strong className="acct-inline-icon"><KeyRound size={16} aria-hidden="true" /> You&apos;re using a temporary password from staff.</strong>
          <span>Please choose your own password now.</span>
          <a href="#security">Change password →</a>
        </div>
      ) : null}

      <div className="acct-layout">
        {/* ---------- Sidebar: profile summary + section links ---------- */}
        <aside className="acct-sidebar">
          <div className={`acct-profile-card${extras?.flair.banner ? " has-cos-banner" : ""}`}>
            <FlairBanner banner={extras?.flair.banner}>
              <FlairEffect effect={extras?.flair.effect} count={10} />
            </FlairBanner>
            <Framed frame={extras?.flair.frame} className="acct-avatar-frame">
              <div className="acct-avatar">
                {discordLinked ? (
                  <img src={`/api/discord/avatar/${user.discordId}`} alt="" width="88" height="88" />
                ) : (
                  <span aria-hidden="true">{shownName.charAt(0).toUpperCase()}</span>
                )}
              </div>
            </Framed>
            <h2>
              <FlairName nameplate={extras?.flair.nameplate} text={shownName}>
                {shownName}
              </FlairName>
            </h2>
            {user.username ? <p className="acct-handle">@{user.username}</p> : null}
            {discordLinked ? (
              <ProfileBadges
                initial={(user.badgeShowcase as BadgeShowcase | undefined) ?? null}
                earned={badgeDates?.earned}
                customTitle={extras?.customTitle}
                customBadges={extras?.customBadges}
              />
            ) : null}
            <LiveServerStatus initial={roleState} discordLinked={discordLinked} fallbackStaff={roles.isStaff} />
            {memberSince ? <p className="acct-since"><LeafEmote size={16} /> Member since {memberSince}</p> : null}
            {discordLinked ? <StatsButton /> : null}
          </div>

          <nav className="acct-nav" aria-label="Account sections">
            {discordLinked ? <a href="#daily"><Gift size={16} aria-hidden="true" /> Daily Reward<DailyReadyDot ready={dailyReady} /></a> : null}
            {discordLinked ? <a href="#supporter"><Crown size={16} aria-hidden="true" /> Supporter perks</a> : null}
            <a href="#discord-account"><MessageCircle size={16} aria-hidden="true" /> Discord</a>
            <a href="#overview"><ClipboardList size={16} aria-hidden="true" /> Overview</a>
            {discordLinked ? <a href="#roles"><Sparkles size={16} aria-hidden="true" /> Server roles</a> : null}
            {discordLinked ? <a href="#inventory"><Backpack size={16} aria-hidden="true" /> Inventory</a> : null}
            {discordLinked ? <a href="#boosts"><Rocket size={16} aria-hidden="true" /> Boosters & odds</a> : null}
            {discordLinked ? <a href="#transcripts"><FileText size={16} aria-hidden="true" /> Transcripts</a> : null}
            {discordLinked ? <a href="#punishments"><Gavel size={16} aria-hidden="true" /> Punishments{activeCount ? <span className="acct-nav-dot" title={`${activeCount} active`} /> : null}</a> : null}
            <a href="#profile"><UserRound size={16} aria-hidden="true" /> Profile</a>
            <a href="#security"><Lock size={16} aria-hidden="true" /> Security{twoFactor.enabled ? null : <span className="acct-nav-dot" title="Two-factor is off" />}</a>
            <a className="acct-nav-danger" href="#delete-account"><TriangleAlert size={16} aria-hidden="true" /> Delete account</a>
          </nav>
        </aside>

        {/* ---------- Main column (swaps to the stats page on #stats) ---------- */}
        <AccountViews>
          {discordLinked ? (
            <CollapsibleCard id="daily" defaultOpen={!collapsed.has("daily")} title="Daily Reward" description="Claim free leaves once a day. Claim every day to build your streak." summary={dailyReady ? "🎁 Ready to claim!" : undefined}>
              <DailyCard initial={dailyStatus} guildId={serverId} />
            </CollapsibleCard>
          ) : null}

          {discordLinked ? (
            <CollapsibleCard id="supporter" defaultOpen={!collapsed.has("supporter")} title="Supporter perks" description="Your Patreon and Nitro perks, and your custom role if you have one.">
              <SupporterCard displayName={(displayName || discordName || "You").slice(0, 32)} />
            </CollapsibleCard>
          ) : null}

          <section className="acct-card acct-discord" id="discord-account">
            <span className="acct-discord-icon">
              <DiscordIcon />
            </span>
            <div className="acct-discord-copy">
              <h2>Discord</h2>
              <p>
                {discordLinked ? (
                  <>
                    Linked as <strong>{discordName}</strong>. Your roles, level and store stay in sync automatically.
                  </>
                ) : (
                  "Link Discord to unlock the Store, Leaderboards and your server roles. Just grab a code and use /link in the server."
                )}
              </p>
            </div>
            {discordLinked ? (
              <div className="acct-discord-actions">
                <DiscordUnlinkForm />
              </div>
            ) : user.emailVerified !== true ? (
              <p className="acct-discord-needs-email">
                <Mail size={16} aria-hidden="true" /> Confirm your email address first (see the banner above), then you can link Discord.
              </p>
            ) : (
              <DiscordLinkCode />
            )}
          </section>

          <CollapsibleCard id="overview" defaultOpen={!collapsed.has("overview")} title={"Overview"} description={"Your account details. Age and birthday come from your Discord join application."}>
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
              defaultOpen={!collapsed.has("roles")}
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

          {discordLinked ? (
            <CollapsibleCard id="inventory" defaultOpen={!collapsed.has("inventory")} title="Inventory" description="Everything you've bought or been gifted. Equip roles, use boosters and send gifts right here.">
              <AccountInventory />
            </CollapsibleCard>
          ) : null}

          {discordLinked ? (
            <CollapsibleCard id="boosts" defaultOpen={!collapsed.has("boosts")} title="Boosters & odds" description="Boosters running right now, what you earn at, and your chances of being featured on Social.">
              <BoostsCard />
            </CollapsibleCard>
          ) : null}

          {discordLinked ? (
            <CollapsibleCard
              id="transcripts"
              defaultOpen={!collapsed.has("transcripts")}
              title="Transcripts"
              description="Your closed tickets. Images, videos and files are removed from your copy for privacy."
              summary={transcripts ? `${transcripts.length} ticket${transcripts.length === 1 ? "" : "s"}` : undefined}
            >
              {transcripts === null ? (
                <p className="acct-muted">Your transcripts couldn&apos;t be loaded right now. Please try again in a moment.</p>
              ) : transcripts.length === 0 ? (
                <p className="acct-muted">No transcripts yet. When a ticket you opened is closed, it shows up here.</p>
              ) : (
                <ul className="acct-transcripts">
                  {transcripts.map((t) => (
                    <li key={t.ticketId}>
                      <a href={`/account/transcripts/${t.ticketId}`}>
                        <span className="acct-transcript-icon" aria-hidden="true">
                          <FileText size={17} />
                        </span>
                        <span className="acct-transcript-main">
                          <strong>
                            Ticket #{t.ticketId} · {ticketTypeLabel(t.type)}
                          </strong>
                          <small>
                            {t.created ? `Opened ${shortDate.format(new Date(t.created))}` : "Opened —"}
                            {t.resolvedAt ? ` · Closed ${shortDate.format(new Date(t.resolvedAt))}` : ""}
                          </small>
                        </span>
                        <span className="acct-transcript-open">View →</span>
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </CollapsibleCard>
          ) : null}

          {discordLinked ? (
            <CollapsibleCard
              id="punishments"
              defaultOpen={!collapsed.has("punishments")}
              title="Punishments"
              description="Warnings, mutes, kicks and bans on your Discord account. Think one was a mistake? Appeal it."
              summary={punishments ? (activeCount ? `${activeCount} active` : punishments.length ? `${punishments.length} on record` : "Clean record") : undefined}
            >
              {punishments === null ? (
                <p className="acct-muted">Your record couldn&apos;t be loaded right now. Please try again in a moment.</p>
              ) : punishments.length === 0 ? (
                <p className="acct-clean-record"><ShieldCheck size={18} aria-hidden="true" /> <span>Nothing on your record. Keep it up!</span></p>
              ) : (
                <ul className="acct-puns">
                  {punishments.map((p) => {
                    const again = p.appeal?.status === "denied" && p.appeal.canAppealAgainAt && Date.parse(p.appeal.canAppealAgainAt) < Date.now();
                    const canAppeal = p.appealable && (!p.appeal || again);
                    const ends = p.expiresAt ? Date.parse(p.expiresAt) : null;
                    const kind = p.action === "kick_unverified" ? "kick" : p.action;
                    return (
                      <li key={p.id} className={p.active ? "is-active" : undefined}>
                        <span className={`acct-pun-action apl-action apl-action--${kind}`}>{PUNISHMENT_WORDS[p.action] ?? p.action}</span>
                        <span className="acct-pun-main">
                          <strong>{p.reason}</strong>
                          <small>
                            {p.at ? punDate.format(new Date(p.at)) : "Date unknown"}
                            {p.action === "ban" ? (p.active ? " · Active (permanent until lifted)" : " · Lifted") : null}
                            {p.durationSeconds ? ` · ${lengthText(p.durationSeconds)}` : null}
                            {ends ? (ends > Date.now() ? ` · Ends ${punDate.format(new Date(ends))}` : ` · Ended ${punDate.format(new Date(ends))}`) : null}
                          </small>
                        </span>
                        <span className="acct-pun-end">
                          {p.active ? <span className="acct-pun-live">Active</span> : null}
                          {canAppeal ? (
                            <a className="acct-pun-appeal" href={`/appeals?p=${p.id}`}>Appeal</a>
                          ) : p.appeal ? (
                            <a className={`apl-chip apl-chip--${p.appeal.status}`} href="/appeals">
                              {p.appeal.status === "pending" ? "Appeal under review" : p.appeal.status === "accepted" ? "Appeal accepted" : "Appeal denied"}
                            </a>
                          ) : !p.appealable ? (
                            <span className="apl-chip apl-chip--locked">Not appealable</span>
                          ) : null}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CollapsibleCard>
          ) : null}

          <CollapsibleCard id="profile" defaultOpen={!collapsed.has("profile")} title={"Profile"} description={"How you appear around the site."}>
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
                    maxLength={18}
                    pattern="[A-Za-z0-9 ]{3,18}"
                    required
                  />
                </label>
                <p className="form-note">3–18 characters. Letters, numbers, and spaces only.</p>
                <button className="acct-button" type="submit">Save name</button>
              </form>

              <form className="acct-form" action="/api/account/username" method="post" autoComplete="off">
                {user.username ? (
                  <>
                    <label>
                      Username
                      <span className="acct-locked-field">
                        <input value={user.username} readOnly aria-readonly="true" />
                        <Lock size={15} aria-hidden="true" />
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
                <p className="form-note acct-inline-icon"><Lock size={13} aria-hidden="true" /> Optional and private: only you can see it. Include your country code if you&apos;re outside the US/Canada.</p>
                <button className="acct-button" type="submit">Save phone number</button>
              </form>
            </div>
          </CollapsibleCard>




          <CollapsibleCard id="security" defaultOpen={!collapsed.has("security")} title={"Security"} description={"Your password and two-factor authentication."} summary={twoFactor.enabled ? "Two-factor on" : "Two-factor off"}>
            <h3 className="acct-subhead">Password</h3>
            <ChangePasswordForm />
            <div className="acct-divider" />
            <TwoFactorSettings initial={twoFactor} />
          </CollapsibleCard>

          <details className="acct-card acct-danger" id="delete-account">
            <summary>
              <span>
                <span className="acct-danger-title">Delete account</span>
                <span className="acct-danger-sub">Permanently remove your website account</span>
              </span>
              <span className="acct-collapse-chevron acct-danger-chevron" aria-hidden="true">
                <ChevronDown size={20} strokeWidth={2.5} />
              </span>
            </summary>
            {staffAccount ? (
              <p className="acct-protected">
                <ShieldCheck size={16} aria-hidden="true" /> Staff accounts can&apos;t be deleted. If you&apos;re leaving the team, ask an admin to remove your staff role
                first.
              </p>
            ) : (
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
            )}
          </details>
        </AccountViews>
      </div>
    </main>
  );
}
