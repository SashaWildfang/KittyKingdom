import type { Metadata } from "next";
import { getCurrentUser } from "../../lib/auth";
import { getDiscordInviteSummary } from "../../lib/discord";
import { publicGiveaways } from "../../lib/giveaways";
import { SiteNav } from "../site-nav";
import { GiveawayBoard } from "./giveaway-board";
import "./giveaways.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Giveaways | Kitty Kingdom",
  description: "Win currency, store items and more in Kitty Kingdom giveaways. Enter right here or in the Discord.",
};

export default async function GiveawaysPage() {
  const [user, discord] = await Promise.all([getCurrentUser().catch(() => null), getDiscordInviteSummary()]);
  const data = await publicGiveaways(user?.discordId ? String(user.discordId) : null).catch(() => null);
  return (
    <main className="site-shell gwp-shell">
      <SiteNav signedIn={Boolean(user)} discordOnline={discord.online} />
      <GiveawayBoard initial={data} signedIn={Boolean(user)} linked={Boolean(user?.discordId)} />
    </main>
  );
}
