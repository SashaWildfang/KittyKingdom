import { CircleHelp, Lightbulb } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getRealUser } from "../../../lib/auth";
import { getDiscordInviteSummary } from "../../../lib/discord";
import { OWNER_DISCORD_ID } from "../../../lib/ticket-delete";
import { SiteNav } from "../../site-nav";
import { Md } from "../project-guide/md";
import "../project-guide/guide.css";
import "./study.css";
import { STUDY, type StudyBlock } from "./content";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Study Guide | Kitty Kingdom", robots: { index: false, follow: false } };

function Block({ b }: { b: StudyBlock }) {
  switch (b.t) {
    case "p":
      return (
        <p className="pg-p">
          <Md text={b.text} />
        </p>
      );
    case "list":
      return (
        <ul className="pg-list">
          {b.items.map((i) => (
            <li key={i}>
              <Md text={i} />
            </li>
          ))}
        </ul>
      );
    case "code":
      return (
        <figure className="pg-code">
          <figcaption>{b.label}</figcaption>
          <pre>
            <code>{b.code}</code>
          </pre>
          {b.note ? <p className="pg-code-note">{b.note}</p> : null}
        </figure>
      );
    case "table":
      return (
        <div className="pg-table-wrap">
          <table className="pg-table">
            <thead>
              <tr>
                {b.head.map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {b.rows.map((r) => (
                <tr key={r.join("|")}>
                  {r.map((c, i) => (
                    <td key={i} data-label={b.head[i]}>
                      <Md text={c} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "tip":
      return (
        <aside className="pg-callout is-tip">
          <h4>
            <Lightbulb size={17} aria-hidden="true" /> {b.title}
          </h4>
          <p>
            <Md text={b.text} />
          </p>
        </aside>
      );
    case "qa":
      return (
        <div className="sgd-qa">
          {b.items.map(([q, a]) => (
            <details key={q}>
              <summary>
                <CircleHelp size={16} aria-hidden="true" />
                <span>{q}</span>
              </summary>
              <p>
                <Md text={a} />
              </p>
            </details>
          ))}
        </div>
      );
  }
}

export default async function StudyPage() {
  const user = await getRealUser().catch(() => null);
  if (!user || String(user.discordId ?? "") !== OWNER_DISCORD_ID) notFound();
  const discord = await getDiscordInviteSummary();
  const questions = STUDY.flatMap((s) => s.topics.flatMap((t) => t.blocks)).reduce((n, b) => n + (b.t === "qa" ? b.items.length : 0), 0);
  return (
    <main className="site-shell pg-shell">
      <SiteNav signedIn discordOnline={discord.online} />
      <div className="pg sgd-page">
        <header className="pg-hero sgd-hero">
          <span className="pg-private">Next-round prep</span>
          <h1>Interview Study Guide</h1>
          <p>
            SQL, OOP, C#, Azure, REST and Git, explained simply, with examples from Kitty Kingdom and {questions} practice questions. Click a question to reveal the answer.
          </p>
          <nav className="sgd-jump" aria-label="Topics">
            {STUDY.map((s) => (
              <a key={s.id} href={`#${s.id}`}>
                <span aria-hidden="true">{s.emoji}</span> {s.title}
              </a>
            ))}
          </nav>
        </header>

        <div className="pg-layout">
          <nav className="pg-toc" aria-label="Contents">
            <b>Contents</b>
            {STUDY.map((s) => (
              <div key={s.id} className="sgd-toc-group">
                <a href={`#${s.id}`}>
                  <small>
                    {s.emoji} {s.title}
                  </small>
                </a>
                {s.topics.map((t) => (
                  <a key={t.id} href={`#${t.id}`}>
                    {t.title}
                  </a>
                ))}
              </div>
            ))}
          </nav>

          <div className="pg-sections">
            {STUDY.map((s) => (
              <section key={s.id} id={s.id} className="pg-section">
                <p className="pg-kicker">
                  {s.emoji} {s.title}
                </p>
                <p className="pg-intro">
                  <Md text={s.intro} />
                </p>
                {s.topics.map((t) => (
                  <div key={t.id} id={t.id} className="sgd-topic">
                    <h2>{t.title}</h2>
                    {t.blocks.map((b, i) => (
                      <Block key={i} b={b} />
                    ))}
                  </div>
                ))}
              </section>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
