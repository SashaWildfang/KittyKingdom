"use client";

import {
  Award,
  ChevronDown,
  Coins,
  Crown,
  Dices,
  Gem,
  Globe,
  Heart,
  HeartHandshake,
  Leaf,
  Link as LinkIcon,
  Map as MapIcon,
  Search,
  Shield,
  ShoppingBag,
  Sparkles,
  Terminal,
  TrendingUp,
  X,
  type LucideIcon,
} from "lucide-react";
import { isValidElement, useEffect, useMemo, useState, type ReactNode } from "react";
import { COMMANDS, TOPICS } from "./content";
import { useCurrency } from "../season-context";

const ICONS: Record<string, LucideIcon> = { Award, Coins, Crown, Dices, Gem, Globe, Heart, HeartHandshake, Leaf, Link: LinkIcon, Map: MapIcon, Shield, ShoppingBag, Sparkles, TrendingUp };

/** Plain text of a ReactNode, for searching. */
function textOf(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join(" ");
  if (isValidElement(node)) return textOf((node.props as { children?: ReactNode }).children);
  return "";
}

export function FaqClient() {
  const cur = useCurrency();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const q = query.trim().toLowerCase();

  // Open a question straight from a link like /faq#economy
  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (id) document.getElementById(id)?.scrollIntoView({ block: "start" });
  }, []);

  const topics = useMemo(() => {
    if (!q) return TOPICS;
    const words = q.split(/\s+/);
    const hit = (text: string) => words.every((w) => text.includes(w));
    return TOPICS.map((t) => ({
      ...t,
      guides: (t.guides ?? []).filter((g) => hit(`${g.title} ${g.keywords ?? ""} ${textOf(g.body)}`.toLowerCase())),
      faqs: t.faqs.filter((f) => hit(`${f.q} ${f.keywords ?? ""} ${textOf(f.a)}`.toLowerCase())),
    })).filter((t) => t.faqs.length || t.guides.length);
  }, [q]);
  const commands = useMemo(
    () => COMMANDS.map((g) => ({ ...g, items: g.items.filter(([c, d]) => !q || `${c} ${d} ${g.group}`.toLowerCase().includes(q)) })).filter((g) => g.items.length),
    [q],
  );
  const results = topics.reduce((n, t) => n + t.faqs.length + (t.guides?.length ?? 0), 0) + commands.reduce((n, g) => n + g.items.length, 0);

  return (
    <>
      <div className="kb-search">
        <Search size={20} aria-hidden="true" />
        <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search the FAQ & guides… try “daily”, “boost” or “level 5”" aria-label="Search the FAQ" />
        {query ? (
          <button type="button" onClick={() => setQuery("")} aria-label="Clear search">
            <X size={16} />
          </button>
        ) : null}
      </div>
      {q ? <p className="kb-results">{results ? `${results} result${results === 1 ? "" : "s"} for “${query.trim()}”` : `Nothing found for “${query.trim()}”. Try another word, or ask us on the Support page.`}</p> : null}

      {!q ? (
        <nav className="kb-topics" aria-label="Topics">
          {TOPICS.map((t) => {
            const Icon = ICONS[t.icon] ?? Sparkles;
            return (
              <a key={t.id} href={`#${t.id}`} className="kb-topic">
                <span className="kb-topic-icon">
                  <Icon size={20} aria-hidden="true" />
                </span>
                <b>{cur.text(t.title)}</b>
                <small>{cur.text(t.blurb)}</small>
              </a>
            );
          })}
          <a href="#commands" className="kb-topic">
            <span className="kb-topic-icon">
              <Terminal size={20} aria-hidden="true" />
            </span>
            <b>Command cheat sheet</b>
            <small>Every slash command on one page.</small>
          </a>
        </nav>
      ) : null}

      {topics.map((t) => {
        const Icon = ICONS[t.icon] ?? Sparkles;
        return (
          <section key={t.id} id={t.id} className="kb-section">
            <header className="kb-section-head">
              <span className="kb-topic-icon">
                <Icon size={20} aria-hidden="true" />
              </span>
              <div>
                <h2>{cur.text(t.title)}</h2>
                <p>{cur.text(t.blurb)}</p>
              </div>
            </header>
            {t.guides?.length ? (
              <div className="kb-guides">
                {t.guides.map((g) => {
                  const GIcon = ICONS[g.icon] ?? Sparkles;
                  return (
                    <article key={g.title} className="kb-guide">
                      <h3>
                        <GIcon size={17} aria-hidden="true" /> {cur.text(g.title)}
                      </h3>
                      {g.body}
                    </article>
                  );
                })}
              </div>
            ) : null}
            {t.faqs.length ? (
              <div className="kb-faqs">
                {t.faqs.map((f) => {
                  const key = `${t.id}:${f.q}`;
                  const isOpen = Boolean(open[key] || q);
                  return (
                    <div key={key} className={`kb-faq${isOpen ? " is-open" : ""}`}>
                      <button type="button" aria-expanded={isOpen} onClick={() => setOpen((o) => ({ ...o, [key]: !o[key] }))}>
                        <span>{cur.text(f.q)}</span>
                        <ChevronDown size={18} aria-hidden="true" />
                      </button>
                      {isOpen ? <div className="kb-answer">{typeof f.a === "string" ? cur.text(f.a) : f.a}</div> : null}
                    </div>
                  );
                })}
              </div>
            ) : null}
          </section>
        );
      })}

      {commands.length ? (
        <section id="commands" className="kb-section">
          <header className="kb-section-head">
            <span className="kb-topic-icon">
              <Terminal size={20} aria-hidden="true" />
            </span>
            <div>
              <h2>Command cheat sheet</h2>
              <p>
                The most useful slash commands. Type <code className="kb-cmd">/help</code> in the server for the full menu.
              </p>
            </div>
          </header>
          <div className="kb-commands">
            {commands.map((g) => (
              <div key={g.group} className="kb-command-group">
                <h3>{g.group}</h3>
                <dl>
                  {g.items.map(([c, d]) => (
                    <div key={c}>
                      <dt>
                        <code className="kb-cmd">{c}</code>
                      </dt>
                      <dd>{cur.text(d)}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}
