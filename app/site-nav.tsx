import { getPanelUser } from "../lib/admin";
import { canViewStaffPage, getCurrentUser } from "../lib/auth";
import { OnlineStatus } from "./online-status";
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
  // Same links for the phone menu
  const mobileLinks = [
    { href: "/home", label: "Home", icon: "home" as const },
    { href: "/news", label: "News", icon: "news" as const },
    { href: "https://discord.com/invite/M9XKHFdYQV", label: "Discord", icon: "discord" as const, external: true },
    { href: PATREON_URL, label: "Patreon", icon: "patreon" as const, external: true },
    ...(staffPage ? [{ href: "/staff", label: "Staff", icon: "staff" as const }] : []),
    ...(linked ? [{ href: "/store", label: "Leaf Shop", icon: "store" as const }, { href: "/leaderboards", label: "Leaderboards", icon: "leaderboards" as const }] : []),
    ...(panel ? [{ href: "/admin", label: panel.level === "admin" ? "Admin" : "Staff Panel", icon: "admin" as const }] : []),
  ];
  return (
    <nav className="topbar" aria-label="Main navigation">
      <a className="brand" href="/home" aria-label="Kitty Kingdom home">
        <img className="brand-logo-img" src="/logo.png" alt="Kitty Kingdom logo" />
        <span className="brand-copy">
          <strong>Kitty Kingdom</strong>
          <OnlineStatus initialOnline={discordOnline} />
        </span>
      </a>
      <div className="tabs">
        <a href="/home">Home</a>
        <a href="/news">News</a>
        <a href="https://discord.com/invite/M9XKHFdYQV">Discord</a>
        <a className="nav-patreon-tab" href={PATREON_URL} target="_blank" rel="noopener noreferrer">
          Patreon
        </a>
        {staffPage ? <a href="/staff">Staff</a> : null}
        {linked ? <a href="/store">Store</a> : null}
        {linked ? <a href="/leaderboards">Leaderboards</a> : null}
        {panel ? (
          <a className="nav-admin-tab" href="/admin">
            {panel.level === "admin" ? "Admin" : "Staff Panel"}
          </a>
        ) : null}
      </div>
      <div className="nav-actions">
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
      <MobileMenu links={mobileLinks} signedIn={signedIn} />
    </nav>
  );
}
