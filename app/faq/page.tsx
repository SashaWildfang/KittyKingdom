import { LifeBuoy, MessageCircle } from "lucide-react";
import type { Metadata } from "next";
import { getCurrentUser } from "../../lib/auth";
import { getDiscordInviteSummary } from "../../lib/discord";
import { FallingLeaves } from "../fall-effects";
import { SiteNav } from "../site-nav";
import { DISCORD_INVITE } from "./content";
import { FaqClient } from "./faq-client";

export const metadata: Metadata = {
  title: "FAQ & Guide | Kitty Kingdom",
  description: "Answers and guides for Kitty Kingdom: getting started, Leaves and the economy, levels, casino games, boosting and Patreon perks, dating and the website.",
};

export default async function FaqPage() {
  const [user, discord] = await Promise.all([getCurrentUser().catch(() => null), getDiscordInviteSummary()]);
  return (
    <main className="site-shell kb-shell">
      <FallingLeaves foreground={false} />
      <SiteNav signedIn={Boolean(user)} discordOnline={discord.online} />
      <div className="kb-container">
        <section className="kb-hero">
          <p className="eyebrow">Help center</p>
          <h1>FAQ &amp; Guide</h1>
          <p>Everything about Kitty Kingdom in one place: how the economy works, levels and perks, games, dating and the website.</p>
        </section>
        <FaqClient />
        <aside className="kb-cta">
          <div>
            <b>Still stuck?</b>
            <span>Staff are happy to help. Open a ticket in Discord or visit the Support page.</span>
          </div>
          <div className="kb-cta-actions">
            <a className="kb-btn kb-btn--primary" href="/support">
              <LifeBuoy size={16} aria-hidden="true" /> Support
            </a>
            <a className="kb-btn" href={DISCORD_INVITE}>
              <MessageCircle size={16} aria-hidden="true" /> Discord
            </a>
          </div>
        </aside>
      </div>
    </main>
  );
}
