import Link from "next/link";
import { getDiscordInviteSummary } from "../../lib/discord";

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
          aria-label="Kitty Kingdom home"
        >
          <img
            className="auth-logo-img"
            src="/logo.png"
            alt="Kitty Kingdom logo"
          />
        </Link>
        <p className="eyebrow">Discord</p>
        <h1>Join the Kitty Kingdom Discord</h1>
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
