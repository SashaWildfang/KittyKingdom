import { OnlineStatus } from "./online-status";
import { ThemeToggle } from "./theme-toggle";

type SiteNavProps = {
  signedIn: boolean;
  discordOnline: number | null;
};

/** The site-wide top ribbon: logo + online counts, page tabs, theme toggle and account buttons. */
export function SiteNav({ signedIn, discordOnline }: SiteNavProps) {
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
        <a href="/store">Store</a>
        {signedIn ? <a href="/leaderboards">Leaderboards</a> : null}
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
