import { redirect } from "next/navigation";
import { getCurrentUser } from "../../lib/auth";
import { getDiscordInviteSummary } from "../../lib/discord";
import { SiteNav } from "../site-nav";
import { LeaderboardsClient } from "./leaderboards-client";
import { CurrencyName } from "../season-context";

export const dynamic = "force-dynamic";

export default async function LeaderboardsPage() {
  const [discord, user] = await Promise.all([
    getDiscordInviteSummary(),
    getCurrentUser(),
  ]);

  if (!user) redirect("/login?account=login-required");
  if (!user.discordId) redirect("/account?account=link-required#discord-account");

  return (
    <main className="site-shell leaderboard-shell">
      <SiteNav signedIn={Boolean(user)} discordOnline={discord.online} />

      <section className="account-hero leaderboard-hero" aria-label="Leaderboards">
        <p className="eyebrow">Community stats</p>
        <h1>Leaderboards</h1>
        <p>
          See who&apos;s on top in Kitty Kingdom. Rankings update live, so watch the <CurrencyName lower /> roll in.
        </p>
      </section>

      <LeaderboardsClient />
    </main>
  );
}
