import { FileText, Shield } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { getCurrentUser } from "../../lib/auth";
import { getDiscordInviteSummary } from "../../lib/discord";
import { FallingLeaves } from "../fall-effects";
import { SiteNav } from "../site-nav";

export type LegalSection = { id: string; title: string; body: ReactNode };

/**
 * The Legal center: Privacy Policy and Terms of Service as one part of the site, with the
 * normal navigation, a tab to switch between them and a table of contents.
 */
export async function LegalShell({
  current,
  title,
  updated,
  intro,
  summary,
  sections,
}: {
  current: "privacy" | "terms";
  title: string;
  updated: string;
  intro: ReactNode;
  summary?: ReactNode;
  sections: LegalSection[];
}) {
  const [user, discord] = await Promise.all([getCurrentUser().catch(() => null), getDiscordInviteSummary()]);
  return (
    <main className="site-shell legal-shell">
      <FallingLeaves foreground={false} />
      <SiteNav signedIn={Boolean(user)} discordOnline={discord.online} />

      <section className="account-hero legal-hero" aria-label={title}>
        <p className="eyebrow">Legal</p>
        <h1>{title}</h1>
        <p>
          Last updated <strong>{updated}</strong>
        </p>
        <nav className="legal-tabs" aria-label="Legal documents">
          <Link href="/privacy" className={current === "privacy" ? "is-on" : undefined} aria-current={current === "privacy" ? "page" : undefined}>
            <Shield size={16} aria-hidden="true" /> Privacy Policy
          </Link>
          <Link href="/terms" className={current === "terms" ? "is-on" : undefined} aria-current={current === "terms" ? "page" : undefined}>
            <FileText size={16} aria-hidden="true" /> Terms of Service
          </Link>
        </nav>
      </section>

      <div className="legal-layout">
        <aside className="legal-toc" aria-label="Contents">
          <p>Contents</p>
          <ol>
            {sections.map((s, i) => (
              <li key={s.id}>
                <a href={`#${s.id}`}>
                  <span>{i + 1}.</span> {s.title}
                </a>
              </li>
            ))}
          </ol>
        </aside>

        <article className="legal-doc">
          <div className="legal-intro">{intro}</div>
          {summary ? <div className="legal-summary">{summary}</div> : null}
          {sections.map((s, i) => (
            <section key={s.id} id={s.id} className="legal-section">
              <h2>
                <span>{i + 1}.</span> {s.title}
              </h2>
              {s.body}
            </section>
          ))}
        </article>
      </div>
    </main>
  );
}
