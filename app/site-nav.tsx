import { Gauge } from "lucide-react";
import { getPanelUser } from "../lib/admin";
import { canViewStaffPage, getCurrentUser } from "../lib/auth";
import { OnlineStatus } from "./online-status";
import { NewsNavBadge } from "./news-nav-badge";
import { recentNewsStamps } from "../lib/news";
import { MobileMenu } from "./mobile-menu";
import { ThemeToggle } from "./theme-toggle";

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
  // Recent posts, for the unread bubble on the News tab
  const newsStamps = await recentNewsStamps();
  // Same links for the phone menu
  const mobileLinks = [
    { href: "/home", label: "Home", icon: "home" as const },
    { href: "/news", label: "News", icon: "news" as const },
    { href: "https://discord.com/invite/M9XKHFdYQV", label: "Discord", icon: "discord" as const, external: true },
    { href: PATREON_URL, label: "Patreon", icon: "patreon" as const, external: true },
    ...(staffPage ? [{ href: "/staff", label: "Staff", icon: "staff" as const }] : []),
    ...(linked ? [{ href: "/store", label: "Store", icon: "store" as const }, { href: "/leaderboards", label: "Leaderboards", icon: "leaderboards" as const }] : []),
    ...(panel ? [{ href: "/admin", label: panel.level === "admin" ? "Admin" : "Staff Panel", icon: "admin" as const }] : []),
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
      <div className="tabs">
        <a href="/home">Home</a>
        <a href="/news" className="nav-news-tab">
          News
          <NewsNavBadge items={newsStamps} />
        </a>
        <a href="https://discord.com/invite/M9XKHFdYQV">Discord</a>
        <a className="nav-patreon-tab" href={PATREON_URL} target="_blank" rel="noopener noreferrer">
          Patreon
        </a>
        {staffPage ? <a href="/staff">Staff</a> : null}
        {linked ? <a href="/store">Store</a> : null}
        {linked ? <a href="/leaderboards">Leaderboards</a> : null}
      </div>
      <div className="nav-actions">
        {panel ? (
          <a className="nav-panel-btn" href="/admin" title={panel.level === "admin" ? "Admin panel" : "Staff panel"} aria-label={panel.level === "admin" ? "Admin panel" : "Staff panel"}>
            <Gauge size={20} strokeWidth={2.1} aria-hidden="true" />
          </a>
        ) : null}
        <ThemeToggle />
        {signedIn ? (
          <a className="login-link logged-in-link" href="/account">
            My Account
          </a>
        ) : (
          <a className="login-link" href="/login">
            Login
          </a>
        )}
        {signedIn ? (
          <form action="/api/account/logout" method="post">
            <button className="primary-pill logout-pill" type="submit">
              Logout
            </button>
          </form>
        ) : (
          <a className="primary-pill" href="/register">
            Register
          </a>
        )}
      </div>
      <MobileMenu links={mobileLinks} signedIn={signedIn} newsStamps={newsStamps} />
    </nav>
  );
}
