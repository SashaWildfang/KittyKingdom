import type { CSSProperties } from "react";
import { getCurrentUser } from "../../lib/auth";
import { getDiscordInviteSummary } from "../../lib/discord";
import { getStaffDirectory, type StaffMember, type StaffStatus } from "../../lib/staff";
import { FallingLeaves } from "../fall-effects";
import { SiteNav } from "../site-nav";
import { LastOnline } from "./last-online";

export const dynamic = "force-dynamic";

const statusLabels: Record<StaffStatus, string> = {
  online: "Online",
  idle: "Away",
  dnd: "Do not disturb",
  offline: "Offline",
};

function timeAgo(date: Date) {
  const minutes = Math.max(0, Math.round((Date.now() - date.getTime()) / 60000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function memberSince(date: Date) {
  return new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric", timeZone: "UTC" }).format(date);
}

function StaffCard({ member }: { member: StaffMember }) {
  // The member's Discord role color tints the role badge and card accent
  const style = member.roleColor ? ({ "--role-color": member.roleColor } as CSSProperties) : undefined;
  return (
    <article className="staff-profile" style={style}>
      <div className="staff-avatar">
        <img
          src={member.avatarUrl}
          alt={`${member.name}'s Discord avatar`}
          width="96"
          height="96"
          loading="lazy"
          decoding="async"
        />
        {member.status ? (
          <span
            className={`staff-presence staff-presence--${member.status}`}
            title={statusLabels[member.status]}
            aria-label={statusLabels[member.status]}
          />
        ) : null}
      </div>
      <span className="staff-role-badge">{member.role}</span>
      <h3>{member.name}</h3>
      {member.username && member.username.toLowerCase() !== member.name.toLowerCase() ? (
        <p className="staff-handle">@{member.username}</p>
      ) : null}
      <LastOnline status={member.status} lastOnline={member.lastOnline} />
      <p className="staff-bio">{member.bio}</p>
      {member.memberSince ? <p className="staff-since">🍂 In the kingdom since {memberSince(member.memberSince)}</p> : null}
    </article>
  );
}

export default async function StaffPage() {
  const [discord, user, directory] = await Promise.all([
    getDiscordInviteSummary(),
    getCurrentUser(),
    getStaffDirectory(),
  ]);

  return (
    <main className="site-shell staff-shell">
      <FallingLeaves foreground={false} />

      <SiteNav signedIn={Boolean(user)} discordOnline={discord.online} />

      <section className="account-hero staff-hero" aria-label="Staff">
        <p className="eyebrow">Our Team</p>
        <h1>Meet the Staff</h1>
        <p>The people helping keep the kingdom safe, active, and welcoming. Say hi in the Discord any time!</p>
        <div className="staff-stats">
          <span className="staff-stat">
            <strong>{directory.total}</strong> staff members
          </span>
          {directory.online !== null ? (
            <span className="staff-stat">
              <i className="staff-stat-dot" aria-hidden="true" />
              <strong>{directory.online}</strong> online now
            </span>
          ) : null}
          {directory.updatedAt ? (
            <span className="staff-stat staff-stat--muted">Updated {timeAgo(directory.updatedAt)}</span>
          ) : null}
        </div>
      </section>

      <div className="staff-directory">
        {directory.groups.map((group) => (
          <section className="staff-section" key={group.title} aria-labelledby={`staff-${group.title}`}>
            <header className="staff-section-header">
              <span className="staff-section-icon" aria-hidden="true">
                {group.icon}
              </span>
              <div>
                <h2 id={`staff-${group.title}`}>
                  {group.title} <span className="staff-count">{group.members.length}</span>
                </h2>
                <p>{group.description}</p>
              </div>
            </header>
            <div className="staff-profile-grid">
              {group.members.map((member) => (
                <StaffCard member={member} key={member.id} />
              ))}
            </div>
          </section>
        ))}

        <section className="staff-join-card">
          <div>
            <p className="eyebrow">Join the team</p>
            <h2>Want to help run the kingdom?</h2>
            <p>
              Staff start as Helpers — answering questions and helping with verifications. Applications are open to
              verified 18+ members who have been in the server for at least 30 days.
            </p>
          </div>
          <a className="primary-pill" href="https://discord.com/invite/M9XKHFdYQV">
            Apply in Discord
          </a>
        </section>
      </div>
    </main>
  );
}
