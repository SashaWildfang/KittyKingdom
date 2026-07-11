import { getCurrentUser } from "../../lib/auth";
import { getDiscordInviteSummary } from "../../lib/discord";
import { OnlineStatus } from "../online-status";
import { ThemeToggle } from "../theme-toggle";
import { LeaderboardsClient } from "./leaderboards-client";

export const dynamic = "force-dynamic";

export default async function LeaderboardsPage() {
  const [discord, user] = await Promise.all([
    getDiscordInviteSummary(),
    getCurrentUser(),
  ]);

  return (
    <main className="site-shell leaderboard-shell">
      <nav className="topbar" aria-label="Main navigation">
        <a className="brand" href="/home" aria-label="Kitty Kingdom home">
          <img className="brand-logo-img" src="/logo.png" alt="Kitty Kingdom logo" />
          <span className="brand-copy">
            <strong>Kitty Kingdom</strong>
            <OnlineStatus initialOnline={discord.online} />
          </span>
        </a>
        <div className="tabs">
          <a href="/home">Home</a>
          <a href="/news">News</a>
          <a href="https://discord.com/invite/M9XKHFdYQV">Discord</a>
          <a href="/staff">Staff</a>
          <a href="/leaderboards">Leaderboards</a>
        </div>
        <div className="nav-actions">
          <ThemeToggle />
          {user ? (
            <a className="login-link logged-in-link" href="/account">
              My Account
            </a>
          ) : (
            <a className="login-link" href="/login">
              Login
            </a>
          )}
        </div>
      </nav>

      <section className="account-hero leaderboard-hero" aria-label="Leaderboards">
        <p className="eyebrow">Community stats</p>
        <h1>Leaderboards</h1>
        <p>
          Search, sort, and compare Kitty Kingdom member stats. Your row is highlighted when you are signed in.
        </p>
      </section>

      <LeaderboardsClient />
    </main>
  );
}
