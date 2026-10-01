import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "../../lib/auth";
import { getDiscordInviteSummary } from "../../lib/discord";
import { SiteNav } from "../site-nav";
import { NotificationsList } from "./notifications-list";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Notifications | Kitty Kingdom", robots: { index: false } };

/** Every notification from the last 60 days (the bell only shows the newest). */
export default async function NotificationsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?account=login-required&next=%2Fnotifications");
  const discord = await getDiscordInviteSummary();
  return (
    <main className="site-shell nf-page">
      <SiteNav signedIn discordOnline={discord.online} />
      <div className="nf-wrap">
        <header className="nf-head">
          <p className="eyebrow">Your account</p>
          <h1>Notifications</h1>
          <p>Everything from the last 60 days. Older ones are cleared automatically.</p>
        </header>
        {user.discordId ? (
          <NotificationsList />
        ) : (
          <p className="nf-empty">Link your Discord on My Account to get notifications.</p>
        )}
      </div>
    </main>
  );
}
