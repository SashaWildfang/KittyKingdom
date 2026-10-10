import { userTimeZone } from "../../lib/timezone";
import { BadgeCheck, Crown, LifeBuoy, Scale, ScrollText, Shield, Sparkles, Ticket } from "lucide-react";
import "./staff.css";
import { LeafEmote } from "../ui-icons";
import type { CSSProperties, ReactNode } from "react";
import type { StaffDirectory, StaffMember, StaffStatus } from "../../lib/staff";
import { LastOnline } from "./last-online";

// The staff page layout (app/staff/page.tsx loads the data and checks who can see it)


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
  return new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric", timeZone: userTimeZone() }).format(date);
}

function StaffGroupIcon({ name }: { name: string }) {
  if (name === "leaf") return <LeafEmote size={24} />;
  const Icon = { crown: Crown, shield: Shield, sparkles: Sparkles }[name] ?? Sparkles;
  return <Icon size={22} />;
}

function StaffCard({ member }: { member: StaffMember }) {
  // The member's Discord role color tints the card
  const style = member.roleColor ? ({ "--role-color": member.roleColor } as CSSProperties) : undefined;
  return (
    <article className={`sf-card${member.status && member.status !== "offline" ? " is-online" : ""}`} style={style}>
      <div className="sf-card-top">
        <div className="sf-avatar">
          <img src={member.avatarUrl} alt={`${member.name}'s Discord avatar`} width="88" height="88" loading="lazy" decoding="async" />
          {member.status ? <span className={`sf-presence is-${member.status}`} title={statusLabels[member.status]} aria-label={statusLabels[member.status]} /> : null}
        </div>
        <div className="sf-card-id">
          <span className="sf-role">{member.role}</span>
          <h3>{member.name}</h3>
          {member.username && member.username.toLowerCase() !== member.name.toLowerCase() ? <p className="sf-handle">@{member.username}</p> : null}
        </div>
      </div>
      <p className="sf-bio">{member.bio}</p>
      <div className="sf-card-foot">
        <LastOnline status={member.status} lastOnline={member.lastOnline} />
        {member.memberSince ? (
          <span className="sf-since">
            <LeafEmote size={14} /> Since {memberSince(member.memberSince)}
          </span>
        ) : null}
      </div>
    </article>
  );
}

export function StaffView({ directory, nav }: { directory: StaffDirectory; nav: ReactNode }) {
  const everyone = directory.groups.flatMap((g) => g.members);
  const online = everyone.filter((m) => m.status && m.status !== "offline");
  const ranks = Array.from(new Map(everyone.map((m) => [m.role, { role: m.role, color: m.roleColor, rank: m.rank, count: everyone.filter((x) => x.role === m.role).length }])).values()).sort((a, b) => b.rank - a.rank);

  return (
    <main className="site-shell sf-shell">
      {nav}

      <div className="sf">
        <section className="sf-hero" aria-label="Staff">
          <div>
            <p className="sf-eyebrow">
              <Shield size={14} aria-hidden="true" /> Our team
            </p>
            <h1>Meet the staff</h1>
            <p className="sf-lead">The people keeping the kingdom safe, active and welcoming. Say hi any time, we don&apos;t bite (much).</p>
            <div className="sf-stats">
              <span>
                <b>{directory.total}</b> staff
              </span>
              {directory.online !== null ? (
                <span>
                  <i aria-hidden="true" /> <b>{directory.online}</b> online now
                </span>
              ) : null}
              {directory.updatedAt ? <span className="is-muted">Updated {timeAgo(directory.updatedAt)}</span> : null}
            </div>
          </div>
          <div className="sf-help">
            <b>Need a hand?</b>
            <a href="/support">
              <LifeBuoy size={15} aria-hidden="true" /> Support &amp; tickets
            </a>
            <a href="/appeals">
              <Scale size={15} aria-hidden="true" /> Appeal a punishment
            </a>
            <a href="/rules">
              <ScrollText size={15} aria-hidden="true" /> Server rules
            </a>
          </div>
        </section>

        {online.length ? (
          <section className="sf-online" aria-label="Online now">
            <span className="sf-online-label">Online now</span>
            <ul>
              {online.map((m) => (
                <li key={m.id} style={m.roleColor ? ({ "--role-color": m.roleColor } as CSSProperties) : undefined} title={`${m.name} · ${m.role}`}>
                  <img src={m.avatarUrl} alt="" width="40" height="40" loading="lazy" />
                  <span className={`sf-presence is-${m.status}`} aria-hidden="true" />
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="sf-ranks" aria-label="Staff ranks">
          {ranks.map((r, i) => (
            <span key={r.role} style={r.color ? ({ "--role-color": r.color, "--i": i } as CSSProperties) : ({ "--i": i } as CSSProperties)}>
              <i aria-hidden="true" />
              {r.role}
              <small>{r.count}</small>
            </span>
          ))}
        </section>

        {directory.groups.map((group) => (
          <section className="sf-group" key={group.title} aria-labelledby={`staff-${group.title}`}>
            <header>
              <span className="sf-group-icon" aria-hidden="true">
                <StaffGroupIcon name={group.icon} />
              </span>
              <div>
                <h2 id={`staff-${group.title}`}>
                  {group.title} <small>{group.members.length}</small>
                </h2>
                <p>{group.description}</p>
              </div>
            </header>
            <div className="sf-grid">
              {group.members.map((member) => (
                <StaffCard member={member} key={member.id} />
              ))}
            </div>
          </section>
        ))}

        <section className="sf-how" aria-label="How staff help">
          <div>
            <Ticket size={20} aria-hidden="true" />
            <b>Tickets</b>
            <p>Open a ticket in Discord for anything private: reports, questions, payouts or problems.</p>
          </div>
          <div>
            <BadgeCheck size={20} aria-hidden="true" />
            <b>Verification</b>
            <p>Helpers check join forms and 18+ verifications, usually within a few hours.</p>
          </div>
          <div>
            <Scale size={20} aria-hidden="true" />
            <b>Fair moderation</b>
            <p>Every punishment is logged and can be appealed on the website.</p>
          </div>
        </section>

        <section className="sf-join">
          <div>
            <p className="sf-eyebrow">Join the team</p>
            <h2>Want to help run the kingdom?</h2>
            <p>Staff start as Helpers, answering questions and helping with verifications. Applications are open to verified 18+ members who have been in the server for at least 30 days.</p>
          </div>
          <a className="sf-join-btn" href="https://discord.com/invite/M9XKHFdYQV">
            Apply in Discord
          </a>
        </section>
      </div>
    </main>
  );
}
