import type { Metadata } from "next";
import { getCurrentUser } from "../../lib/auth";
import { getDiscordInviteSummary } from "../../lib/discord";
import { FallingLeaves } from "../fall-effects";
import { SiteNav } from "../site-nav";
import { AppealsClient } from "./appeals-client";

export const metadata: Metadata = {
  title: "Appeal a Punishment | Kitty Kingdom",
  description: "Banned, muted, kicked or warned in Kitty Kingdom? Find your account, confirm it's you with Discord and send an appeal to the admin team.",
};

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  unavailable: "Signing in with Discord isn't available right now. Please try again later, or contact staff.",
  cancelled: "Discord sign-in was cancelled. You need to confirm it's you before you can appeal.",
  signin: "We couldn't confirm your Discord sign-in. Please try again.",
};

export default async function AppealsPage(props: { searchParams: Promise<{ error?: string }> }) {
  const searchParams = await props.searchParams;
  const [user, discord] = await Promise.all([getCurrentUser().catch(() => null), getDiscordInviteSummary()]);
  return (
    <main className="site-shell kb-shell">
      <FallingLeaves foreground={false} />
      <SiteNav signedIn={Boolean(user)} discordOnline={discord.online} />
      <div className="kb-container apl">
        <section className="kb-hero">
          <p className="eyebrow">Moderation</p>
          <h1 className="apl-title">Appeal a Punishment</h1>
          <p>Think a ban, mute, kick or warning was a mistake, or want a second chance? Tell the admin team. Every appeal is read by an admin, and only admins can see it.</p>
        </section>
        <AppealsClient error={searchParams.error ? ERRORS[searchParams.error] ?? ERRORS.signin : null} />
      </div>
    </main>
  );
}
