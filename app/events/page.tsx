import type { Metadata } from "next";
import { getCurrentUser } from "../../lib/auth";
import { getDiscordInviteSummary } from "../../lib/discord";
import { listEvents } from "../../lib/events";
import { COMMUNITY_MANAGER_ROLE_ID, getPanelUser } from "../../lib/admin";
import { memberRoleIdsCached } from "../../lib/discord-member";
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
  // Admins and Community Managers get a shortcut to the events panel
  const panel = user ? await getPanelUser().catch(() => null) : null;
  const roles = panel && panel.level !== "admin" && user?.discordId ? await memberRoleIdsCached(String(user.discordId)).catch(() => null) : null;
  const canManage = panel?.level === "admin" || Boolean(roles?.includes(COMMUNITY_MANAGER_ROLE_ID));
  return (
    <main className="site-shell evp-shell">
      <SiteNav signedIn={Boolean(user)} discordOnline={discord.online} />
      <EventsBoard initial={data} signedIn={Boolean(user)} linked={Boolean(user?.discordId)} canManage={canManage} />
    </main>
  );
}
