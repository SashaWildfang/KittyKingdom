import type { Metadata } from "next";
import { getCurrentUser } from "../../lib/auth";
import { getDiscordInviteSummary } from "../../lib/discord";
import { listEvents } from "../../lib/events";
import { SiteNav } from "../site-nav";
import { EventsBoard } from "./events-board";
import "./events.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Events | Kitty Kingdom",
  description: "Game nights, movie nights, voice hangouts and contests in the Kitty Kingdom Discord. See what's coming up and get a reminder.",
};

export default async function EventsPage() {
  const [user, discord] = await Promise.all([getCurrentUser().catch(() => null), getDiscordInviteSummary()]);
  const data = await listEvents({ discordId: user?.discordId ? String(user.discordId) : null, includePast: true }).catch(() => null);
  return (
    <main className="site-shell evp-shell">
      <SiteNav signedIn={Boolean(user)} discordOnline={discord.online} />
      <EventsBoard initial={data} signedIn={Boolean(user)} linked={Boolean(user?.discordId)} />
    </main>
  );
}
