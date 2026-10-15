import type { Metadata } from "next";
import Link from "next/link";
import { getDiscordInviteSummary } from "../../lib/discord";
import { SiteLogo } from "../ui-icons";

export const metadata: Metadata = {
  title: "Join the Discord | Bear Nation",
  description: "Join Bear Nation, a cozy 18+ furry Discord server with events, games, Social profiles and a friendly community.",
};

export const dynamic = "force-dynamic";

export default async function DiscordPage() {
  const discord = await getDiscordInviteSummary();
  const online =
    discord.online === null
      ? "Members are online now"
      : `${discord.online.toLocaleString()} online now`;

  return (
    <main className="legal-page">
      <section className="legal-card wide-card">
        <Link
          className="auth-logo"
          href="/home"
          aria-label="Bear Nation home"
        >
          <SiteLogo
            className="auth-logo-img"
            alt="Bear Nation logo"
          />
        </Link>
        <p className="eyebrow">Discord</p>
        <h1>Join the Bear Nation Discord</h1>
        <p>
          <span className="online-status">
            <span aria-hidden="true" />
            {online}
          </span>
        </p>
        <p>
          Join our 18+ furry community for events, dating channels, role
          customization, server currency, media, voice chats, and a place to
          call home.
        </p>
        <a className="form-button" href="https://discord.com/invite/M9XKHFdYQV">
          Join the Discord
        </a>
      </section>
    </main>
  );
}
