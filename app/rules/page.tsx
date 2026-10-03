import { Check, KeyRound, LifeBuoy, MessageCircle, X } from "lucide-react";
import type { Metadata } from "next";
import { Fragment, type CSSProperties, type ReactNode } from "react";
import { getCurrentUser } from "../../lib/auth";
import { getDiscordInviteSummary } from "../../lib/discord";
import { RULES } from "../../lib/rules-data";
import { DISCORD_INVITE } from "../faq/content";
import { FallingLeaves } from "../fall-effects";
import { SiteNav } from "../site-nav";
import "./rules.css";

export const metadata: Metadata = {
  title: "Server Rules | Kitty Kingdom",
  description: "The Kitty Kingdom rules: respect, 18+ only, SFW channels, dating on Social, asking before you DM, the 18+ area, safety, voice chats and how punishments work.",
};

/** **bold**, [links](url) and `code`, the only formatting the rules use. */
function Md({ text }: { text: string }) {
  const out: ReactNode[] = [];
  const re = /\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)]+)\)|`([^`]+)`/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1] !== undefined)
      out.push(
        <b key={m.index}>
          <Md text={m[1]} />
        </b>,
      );
    else if (m[4] !== undefined) out.push(<code key={m.index}>{m[4]}</code>);
    else {
      const external = /^https?:/.test(m[3]) && !m[3].includes("kittykingdom.net");
      const href = m[3].replace(/^https:\/\/www\.kittykingdom\.net/, "") || "/";
      out.push(
        <a key={m.index} href={href} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
          {m[2]}
        </a>,
      );
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return <>{out.map((x, i) => (typeof x === "string" ? <Fragment key={`t${i}`}>{x}</Fragment> : x))}</>;
}

export default async function RulesPage() {
  const [user, discord] = await Promise.all([getCurrentUser().catch(() => null), getDiscordInviteSummary()]);
  const total = RULES.parts.reduce((n, p) => n + p.rules.length, 0);
  return (
    <main className="site-shell kb-shell">
      <FallingLeaves foreground={false} />
      <SiteNav signedIn={Boolean(user)} discordOnline={discord.online} />
      <div className="kb-container rl">
        <section className="kb-hero">
          <p className="eyebrow">Kitty Kingdom</p>
          <h1>Server Rules</h1>
          <p>
            {total} rules that keep the kingdom cozy. They apply in every channel, voice chats, the website, Social and your DMs with members.
          </p>
        </section>

        <section className="rl-intro">
          <div className="rl-intro-text">
            {RULES.intro.split("\n\n").map((para, i) => (
              <p key={i}>
                <Md text={para} />
              </p>
            ))}
          </div>
          <aside className="rl-tldr" aria-label="The short version">
            <h2>⚡ The short version</h2>
            <ul>
              {RULES.tldr.map((t) => (
                <li key={t}>
                  <Md text={t} />
                </li>
              ))}
            </ul>
          </aside>
        </section>

        <p className="rl-password">
          <KeyRound size={17} aria-hidden="true" />
          <span>
            <b>Joining the server?</b> Your join form asks for a password that&apos;s hidden in the rules. It&apos;s only in the <b>#rules</b> channel in Discord, so read them there too.
          </span>
        </p>

        <nav className="rl-toc" aria-label="Rule sections">
          {RULES.parts.map((p) => {
            const first = p.rules[0].n;
            const last = p.rules[p.rules.length - 1].n;
            return (
              <a key={p.key} href={`#${p.key}`} style={{ "--tone": p.color } as CSSProperties}>
                <span aria-hidden="true">{p.emoji}</span>
                <span>
                  <b>{p.title}</b>
                  <small>{first === last ? `Rule ${first}` : `Rules ${first}–${last}`}</small>
                </span>
              </a>
            );
          })}
        </nav>

        {RULES.parts.map((part) => (
          <section key={part.key} id={part.key} className="rl-part" style={{ "--tone": part.color } as CSSProperties}>
            <header className="rl-part-head">
              <span className="rl-part-emoji" aria-hidden="true">
                {part.emoji}
              </span>
              <div>
                <small>{part.label}</small>
                <h2>{part.title}</h2>
              </div>
            </header>
            {part.intro ? (
              <p className="rl-part-intro">
                <Md text={part.intro} />
              </p>
            ) : null}
            <div className="rl-rules">
              {part.rules.map((rule) => (
                <article key={rule.n} id={`rule-${rule.n}`} className="rl-rule">
                  <h3>
                    <a href={`#rule-${rule.n}`} className="rl-num" aria-label={`Link to rule ${rule.n}`}>
                      {rule.n}
                    </a>
                    {rule.title}
                  </h3>
                  <ul>
                    {rule.points.map((pt) => (
                      <li key={pt}>
                        <Md text={pt} />
                      </li>
                    ))}
                  </ul>
                  {rule.bad.length || rule.good.length ? (
                    <div className="rl-examples">
                      {rule.bad.length ? (
                        <div className="rl-ex is-bad">
                          <h4>
                            <X size={15} aria-hidden="true" /> Not okay
                          </h4>
                          <ul>
                            {rule.bad.map((x) => (
                              <li key={x}>
                                <Md text={x} />
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                      {rule.good.length ? (
                        <div className="rl-ex is-good">
                          <h4>
                            <Check size={15} aria-hidden="true" /> Okay
                          </h4>
                          <ul>
                            {rule.good.map((x) => (
                              <li key={x}>
                                <Md text={x} />
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
            {part.info.length ? (
              <div className="rl-info">
                {part.info.map((info) => (
                  <div key={info.title}>
                    <h3>{info.title}</h3>
                    {info.body.split("\n").map((line) => (
                      <p key={line}>
                        <Md text={line} />
                      </p>
                    ))}
                  </div>
                ))}
              </div>
            ) : null}
          </section>
        ))}

        <aside className="kb-cta">
          <div>
            <b>Need to report something, or have a question?</b>
            <span>Open a ticket in Discord. Reports are private, and staff are happy to help.</span>
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
