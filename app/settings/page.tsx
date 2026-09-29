import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "../../lib/auth";
import { datingAccess } from "../../lib/dating/access";
import { getDiscordInviteSummary } from "../../lib/discord";
import { SiteNav } from "../site-nav";
import { SettingsPanel } from "./settings-panel";
import "../social/dating.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Settings | Kitty Kingdom", robots: { index: false } };

/** All your settings in one place (the gear next to the bell). */
export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?account=login-required&next=%2Fsettings");
  const [access, discord] = await Promise.all([datingAccess(), getDiscordInviteSummary()]);
  return (
    <main className="site-shell dt-shell set-page">
      <SiteNav signedIn discordOnline={discord.online} />
      <div className="dt">
        <header className="set-head">
          <p className="eyebrow">Your account</p>
          <h1>Settings</h1>
          <p>Appearance, notifications and privacy. Changes save automatically.</p>
        </header>
        <SettingsPanel social={access.ok} />
      </div>
    </main>
  );
}
