import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { achievementFeed } from "../../lib/achievements";
import { getCurrentUser } from "../../lib/auth";
import { getDiscordInviteSummary } from "../../lib/discord";
import { SiteNav } from "../site-nav";
import { AchievementWall } from "./achievement-wall";
import "./achievements.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Achievements | Kitty Kingdom" };

export default async function AchievementsPage() {
  const [discord, user] = await Promise.all([getDiscordInviteSummary(), getCurrentUser()]);
  // Members only, like the leaderboards
  if (!user) redirect("/login?account=login-required");
  if (!user.discordId) redirect("/account?account=link-required#discord-account");
  const feed = await achievementFeed().catch(() => null);
  return (
    <main className="site-shell aw-shell">
      <SiteNav signedIn discordOnline={discord.online} />
      <AchievementWall feed={feed} me={String(user.discordId)} />
    </main>
  );
}
