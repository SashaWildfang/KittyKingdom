import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "../../lib/auth";
import { datingAccess } from "../../lib/dating/access";
import { getDiscordInviteSummary } from "../../lib/discord";
import { getMemberRoleSummary } from "../../lib/discord-member";
import { accountName } from "../../lib/names";
import { twoFactorStatus } from "../../lib/two-factor-account";
import { SiteNav } from "../site-nav";
import { SettingsPanel } from "./settings-panel";
import "./settings.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Settings | Bear Nation", robots: { index: false } };

/** All your settings in one place (the gear next to the bell). */
export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?account=login-required&next=%2Fsettings");
  const discordId = user.discordId ? String(user.discordId) : null;
  const [access, discord, member] = await Promise.all([datingAccess(), getDiscordInviteSummary(), discordId ? getMemberRoleSummary(discordId).catch(() => null) : null]);
  const account = {
    name: accountName(user, member),
    email: String(user.email ?? ""),
    verified: user.emailVerified === true,
    discordLinked: Boolean(discordId),
    discordName: member?.username ? `@${member.username}` : null,
    twoFactor: twoFactorStatus(user).enabled,
    avatar: discordId ? `/api/discord/avatar/${discordId}` : null,
  };
  return (
    <main className="site-shell set-page">
      <SiteNav signedIn discordOnline={discord.online} />
      <div className="set-wrap set-v2">
        <SettingsPanel social={access.ok} account={account} />
      </div>
    </main>
  );
}
