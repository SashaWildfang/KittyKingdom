import { redirect } from "next/navigation";
import { getCurrentUser } from "../../lib/auth";
import { getDiscordInviteSummary } from "../../lib/discord";
import { SiteNav } from "../site-nav";
import { LeaderboardsClient } from "./leaderboards-client";

export const dynamic = "force-dynamic";

export default async function LeaderboardsPage() {
  const [discord, user] = await Promise.all([
    getDiscordInviteSummary(),
    getCurrentUser(),
  ]);

  if (!user) redirect("/login?account=login-required");

  return (
    <main className="site-shell leaderboard-shell">
      <SiteNav signedIn={Boolean(user)} discordOnline={discord.online} />

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
