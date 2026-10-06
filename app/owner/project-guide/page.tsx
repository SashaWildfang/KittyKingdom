import { ArrowRight, Bot, Briefcase, Cloud, Database, ExternalLink, Globe, Lightbulb, Lock, NotebookPen, Presentation, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Fragment, type ReactNode } from "react";
import { getRealUser } from "../../../lib/auth";
import { getDiscordInviteSummary } from "../../../lib/discord";
import { OWNER_DISCORD_ID } from "../../../lib/ticket-delete";
import { SiteNav } from "../../site-nav";
import { JOB, ORDER, SECTIONS, type Block } from "./content";
import "./guide.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Project Guide | Kitty Kingdom", robots: { index: false, follow: false } };

/** **bold** and `code` */
function Md({ text }: { text: string }) {
  const out: ReactNode[] = [];
  const re = /\*\*(.+?)\*\*|`([^`]+)`/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(<Fragment key={`t${last}`}>{text.slice(last, m.index)}</Fragment>);
    out.push(m[1] !== undefined ? <b key={m.index}><Md text={m[1]} /></b> : <code key={m.index}>{m[2]}</code>);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(<Fragment key={`t${last}`}>{text.slice(last)}</Fragment>);
  return <>{out}</>;
}

function Diagram() {
  return (
    <div className="pg-diagram" aria-label="Architecture diagram">
      <div className="pg-node is-users">
        <span>Members</span>
        <small>Web browser · Discord app</small>
      </div>
      <div className="pg-row">
        <div className="pg-node is-web">
          <Globe size={20} aria-hidden="true" />
          <b>Website</b>
          <small>Next.js · React · TypeScript</small>
          <small>40 pages · 134 API routes</small>
          <em>Vercel (serverless)</em>
        </div>
        <div className="pg-link" aria-hidden="true">
          <span>reads / writes</span>
          <ArrowRight size={18} />
        </div>
        <div className="pg-node is-db">
          <Database size={20} aria-hidden="true" />
          <b>MongoDB Atlas</b>
          <small>&quot;website&quot; + &quot;zeo_bot&quot; databases</small>
          <small>job queues live here</small>
          <em>≈ Cosmos DB</em>
        </div>
        <div className="pg-link is-back" aria-hidden="true">
          <span>reads / writes</span>
          <ArrowRight size={18} />
        </div>
        <div className="pg-node is-bots">
          <Bot size={20} aria-hidden="true" />
          <b>4 Python bots</b>
          <small>discord.py · Motor</small>
          <small>Main · Economy · Moderation · Ticketing</small>
          <em>SparkedHost (always on)</em>
        </div>
      </div>
      <div className="pg-row is-services">
        <div className="pg-node is-ext">
          <Cloud size={16} aria-hidden="true" /> Resend (email)
        </div>
        <div className="pg-node is-ext">
          <Cloud size={16} aria-hidden="true" /> Discord API + OAuth2
        </div>
        <div className="pg-node is-ext">
          <Cloud size={16} aria-hidden="true" /> GitHub → Vercel deploys
        </div>
      </div>
    </div>
  );
}

const CALLOUT_ICON = { azure: Cloud, tip: Lightbulb, honest: ShieldCheck } as const;

function BlockView({ block }: { block: Block }) {
  switch (block.t) {
    case "p":
      return (
        <p className="pg-p">
          <Md text={block.text} />
        </p>
      );
    case "list":
      return (
        <ul className="pg-list">
          {block.items.map((item) => (
            <li key={item}>
              <Md text={item} />
            </li>
          ))}
        </ul>
      );
    case "code":
      return (
        <figure className="pg-code">
          <figcaption>
            <Md text={block.label} />
          </figcaption>
          <pre>
            <code>{block.code}</code>
          </pre>
          {block.note ? (
            <p className="pg-code-note">
              <Md text={block.note} />
            </p>
          ) : null}
        </figure>
      );
    case "table":
      return (
        <div className="pg-table-wrap">
          <table className="pg-table">
            <thead>
              <tr>
                {block.head.map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row) => (
                <tr key={row.join("|")}>
                  {row.map((cell, i) => (
                    <td key={i} data-label={block.head[i]}>
                      <Md text={cell} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "callout": {
      const Icon = CALLOUT_ICON[block.tone];
      return (
        <aside className={`pg-callout is-${block.tone}`}>
          <h4>
            <Icon size={17} aria-hidden="true" /> {block.title}
          </h4>
          <p>
            <Md text={block.text} />
          </p>
        </aside>
      );
    }
    case "steps":
      return (
        <ol className="pg-steps">
          {block.items.map((s) => (
            <li key={s.title}>
              <b>
                <Md text={s.title} />
              </b>
              <p>
                <Md text={s.text} />
              </p>
            </li>
          ))}
        </ol>
      );
    case "terms":
      return (
        <dl className="pg-terms">
          {block.items.map((x) => (
            <div key={x.term}>
              <dt>{x.term}</dt>
              <dd>
                <Md text={x.plain} />
              </dd>
              <dd className="pg-terms-mine">
                <span>In Kitty Kingdom:</span> <Md text={x.mine} />
              </dd>
            </div>
          ))}
        </dl>
      );
    case "queues":
      return (
        <div className="pg-queues">
          {block.items.map((q, i) => (
            <article key={q.name} className="pg-queue">
              <header>
                <span className="pg-queue-num">{i + 1}</span>
                <div>
                  <h4>{q.name}</h4>
                  <span className="pg-azure-tag">
                    <Cloud size={13} aria-hidden="true" /> {q.azure}
                  </span>
                </div>
              </header>
              <div className="pg-queue-meta">
                <div>
                  <small>Queue</small>
                  <code>{q.collection}</code>
                </div>
                <div>
                  <small>Sender</small>
                  <span>
                    <Md text={q.producer} />
                  </span>
                </div>
                <div>
                  <small>Receiver</small>
                  <span>
                    <Md text={q.consumer} />
                  </span>
                </div>
              </div>
              <ol className="pg-queue-flow">
                {q.flow.map((f) => (
                  <li key={f}>
                    <Md text={f} />
                  </li>
                ))}
              </ol>
              <p className="pg-queue-why">
                <b>Why:</b> <Md text={q.why} />
              </p>
            </article>
          ))}
        </div>
      );
    case "diagram":
      return <Diagram />;
  }
}

export default async function ProjectGuidePage({ searchParams }: { searchParams: { mode?: string } }) {
  // Only the owner, signed in as themselves (not an admin "viewing as" them)
  const user = await getRealUser().catch(() => null);
  if (!user || String(user.discordId ?? "") !== OWNER_DISCORD_ID) notFound();
  const discord = await getDiscordInviteSummary();
  // Present (default): clean, for screen sharing. Prep: adds private notes (pitch script, glossary, stories, Q&A)
  const prep = searchParams.mode === "prep";
  const sections = ORDER.map((id) => SECTIONS.find((s) => s.id === id)!).filter((s) => s && (prep || !s.prep));

  return (
    <main className="site-shell pg-shell">
      <SiteNav signedIn discordOnline={discord.online} />
      <div className="pg">
        <header className="pg-hero">
          <div className="pg-top">
            {prep ? (
              <span className="pg-private">
                <Lock size={13} aria-hidden="true" /> Prep mode: private notes are showing
              </span>
            ) : (
              <span />
            )}
            <div className="pg-mode" role="group" aria-label="Page mode">
              <a href="/owner/project-guide" className={prep ? "" : "is-on"} aria-current={prep ? undefined : "page"}>
                <Presentation size={15} aria-hidden="true" /> Present
              </a>
              <a href="/owner/project-guide?mode=prep" className={prep ? "is-on" : ""} aria-current={prep ? "page" : undefined}>
                <NotebookPen size={15} aria-hidden="true" /> Prep
              </a>
            </div>
          </div>
          <h1>How Kitty Kingdom is built</h1>
          <p>An overview of the project&apos;s architecture and technology, and how it relates to the Software Engineer I role.</p>
          <a className="pg-job" href={JOB.url} target="_blank" rel="noopener noreferrer">
            <Briefcase size={18} aria-hidden="true" />
            <span>
              <b>{JOB.title}</b>
              <small>{JOB.company}</small>
            </span>
            <ExternalLink size={14} aria-hidden="true" />
          </a>
          <div className="pg-chips" aria-label="Their tech stack">
            {JOB.stack.map((s) => (
              <span key={s}>{s}</span>
            ))}
          </div>
        </header>

        <div className="pg-layout">
          <nav className="pg-toc" aria-label="Sections">
            <b>On this page</b>
            {sections.map((s) => (
              <a key={s.id} href={`#${s.id}`} className={s.prep ? "is-prep" : undefined}>
                <small>{s.kicker}</small>
                {s.title}
              </a>
            ))}
          </nav>

          <div className="pg-sections">
            {sections.map((s) => (
              <section key={s.id} id={s.id} className={`pg-section${s.prep ? " is-prep" : ""}`}>
                <p className="pg-kicker">{s.kicker}</p>
                <h2>{s.title}</h2>
                {s.intro ? (
                  <p className="pg-intro">
                    <Md text={s.intro} />
                  </p>
                ) : null}
                {s.blocks.map((b, i) => (
                  <BlockView key={i} block={b} />
                ))}
              </section>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
