import { ArrowRight, Bot, Briefcase, Check, ChevronDown, Cloud, Database, Globe, Layers, Lightbulb, Rocket, Server, ShieldCheck, Flame, GraduationCap, Target, FileText, UserRound, ShieldHalf, HeartHandshake } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getRealUser } from "../../../lib/auth";
import { getDiscordInviteSummary } from "../../../lib/discord";
import { OWNER_DISCORD_ID } from "../../../lib/ticket-delete";
import { SiteNav } from "../../site-nav";
import { DEEP_DIVES, PITCH, SECTIONS, type Block, type Section } from "./content";
import "./guide.css";
import { Md } from "./md";
import { RequirementExplorer } from "./requirements";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Project Guide | Kitty Kingdom", robots: { index: false, follow: false } };

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

const FIT_ICON = { cloud: Cloud, layers: Layers, database: Database, rocket: Rocket, learn: Lightbulb } as const;
const STACK_ICON = { globe: Globe, server: Server, bot: Bot, database: Database } as const;

function SectionBody({ s }: { s: Section }) {
  return (
    <>
      {s.intro ? (
        <p className="pg-intro">
          <Md text={s.intro} />
        </p>
      ) : null}
      {s.blocks.map((b, i) => (
        <BlockView key={i} block={b} />
      ))}
    </>
  );
}

