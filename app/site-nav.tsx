import { getPanelUser } from "../lib/admin";
import { getCurrentUser } from "../lib/auth";
import { OnlineStatus } from "./online-status";
import { ThemeToggle } from "./theme-toggle";

type SiteNavProps = {
  signedIn: boolean;
  discordOnline: number | null;
};

/** The site-wide top ribbon: logo + online counts, page tabs, theme toggle and account buttons. */
export async function SiteNav({ signedIn, discordOnline }: SiteNavProps) {
  // Staff Team see a Staff Panel tab, Admin / Owner see "Admin" (checked with Discord, cached for a minute)
  const panel = signedIn ? await getPanelUser().catch(() => null) : null;
  // The Store and Leaderboards need a linked Discord account
  const linked = signedIn ? Boolean((await getCurrentUser().catch(() => null))?.discordId) : false;
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
        <a href="/staff">Staff</a>
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
    </nav>
  );
}
