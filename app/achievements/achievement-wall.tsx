"use client";

import { Dices, Gift, Medal, PartyPopper, Sparkles, Trophy } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { AchievementFeed, Achievement } from "../../lib/achievements";
import type { BadgeShape } from "../../lib/badges";
import { BadgeMedal } from "../account/badge-medal";
import { useCurrency } from "../season-context";
import { LeafEmote } from "../ui-icons";

type Filter = "all" | "badge" | "win" | "giveaway";
const GAMES: Record<string, string> = { slots: "Slots", blackjack: "Blackjack", roulette: "Roulette", mines: "Mines", scratch: "Scratch-offs" };

function ago(iso: string, now: number) {
  const m = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60_000));
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

function Avatar({ src, name }: { src: string | null | undefined; name: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return src ? <img className="aw-avatar" src={src} alt="" loading="lazy" /> : <span className="aw-avatar is-letter">{name.charAt(0).toUpperCase()}</span>;
}

function Item({ a, name, avatar, mine, now }: { a: Achievement; name: string; avatar: string | null | undefined; mine: boolean; now: number }) {
  const cur = useCurrency();
  return (
    <li className={`aw-item is-${a.kind}${mine ? " is-mine" : ""}`}>
      <span className="aw-icon">
        {a.kind === "badge" ? (
          <BadgeMedal icon={a.icon} shape={a.shape as BadgeShape} hue={a.hue} tier={a.tier} size={46} />
        ) : a.kind === "win" ? (
          <span className="aw-glyph is-win">
            <Dices size={22} aria-hidden="true" />
          </span>
        ) : (
          <span className="aw-glyph is-gift">
            <Gift size={22} aria-hidden="true" />
          </span>
        )}
      </span>
      <div className="aw-body">
        <p>
          <span className="aw-who">
            <Avatar src={avatar} name={name} />
            <b>{mine ? "You" : name}</b>
          </span>{" "}
          {a.kind === "badge" ? (
            <>
              {a.upgrade ? "upgraded" : "earned"} <b className="aw-badge-name" style={{ ["--hue" as string]: a.hue }}>{a.name}</b> <span className={`aw-tier t${a.tier}`}>{a.tierName}</span>
            </>
          ) : a.kind === "win" ? (
            <>
              won <b className="aw-amount">
                {a.won.toLocaleString()} <LeafEmote size={16} />
              </b>{" "}
              on {GAMES[a.game] ?? a.game}
              {a.bet ? <small> (bet {a.bet.toLocaleString()})</small> : null}
            </>
          ) : (
            <>
              won <b>{cur.text(a.prize)}</b> in {a.title}
            </>
          )}
        </p>
        <time dateTime={a.at}>{ago(a.at, now)}</time>
      </div>
    </li>
  );
}

export function AchievementWall({ feed, me }: { feed: AchievementFeed | null; me: string }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(t);
  }, []);
  const items = useMemo(() => (feed?.items ?? []).filter((i) => filter === "all" || i.kind === filter), [feed, filter]);
  const mineCount = (feed?.items ?? []).filter((i) => i.userId === me).length;

  return (
    <div className="aw">
      <header className="aw-hero">
        <div>
          <p className="aw-eyebrow">
            <Trophy size={14} aria-hidden="true" /> Achievements
          </p>
          <h1>The achievement wall</h1>
          <p className="aw-lead">New badges, big wins and giveaway winners from the last two weeks. Earn badges by chatting, hanging out in voice and playing; they show up here when you check your stats.</p>
        </div>
        <a className="aw-mine" href="/account#stats">
          <Medal size={16} aria-hidden="true" /> My badges
          {mineCount ? <small>{mineCount} recent</small> : null}
        </a>
      </header>

      {feed ? (
        <>
          <section className="aw-stats">
            <div>
              <Sparkles size={18} aria-hidden="true" />
              <b>{feed.stats.badges.toLocaleString()}</b>
              <span>badges earned</span>
            </div>
            <div>
              <PartyPopper size={18} aria-hidden="true" />
              <b>{feed.stats.bigWins.toLocaleString()}</b>
              <span>big casino wins</span>
            </div>
            <div>
              <Trophy size={18} aria-hidden="true" />
              <b>
                {feed.stats.biggestWin.toLocaleString()} <LeafEmote size={18} />
              </b>
              <span>biggest win</span>
            </div>
          </section>

          {feed.trending.length ? (
            <section className="aw-trending" aria-label="Trending badges">
              <h2>Trending badges</h2>
              <div>
                {feed.trending.map((t) => (
                  <span key={t.badgeId} className="aw-trend">
                    <BadgeMedal icon={t.icon} shape={t.shape as BadgeShape} hue={t.hue} tier={1} size={34} />
                    <span>
                      <b>{t.name}</b>
                      <small>
                        {t.count} member{t.count === 1 ? "" : "s"}
                      </small>
                    </span>
                  </span>
                ))}
              </div>
            </section>
          ) : null}

          <div className="aw-filters" role="tablist" aria-label="Show">
            {(
              [
                ["all", "Everything"],
                ["badge", "Badges"],
                ["win", "Big wins"],
                ["giveaway", "Giveaways"],
              ] as [Filter, string][]
            ).map(([k, label]) => (
              <button key={k} type="button" className={filter === k ? "is-on" : undefined} onClick={() => setFilter(k)}>
                {label}
              </button>
            ))}
          </div>

          {now === null ? (
            <div className="aw-loading" />
          ) : items.length ? (
            <ul className="aw-list">
              {items.map((a, i) => (
                <Item key={`${a.kind}-${a.userId}-${a.at}-${i}`} a={a} name={feed.people[a.userId]?.name ?? "A member"} avatar={feed.people[a.userId]?.avatar} mine={a.userId === me} now={now} />
              ))}
            </ul>
          ) : (
            <p className="aw-empty">Nothing here yet. Go earn something!</p>
          )}
        </>
      ) : (
        <p className="aw-empty">The wall couldn&apos;t load right now.</p>
      )}
    </div>
  );
}
