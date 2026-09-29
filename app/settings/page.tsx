import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "../../lib/auth";
import { datingAccess } from "../../lib/dating/access";
import { getDiscordInviteSummary } from "../../lib/discord";
import { SiteNav } from "../site-nav";
import { SettingsPanel } from "./settings-panel";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Settings | Kitty Kingdom", robots: { index: false } };

/** All your settings in one place (the gear next to the bell). */
export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?account=login-required&next=%2Fsettings");
  const [access, discord] = await Promise.all([datingAccess(), getDiscordInviteSummary()]);
  return (
    <main className="site-shell set-page">
      <SiteNav signedIn discordOnline={discord.online} />
      <div className="set-wrap">
        <header className="set-head">
          <p className="eyebrow">Your account</p>
          <h1>Settings</h1>
          <p>Changes save automatically.</p>
        </header>
        <SettingsPanel social={access.ok} />
      </div>
    </main>
  );
}
