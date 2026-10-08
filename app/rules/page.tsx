import {
  Ban,
  Check,
  ClipboardList,
  Flame,
  Gavel,
  HeartHandshake,
  KeyRound,
  LifeBuoy,
  Lock,
  Megaphone,
  MessageCircle,
  MessagesSquare,
  Mic,
  RefreshCw,
  ShieldCheck,
  ShieldAlert,
  Siren,
  Sparkles,
  TrendingUp,
  Leaf,
  UserCheck,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { Metadata } from "next";
import { Fragment, type CSSProperties, type ReactNode } from "react";
import { getCurrentUser } from "../../lib/auth";
import { getDiscordInviteSummary } from "../../lib/discord";
import { stripEmojis } from "../../lib/names";
import { RULES } from "../../lib/rules-data";
import { DISCORD_INVITE } from "../faq/content";
import { FallingLeaves } from "../fall-effects";
import { SiteNav } from "../site-nav";
import "./rules.css";

export const metadata: Metadata = {
  title: "Server Rules | Kitty Kingdom",
  description: "The Kitty Kingdom rules: respect, 18+ only, SFW channels, dating on Social, asking before you DM, the 18+ area, safety, voice chats and how punishments work.",
};

// Icons instead of the emoji the Discord version uses
const PART_ICONS: Record<string, LucideIcon> = {
  basics: Leaf,
  chat: MessagesSquare,
  dating: HeartHandshake,
  nsfw: Flame,
  safety: ShieldCheck,
  voice: Mic,
  staff: Gavel,
};
const INFO_ICONS: [RegExp, LucideIcon][] = [
  [/report/i, Siren],
  [/punishment/i, TrendingUp],
  [/record|appeal/i, ClipboardList],
  [/change/i, RefreshCw],
];
// One icon per line of the short version, in order
const TLDR_ICONS: LucideIcon[] = [Sparkles, UserCheck, ShieldAlert, HeartHandshake, MessageCircle, Ban, Lock, Gavel];

const noEmoji = (text: string) => stripEmojis(text);

/** **bold**, [links](url) and `code`, the only formatting the rules use. */
function Md({ text: raw }: { text: string }) {
  const text = noEmoji(raw);
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

        <section className="rl-tldr" aria-labelledby="rl-tldr-title">
          <h2 id="rl-tldr-title">
            <Zap size={18} aria-hidden="true" /> The short version
          </h2>
          <ul>
            {RULES.tldr.map((t, i) => {
              const Icon = TLDR_ICONS[i] ?? Check;
              return (
                <li key={t}>
                  <span className="rl-tldr-icon" aria-hidden="true">
                    <Icon size={17} />
                  </span>
                  <span>
                    <Md text={t} />
                  </span>
                </li>
              );
            })}
          </ul>
        </section>

        <div className="rl-layout">
          <aside className="rl-side">
            <nav className="rl-toc" aria-label="Rule sections">
              <p className="rl-toc-title">Sections</p>
              {RULES.parts.map((p) => {
                const Icon = PART_ICONS[p.key] ?? Megaphone;
                const first = p.rules[0].n;
                const last = p.rules[p.rules.length - 1].n;
                return (
                  <a key={p.key} href={`#${p.key}`} style={{ "--tone": p.color } as CSSProperties}>
                    <span className="rl-toc-icon" aria-hidden="true">
                      <Icon size={16} />
                    </span>
                    <span>
                      <b>{p.title}</b>
                      <small>{first === last ? `Rule ${first}` : `Rules ${first}–${last}`}</small>
                    </span>
                  </a>
                );
              })}
            </nav>
            <p className="rl-password">
              <KeyRound size={17} aria-hidden="true" />
              <span>
                <b>Joining the server?</b> Your join form asks for a password. It&apos;s in the <b>#rules</b> channel in Discord, marked with a caution sign, so read them there too.
              </span>
            </p>
          </aside>

          <div className="rl-main">
            <section className="rl-intro">
              {RULES.intro.split("\n\n").map((para, i) => (
                <p key={i}>
                  <Md text={para} />
                </p>
              ))}
            </section>

            {RULES.parts.map((part) => {
              const Icon = PART_ICONS[part.key] ?? Megaphone;
              return (
                <section key={part.key} id={part.key} className="rl-part" style={{ "--tone": part.color } as CSSProperties}>
                  <header className="rl-part-head">
                    <span className="rl-part-icon" aria-hidden="true">
                      <Icon size={22} />
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
                          <span>{noEmoji(rule.title)}</span>
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
                      {part.info.map((info) => {
                        const InfoIcon = INFO_ICONS.find(([re]) => re.test(info.title))?.[1] ?? Megaphone;
                        return (
                          <div key={info.title}>
                            <h3>
                              <InfoIcon size={16} aria-hidden="true" /> {noEmoji(info.title)}
                            </h3>
                            {info.body.split("\n").map((line) => (
                              <p key={line}>
                                <Md text={line} />
                              </p>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                </section>
              );
            })}
          </div>
        </div>

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