/** Present mode: a short, polished pitch, with the detail tucked into deep dives below */
function Pitch() {
  const deep = DEEP_DIVES.map((id) => SECTIONS.find((s) => s.id === id)).filter(Boolean) as Section[];
  return (
    <div className="pp">
      <section className="pp-hero">
        <span className="pp-eyebrow">
          <Briefcase size={14} aria-hidden="true" /> {PITCH.eyebrow}
        </span>
        <h1>{PITCH.title}</h1>
        <p className="pp-by">by Sasha Wildfang · Missoula, MT</p>
        <p className="pp-lead">{PITCH.lead}</p>
        <div className="pp-stats">
          {PITCH.stats.map(([n, label]) => (
            <div key={label}>
              <b>{n}</b>
              <span>{label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="pp-block pp-about" id="about">
        <p className="pg-kicker">
          <UserRound size={13} aria-hidden="true" /> {PITCH.about.title}
        </p>
        <h2>Who I am</h2>
        <p className="pp-about-lead">
          <Md text={PITCH.about.lead} />
        </p>
        <div className="pp-facts">
          {PITCH.about.facts.map(([k, v]) => (
            <div key={k}>
              <small>{k}</small>
              <p>{v}</p>
            </div>
          ))}
        </div>
        <a className="pp-resume-btn" href="/owner/resume" target="_blank" rel="noopener noreferrer">
          <FileText size={17} aria-hidden="true" /> View my resume
        </a>
      </section>

      <section className="pp-block pp-why" id="why">
        <p className="pg-kicker">The story</p>
        <h2>{PITCH.why.title}</h2>
        <div className="pp-why-grid">
          <div className="pp-why-text">
            {PITCH.why.paragraphs.map((t) => (
              <p key={t}>
                <Md text={t} />
              </p>
            ))}
          </div>
          <ol className="pp-why-timeline">
            {PITCH.why.timeline.map(([when, what]) => (
              <li key={when + what}>
                <small>{when}</small>
                <span>{what}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="pp-block pp-company" id="company">
        <p className="pg-kicker">{PITCH.company.kicker}</p>
        <h2>{PITCH.company.title}</h2>
        <div className="pp-company-grid">
          <div className="pp-why-text">
            {PITCH.company.paragraphs.map((t) => (
              <p key={t}>
                <Md text={t} />
              </p>
            ))}
          </div>
          <dl className="pp-company-facts">
            {PITCH.company.facts.map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="pp-block" id="fit">
        <p className="pg-kicker">Why I&apos;m a fit</p>
        <h2>Why I&apos;m a fit for this role</h2>
        <p className="pg-intro">{PITCH.fitIntro}</p>
        <div className="pp-fits">
          {PITCH.fits.map((f, n) => {
            const Icon = FIT_ICON[f.icon as keyof typeof FIT_ICON];
            return (
              <article key={f.title} className="pp-fit">
                <header>
                  <span className="pp-fit-icon">
                    <Icon size={22} aria-hidden="true" />
                  </span>
                  <span className="pp-fit-num">0{n + 1}</span>
                </header>
                <h3>{f.title}</h3>
                <ul className="pp-points">
                  {f.evidence.map((pt) => (
                    <li key={pt}>
                      <Check size={15} aria-hidden="true" />
                      <span>
                        <Md text={pt} />
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="pp-for-role">
                  <b>For this role:</b> {f.forRole}
                </p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="pp-block pp-hire" id="hire">
        <p className="pg-kicker">Skill set</p>
        <h2>Why you should hire me</h2>
        <p className="pp-hire-intro">{PITCH.hire.intro}</p>
        <div className="pp-skills">
          {PITCH.hire.groups.map((g) => (
            <div key={g.name} className="pp-skill-group">
              <h3>{g.name}</h3>
              <div className="pp-chips">
                {g.skills.map((k) => (
                  <span key={k}>{k}</span>
                ))}
              </div>
            </div>
          ))}
          <div className="pp-skill-group is-next">
            <h3>
              <GraduationCap size={16} aria-hidden="true" /> Learning next
            </h3>
            <div className="pp-chips">
              {PITCH.hire.next.map((k) => (
                <span key={k}>{k}</span>
              ))}
            </div>
          </div>
        </div>
        <div className="pp-ethic">
          <h3>
            <Flame size={18} aria-hidden="true" /> How I work
          </h3>
          <div className="pp-ethic-grid">
            {PITCH.hire.ethic.map(([t, d]) => (
              <div key={t}>
                <b>{t}</b>
                <p>{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="pp-block" id="stack">
        <p className="pg-kicker">Tech stack</p>
        <h2>What it&apos;s built with</h2>
        <div className="pp-stack">
          {PITCH.stack.map((g) => {
            const Icon = STACK_ICON[g.icon as keyof typeof STACK_ICON];
            return (
              <article key={g.group} className="pp-stack-group">
                <h3>
                  <Icon size={18} aria-hidden="true" /> {g.group}
                </h3>
                <ul>
                  {g.items.map(([name, what]) => (
                    <li key={name}>
                      <b>{name}</b>
                      <span>{what}</span>
                    </li>
                  ))}
                </ul>
              </article>
            );
          })}
        </div>
      </section>

      <section className="pp-block" id="checklist">
        <p className="pg-kicker">The job description</p>
        <h2>What this job requires, and what I&apos;ve done</h2>
        <p className="pg-intro">Pick a requirement to see what it is and where it shows up in Kitty Kingdom.</p>
        <RequirementExplorer items={PITCH.checklist} />
      </section>

      <section className="pp-block" id="spotlight">
        <p className="pg-kicker">Spotlight</p>
        <h2>{PITCH.spotlight.title}</h2>
        <div className="pp-story">
          <div>
            <small>The problem</small>
            <p>
              <Md text={PITCH.spotlight.problem} />
            </p>
          </div>
          <div>
            <small>My solution</small>
            <p>
              <Md text={PITCH.spotlight.solution} />
            </p>
          </div>
          <div className="is-azure">
            <small>
              <Cloud size={13} aria-hidden="true" /> On Azure
            </small>
            <p>
              <Md text={PITCH.spotlight.azure} />
            </p>
          </div>
        </div>
        <ol className="pp-flow">
          {PITCH.spotlight.steps.map(([t, d, term], i) => (
            <li key={t}>
              <span className="pp-flow-num">{i + 1}</span>
              <b>{t}</b>
              <small>{d}</small>
              <em>{term}</em>
            </li>
          ))}
        </ol>
        <p className="pp-flow-legend">
          <Cloud size={14} aria-hidden="true" /> The blue labels are the matching <b>Service Bus</b> terms.
        </p>
        <div className="pp-more">
          <b>Also built this way:</b>
          {PITCH.spotlight.more.map((m) => (
            <span key={m}>{m}</span>
          ))}
        </div>
      </section>

      <section className="pp-deep" id="deep-dives">
        <p className="pg-kicker">Technical deep dives</p>
        <h2>Want the details?</h2>
        <p className="pg-intro">Each topic shows how that part of the project connects to this job, with the full walkthrough and real code.</p>
        {deep.map((s) => (
          <details key={s.id} id={s.id} className="pp-details">
            <summary>
              <span className="pp-sum-title">
                <small>{s.kicker}</small>
                {s.title}
              </span>
              {s.roleTag ? (
                <span className="pp-role-tag">
                  <Target size={13} aria-hidden="true" /> {s.roleTag}
                </span>
              ) : null}
              <ChevronDown size={18} aria-hidden="true" />
            </summary>
            <div className="pp-details-body">
              {s.role ? (
                <p className="pp-role">
                  <Target size={16} aria-hidden="true" />
                  <span>
                    <b>How this relates to the job: </b>
                    <Md text={s.role} />
                  </span>
                </p>
              ) : null}
              <SectionBody s={s} />
            </div>
          </details>
        ))}
      </section>

      <section className="pp-final" id="closing">
        <p className="pg-kicker">{PITCH.closing.title}</p>
        <h2>{PITCH.closing.heading}</h2>
        {PITCH.closing.paragraphs.map((t) => (
          <p key={t} className="pp-final-text">
            {t}
          </p>
        ))}
        <div className="pp-final-points">
          {PITCH.closing.points.map(([t, d]) => (
            <div key={t}>
              <b>{t}</b>
              <p>{d}</p>
            </div>
          ))}
        </div>
        <p className="pp-clearance">
          <ShieldHalf size={18} aria-hidden="true" />
          <span>
            <Md text={PITCH.closing.clearance} />
          </span>
        </p>
        <p className="pp-thanks">
          <HeartHandshake size={20} aria-hidden="true" /> {PITCH.closing.thanks}
        </p>
      </section>
    </div>
  );
}

export default async function ProjectGuidePage() {
  // Only the owner, signed in as themselves (not an admin "viewing as" them)
  const user = await getRealUser().catch(() => null);
  if (!user || String(user.discordId ?? "") !== OWNER_DISCORD_ID) notFound();
  const discord = await getDiscordInviteSummary();
  return (
    <main className="site-shell pg-shell">
      <SiteNav signedIn discordOnline={discord.online} />
      <div className="pg">
        <Pitch />
      </div>
    </main>
  );
}
