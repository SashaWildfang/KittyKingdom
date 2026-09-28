import { BookOpen, Clock, FileText, LifeBuoy, Shield } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { getCurrentUser } from "../../lib/auth";
import { getDiscordInviteSummary } from "../../lib/discord";
import { FallingLeaves } from "../fall-effects";
import { SiteNav } from "../site-nav";
import { LegalToc } from "./legal-toc";

export type LegalSection = { id: string; title: string; body: ReactNode };
export type LegalPart = { title: string; ids: string[] };

/** Rough reading time from the page's words. */
function words(node: ReactNode): number {
  if (node === null || node === undefined || typeof node === "boolean") return 0;
  if (typeof node === "string") return node.split(/\s+/).filter(Boolean).length;
  if (typeof node === "number") return 1;
  if (Array.isArray(node)) return node.reduce((n: number, c) => n + words(c), 0);
  if (typeof node === "object" && "props" in node) return words((node.props as { children?: ReactNode }).children);
  return 0;
}

/**
 * The Legal center: Privacy Policy and Terms of Service as one part of the site, with the normal
 * navigation, a switch between the two, and contents grouped into parts.
 */
export async function LegalShell({
  current,
  title,
  updated,
  intro,
  summary,
  sections,
  parts,
}: {
  current: "privacy" | "terms";
  title: string;
  updated: string;
  intro: ReactNode;
  summary?: ReactNode;
  sections: LegalSection[];
  parts?: LegalPart[];
}) {
  const [user, discord] = await Promise.all([getCurrentUser().catch(() => null), getDiscordInviteSummary()]);
  const minutes = Math.max(1, Math.round((words(intro) + words(summary) + sections.reduce((n, s) => n + words(s.body), 0)) / 230));
  const number = new Map(sections.map((s, i) => [s.id, i + 1]));
  // Sections not listed in a part go in a final "More" part so nothing is ever hidden
  const listed = new Set((parts ?? []).flatMap((p) => p.ids));
  const groups = [...(parts ?? []), ...(sections.some((s) => !listed.has(s.id)) ? [{ title: parts?.length ? "More" : "Sections", ids: sections.filter((s) => !listed.has(s.id)).map((s) => s.id) }] : [])]
    .map((p) => ({ title: p.title, sections: p.ids.map((id) => sections.find((s) => s.id === id)).filter((s): s is LegalSection => Boolean(s)) }))
    .filter((p) => p.sections.length);

  return (
    <main className="site-shell legal-shell">
      <FallingLeaves foreground={false} />
      <SiteNav signedIn={Boolean(user)} discordOnline={discord.online} />

      <div className="legal-container">
        <header className="legal-head">
          <p className="eyebrow">Legal</p>
          <h1>{title}</h1>
          <div className="legal-bar">
            <nav className="legal-tabs" aria-label="Legal documents">
              <Link href="/privacy" className={current === "privacy" ? "is-on" : undefined} aria-current={current === "privacy" ? "page" : undefined}>
                <Shield size={16} aria-hidden="true" /> Privacy Policy
              </Link>
              <Link href="/terms" className={current === "terms" ? "is-on" : undefined} aria-current={current === "terms" ? "page" : undefined}>
                <FileText size={16} aria-hidden="true" /> Terms of Service
              </Link>
            </nav>
            <p className="legal-meta">
              <span>
                Updated <b>{updated}</b>
              </span>
              <span>
                <Clock size={14} aria-hidden="true" /> {minutes} min read
              </span>
            </p>
          </div>
        </header>

        <div className="legal-layout">
          <LegalToc parts={groups.map((g) => ({ title: g.title, items: g.sections.map((s) => ({ id: s.id, n: number.get(s.id)!, title: s.title })) }))} />

          <article className="legal-doc">
            <div className="legal-intro">{intro}</div>
            {summary ? <div className="legal-summary">{summary}</div> : null}
            {groups.map((g, gi) => (
              <div key={g.title} className="legal-part">
                {groups.length > 1 ? (
                  <p className="legal-part-title">
                    <span>Part {gi + 1}</span> {g.title}
                  </p>
                ) : null}
                {g.sections.map((s) => (
                  <section key={s.id} id={s.id} className="legal-section">
                    <h2>
                      <span>{number.get(s.id)}.</span> {s.title}
                    </h2>
                    {s.body}
                  </section>
                ))}
              </div>
            ))}
            <footer className="legal-foot">
              <p>Questions about this page?</p>
              <div>
                <a href="/support">
                  <LifeBuoy size={15} aria-hidden="true" /> Support
                </a>
                <a href="/faq">
                  <BookOpen size={15} aria-hidden="true" /> FAQ &amp; Guide
                </a>
                <Link href={current === "privacy" ? "/terms" : "/privacy"}>
                  {current === "privacy" ? <FileText size={15} aria-hidden="true" /> : <Shield size={15} aria-hidden="true" />}
                  {current === "privacy" ? "Terms of Service" : "Privacy Policy"}
                </Link>
              </div>
            </footer>
          </article>
        </div>
      </div>
    </main>
  );
}
