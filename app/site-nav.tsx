import { Settings, UserStar } from "lucide-react";
import { AccountMenu } from "./account-menu";
import { getPanelUser } from "../lib/admin";
import { getCurrentUser } from "../lib/auth";
import { OnlineStatus } from "./online-status";
import { NewsNavBadge } from "./news-nav-badge";
import { recentNewsStamps } from "../lib/news";
import { eventNavStamps } from "../lib/events";
import { EventsNavBadge } from "./events-nav-badge";
import { canSeeDating } from "../lib/dating/access";
import { NotificationBell } from "./notification-bell";
import { MobileMenu } from "./mobile-menu";
import { MessagesButton } from "./messages-nav-badge";
import { SiteLogo } from "./ui-icons";
import { SiteSocialIcon } from "./site-social-icon";


type SiteNavProps = {
  signedIn: boolean;
  discordOnline: number | null;
};

/** The site-wide top ribbon: logo + online counts, page tabs, theme toggle and account buttons. */
export async function SiteNav({ signedIn, discordOnline }: SiteNavProps) {
  // Staff Team see a Staff Panel tab, Admin / Owner see "Admin" (checked with Discord, cached for a minute)
  const panel = signedIn ? await getPanelUser().catch(() => null) : null;
  // The Store and Leaderboards need a linked Discord account
  const user = signedIn ? await getCurrentUser().catch(() => null) : null;
  const linked = Boolean(user?.discordId);
  // Dating is for 18+ Verified members (role checked with Discord, cached for two minutes)
  const dating = linked ? await canSeeDating(user?.discordId).catch(() => false) : false;
  // Recent posts, for the unread bubble on the News tab
  const newsStamps = await recentNewsStamps();
  // Upcoming events and open polls, for the bubble on the Events tab
  const eventStamps = await eventNavStamps();
  // Same links for the phone menu
  const mobileLinks = [
    { href: "/home", label: "Home", icon: "home" as const },
    { href: "/news", label: "News", icon: "news" as const },
    { href: "/events", label: "Events", icon: "events" as const },
    { href: "/giveaways", label: "Giveaways", icon: "giveaways" as const },
    { href: "/rules", label: "Rules", icon: "rules" as const },
    { href: "https://discord.com/invite/M9XKHFdYQV", label: "Discord", icon: "discord" as const, external: true },
    { href: "/patreon", label: "Patreon", icon: "patreon" as const },
    ...(dating ? [{ href: "/social", label: "Social", icon: "dating" as const }] : []),
    ...(linked ? [{ href: "/store", label: "Store", icon: "store" as const }, { href: "/games", label: "Games", icon: "games" as const }, { href: "/leaderboards", label: "Leaderboards", icon: "leaderboards" as const }] : []),
    ...(panel ? [{ href: "/admin", label: panel.level === "admin" ? "Admin" : "Staff Panel", icon: "admin" as const }] : []),
    ...(dating ? [{ href: "/social/profile", label: "My Social Profile", icon: "profile" as const }] : []),
    ...(signedIn ? [{ href: "/settings", label: "Settings", icon: "settings" as const }] : []),
  ];
  return (
    <nav className="topbar" aria-label="Main navigation">
      <a className="brand" href="/home" aria-label="Kitty Kingdom home">
        <SiteLogo className="brand-logo-img" alt="Kitty Kingdom logo" />
        <span className="brand-copy">
          <strong>Kitty Kingdom</strong>
          <OnlineStatus initialOnline={discordOnline} visitorsHref={panel?.level === "admin" ? "/admin?tab=accounts#online" : null} />
        </span>
      </a>
      {/* No Home tab: the logo goes home */}
      <div className="tabs">
        <a href="/news" className="nav-news-tab">
          News
          <NewsNavBadge items={newsStamps} />
        </a>
        <a href="/events" className="nav-news-tab">
          Events
          <EventsNavBadge ids={eventStamps.ids} live={eventStamps.live} />
        </a>
        <a href="/giveaways">Giveaways</a>
        {/* Signed-in members already know the rules and the server, so the bar stays short */}
        {signedIn ? null : <a href="/rules">Rules</a>}
        {signedIn ? null : (
          <a href="https://discord.com/invite/M9XKHFdYQV" target="_blank" rel="noopener noreferrer">
            Discord
          </a>
        )}
        {dating ? (
          <a href="/social" className="nav-dating-tab">
            Social
          </a>
        ) : null}
        {linked ? <a href="/store">Store</a> : null}
        {linked ? <a href="/games">Games</a> : null}
        {linked ? <a href="/leaderboards">Leaderboards</a> : null}
        <a className="nav-patreon-tab" href="/patreon" title="Patreon" aria-label="Patreon">
          <SiteSocialIcon name="patreon" size={15} />
        </a>
      </div>
      <div className="nav-actions">
        {panel ? (
          <a className="nav-panel-btn" href="/admin" title={panel.level === "admin" ? "Admin panel" : "Staff panel"} aria-label={panel.level === "admin" ? "Admin panel" : "Staff panel"}>
            <UserStar size={19} strokeWidth={2.1} aria-hidden="true" />
          </a>
        ) : null}
        {/* Messages (envelope), the bell, then Settings (gear) */}
        {dating ? <MessagesButton /> : null}
        {linked ? <NotificationBell /> : null}
        {signedIn ? (
          <a className="nav-gear" href="/settings" title="Settings" aria-label="Settings">
            <Settings size={19} strokeWidth={2.1} aria-hidden="true" />
          </a>
        ) : null}
        {/* Theme lives in the account menu, the footer and the phone menu */}
        {signedIn ? (
          <AccountMenu social={dating} />
        ) : (
          <>
            <a className="login-link" href="/login">
              Login
            </a>
            <a className="primary-pill" href="/register">
              Register
            </a>
          </>
        )}
      </div>
      <MobileMenu links={mobileLinks} signedIn={signedIn} newsStamps={newsStamps} eventStamps={eventStamps} bell={linked} messages={dating} />
    </nav>
  );
}
