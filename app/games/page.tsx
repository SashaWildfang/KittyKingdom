import { redirect } from "next/navigation";
import { getCurrentUser } from "../../lib/auth";
import { getDiscordInviteSummary } from "../../lib/discord";
import { economyNumber } from "../../lib/bot-settings/live";
import { blackjackState, MIN_BET } from "../../lib/games/blackjack";
import { scratchStatus, TICKETS } from "../../lib/games/scratch";
import { slotsStatus } from "../../lib/games/slots";
import { minesState } from "../../lib/games/mines";
import { wordleState } from "../../lib/games/wordle";
import { SiteNav } from "../site-nav";
import { GamesClient } from "./games-client";

export const dynamic = "force-dynamic";
export const maxDuration = 10;

export const metadata = { title: "Games | Bear Nation" };

/** The daily Wordle, plus blackjack, roulette, slots, mines, crash and scratch-offs with your leaves (signed-in members with Discord linked). */
export default async function GamesPage({ searchParams }: { searchParams: { game?: string; watch?: string } }) {
  const [user, discord] = await Promise.all([getCurrentUser(), getDiscordInviteSummary()]);
  if (!user) redirect("/login?account=login-required");
  if (!user.discordId) redirect("/account?account=link-required#discord-account");
  const discordId = String(user.discordId);

  const [bj, scratch, slots, mines, minBet, wordle] = await Promise.all([
    blackjackState(discordId).catch(() => null),
    scratchStatus(discordId).catch(() => null),
    slotsStatus(discordId).catch(() => null),
    minesState(discordId).catch(() => null),
    economyNumber("casino.blackjackMinBet", MIN_BET),
    wordleState(discordId).catch(() => null),
  ]);
  const games = ["wordle", "scratch", "slots", "roulette", "mines", "crash"] as const;
  const picked = games.find((g) => g === searchParams.game);

  return (
    <main className="site-shell games-shell">
      <SiteNav signedIn discordOnline={discord.online} />
      <GamesClient
        initialGame={searchParams.watch || searchParams.game === "live" ? "live" : picked ?? "blackjack"}
        initialWatch={typeof searchParams.watch === "string" && /^(bj|sc|sl|mn):\d{5,25}$/.test(searchParams.watch) ? searchParams.watch : null}
        initialBalance={bj?.balance ?? scratch?.balance ?? 0}
        initialTable={bj?.table ?? null}
        initialScratch={{ nitro: scratch?.nitro ?? false }}
        initialSlots={{ nitro: slots?.nitro ?? false, jackpot: slots?.jackpot ?? 0, maxSpins: slots?.maxSpins ?? 1 }}
        initialMines={mines?.game ?? null}
        initialWordle={wordle?.wordle ?? null}
        myId={discordId}
        tickets={TICKETS}
        minBet={minBet}
        loadError={!bj || !scratch}
      />
    </main>
  );
}
