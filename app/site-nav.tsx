import { Settings, UserStar } from "lucide-react";
import { AccountMenu } from "./account-menu";
import { getPanelUser } from "../lib/admin";
import { canViewStaffPage, getCurrentUser } from "../lib/auth";
import { OnlineStatus } from "./online-status";
import { NewsNavBadge } from "./news-nav-badge";
import { recentNewsStamps } from "../lib/news";
import { canSeeDating } from "../lib/dating/access";
import { NotificationBell } from "./notification-bell";
import { MobileMenu } from "./mobile-menu";
import { MessagesButton } from "./messages-nav-badge";

const PATREON_URL = "https://www.patreon.com/c/thekittykingdom/membership";

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
  // The Staff page needs a verified email and a linked Discord account too
  const staffPage = canViewStaffPage(user);
  // Dating is for 18+ Verified members (role checked with Discord, cached for two minutes)
  const dating = linked ? await canSeeDating(user?.discordId).catch(() => false) : false;
  // Recent posts, for the unread bubble on the News tab
  const newsStamps = await recentNewsStamps();
  // Same links for the phone menu
  const mobileLinks = [
    { href: "/home", label: "Home", icon: "home" as const },
    { href: "/news", label: "News", icon: "news" as const },
    { href: "https://discord.com/invite/M9XKHFdYQV", label: "Discord", icon: "discord" as const, external: true },
    { href: PATREON_URL, label: "Patreon", icon: "patreon" as const, external: true },
    ...(staffPage ? [{ href: "/staff", label: "Staff", icon: "staff" as const }] : []),
    ...(dating ? [{ href: "/social", label: "Social", icon: "dating" as const }] : []),
    ...(linked ? [{ href: "/store", label: "Store", icon: "store" as const }, { href: "/games", label: "Games", icon: "games" as const }, { href: "/leaderboards", label: "Leaderboards", icon: "leaderboards" as const }] : []),
    ...(panel ? [{ href: "/admin", label: panel.level === "admin" ? "Admin" : "Staff Panel", icon: "admin" as const }] : []),
    ...(signedIn ? [{ href: "/settings", label: "Settings", icon: "settings" as const }] : []),
  ];
  return (
    <nav className="topbar" aria-label="Main navigation">
      <a className="brand" href="/home" aria-label="Kitty Kingdom home">
        <img className="brand-logo-img" src="/logo.png" alt="Kitty Kingdom logo" />
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
        <a href="https://discord.com/invite/M9XKHFdYQV">Discord</a>
        <a className="nav-patreon-tab" href={PATREON_URL} target="_blank" rel="noopener noreferrer">
          Patreon
        </a>
        {staffPage ? <a href="/staff">Staff</a> : null}
        {dating ? (
          <a href="/social" className="nav-dating-tab">
            Social
          </a>
        ) : null}
        {linked ? <a href="/store">Store</a> : null}
        {linked ? <a href="/games">Games</a> : null}
        {linked ? <a href="/leaderboards">Leaderboards</a> : null}
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
      <MobileMenu links={mobileLinks} signedIn={signedIn} newsStamps={newsStamps} bell={linked} messages={dating} />
    </nav>
  );
}
