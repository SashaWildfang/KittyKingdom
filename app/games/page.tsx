import { redirect } from "next/navigation";
import { getCurrentUser } from "../../lib/auth";
import { getDiscordInviteSummary } from "../../lib/discord";
import { blackjackState, MIN_BET } from "../../lib/games/blackjack";
import { scratchStatus, TICKETS } from "../../lib/games/scratch";
import { SiteNav } from "../site-nav";
import { GamesClient } from "./games-client";

export const dynamic = "force-dynamic";
export const maxDuration = 10;

export const metadata = { title: "Games | Kitty Kingdom" };

/** Blackjack and scratch-offs with your leaves (signed-in members with Discord linked). */
export default async function GamesPage({ searchParams }: { searchParams: { game?: string } }) {
  const [user, discord] = await Promise.all([getCurrentUser(), getDiscordInviteSummary()]);
  if (!user) redirect("/login?account=login-required");
  if (!user.discordId) redirect("/account?account=link-required#discord-account");
  const discordId = String(user.discordId);

  const [bj, scratch] = await Promise.all([blackjackState(discordId).catch(() => null), scratchStatus(discordId).catch(() => null)]);

  return (
    <main className="site-shell games-shell">
      <SiteNav signedIn discordOnline={discord.online} />
      <GamesClient
        initialGame={searchParams.game === "scratch" ? "scratch" : "blackjack"}
        initialBalance={bj?.balance ?? scratch?.balance ?? 0}
        initialTable={bj?.table ?? null}
        initialScratch={scratch ? { used: scratch.used, limit: scratch.limit, nitro: scratch.nitro } : { used: 0, limit: 5, nitro: false }}
        tickets={TICKETS}
        minBet={MIN_BET}
        loadError={!bj || !scratch}
      />
    </main>
  );
}
