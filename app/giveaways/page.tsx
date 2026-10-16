import type { Metadata } from "next";
import { getCurrentUser } from "../../lib/auth";
import { getDiscordInviteSummary } from "../../lib/discord";
import { publicGiveaways } from "../../lib/giveaways";
import { canManageGiveaways } from "../../lib/giveaway-access";
import { SiteNav } from "../site-nav";
import { GiveawayBoard } from "./giveaway-board";
import "./giveaways.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Giveaways | Bear Nation",
  description: "Win currency, XP, store items and more in Bear Nation giveaways. Enter right here or in the Discord.",
};

export default async function GiveawaysPage() {
  const [user, discord] = await Promise.all([getCurrentUser().catch(() => null), getDiscordInviteSummary()]);
  const data = await publicGiveaways(user?.discordId ? String(user.discordId) : null).catch(() => null);
  // Admins and Community Managers get a shortcut to Admin → Giveaways
  const canManage = user ? await canManageGiveaways().catch(() => false) : false;
  return (
    <main className="site-shell gwp-shell">
      <SiteNav signedIn={Boolean(user)} discordOnline={discord.online} />
      <GiveawayBoard initial={data} signedIn={Boolean(user)} linked={Boolean(user?.discordId)} canManage={canManage} />
    </main>
  );
}
