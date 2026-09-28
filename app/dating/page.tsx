"use client";

import { ArrowRight, Clock, Compass, Flame, Heart, LayoutGrid, MessageCircle, PenLine, Quote, Sparkles, Trophy, UserPlus, Users, Wand2, Zap } from "lucide-react";
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { Photo, ago, useApi, type Card } from "./ui";

type Featured = { hour: number; until: string; card: Card; pool: number; chance: number };
type Home = {
  booster: boolean;
  me: { name: string; photo: string | null; accent: string };
  hasProfile: boolean;
  needsReview: boolean;
  looking: boolean;
  strength: { score: number; missing: { points: number; label: string; tip: string }[] } | null;
  featured: Featured | null;
  recent: Featured[];
  counts: { likes: number; matches: number; unread: number; requests: number; friends: number; friendRequests: number };
  likesLeft: number | null;
  newest: Card[];
  active: Card[];
  top: Card[];
  interests: { name: string; count: number; mine: boolean }[];
  spotlight: { prompt: string; answers: { card: Card; answer: string }[]; mineAnswered: boolean };
  community: { profiles: number; openToDating: number; friendsOnly: number; newThisWeek: number; activeToday: number; withPhotos: number; matchesThisWeek: number };
  recentChats: { other: string; name: string; photo: string | null; accent: string; lastText: string; lastFromMe: boolean; lastAt: string | null; unread: number }[];
};

function Countdown({ until }: { until: string }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);
  const left = Math.max(0, new Date(until).getTime() - now);
  const m = Math.floor(left / 60000);
  const s = Math.floor((left % 60000) / 1000);
  return (
    <span className="dt-countdown">
      <Clock size={13} aria-hidden="true" /> next draw in {m}:{String(s).padStart(2, "0")}
    </span>
  );
}

function greeting() {
  const h = new Date().getHours();
  return h < 5 ? "Up late" : h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

/** A titled widget card. */
function Widget({ title, icon, action, children, className = "" }: { title: string; icon: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`dt-widget ${className}`}>
      <header>
        <h2>
          <span className="dt-widget-icon" aria-hidden="true">
            {icon}
          </span>
          {title}
        </h2>
        {action}
      </header>
      {children}
    </section>
  );
}

/** A row of round avatars that link to profiles. */
function Faces({ cards, show = "score" }: { cards: Card[]; show?: "score" | "active" | "new" }) {
  return (
    <div className="dt-faces">
      {cards.map((c) => (
        <a key={c.id} href={`/dating/u/${c.id}`} className="dt-face" style={{ "--acc": c.accent } as CSSProperties} title={c.name}>
          <span className="dt-face-img">
            <Photo src={c.photo} name={c.name} accent={c.accent} />
            {show === "active" && ago(c.lastActive) === "online now" ? <span className="dt-face-dot" aria-label="Online now" /> : null}
          </span>
          <b>{c.name}</b>
          <small>
            {show === "score" && c.score !== null ? `${c.datingFit ? c.emoji ?? "" : "🤝"} ${c.score}%` : show === "active" ? ago(c.lastActive)?.replace("active ", "") : c.age ? `${c.age}` : c.openToDating ? "💘" : "🫂"}
          </small>
        </a>
      ))}
    </div>
  );
}

export default function DatingHome() {
  const { data, error } = useApi<Home>("/api/dating/home", 60_000);
  if (error) return <p className="dt-error">{error}</p>;
  if (!data) return <div className="dt-loading dt-loading--tall" aria-busy="true" />;
  const f = data.featured;
  const c = data.community;
  const unread = data.counts.unread + data.counts.requests;

  return (
    <div className="dt-home">
      {/* Welcome + quick actions */}
      <section className="dt-welcome" style={{ "--acc": data.me.accent } as CSSProperties}>
        <div className="dt-welcome-who">
          <span className="dt-welcome-img">
            <Photo src={data.me.photo} name={data.me.name} accent={data.me.accent} />
          </span>
          <div>
            <p className="dt-kicker">
              <Sparkles size={13} aria-hidden="true" /> Kitty Kingdom Dating
            </p>
            <h1>
              {greeting()}, {data.me.name}!
            </h1>
            <p className="dt-muted">
              {unread
                ? `You have ${unread} unread message${unread === 1 ? "" : "s"}${data.counts.friendRequests ? ` and ${data.counts.friendRequests} friend request${data.counts.friendRequests === 1 ? "" : "s"}` : ""}.`
                : data.counts.friendRequests
                  ? `You have ${data.counts.friendRequests} friend request${data.counts.friendRequests === 1 ? "" : "s"} waiting.`
                  : `${c.activeToday} member${c.activeToday === 1 ? " was" : "s were"} active today. Say hi to someone new!`}
            </p>
          </div>
        </div>
        <div className="dt-quick">
          <a href="/dating/discover" className="dt-quick-btn is-dating">
            <Heart size={18} aria-hidden="true" />
            <span>
              <b>Find a date</b>
              <small>{data.looking ? (data.likesLeft === null ? "Unlimited likes" : `${data.likesLeft} likes left today`) : "Turn on in your profile"}</small>
            </span>
          </a>
          <a href="/dating/discover?mode=friends" className="dt-quick-btn is-friends">
            <UserPlus size={18} aria-hidden="true" />
            <span>
              <b>Find friends</b>
              <small>People to hang out with</small>
            </span>
          </a>
          <a href="/dating/browse" className="dt-quick-btn">
            <LayoutGrid size={18} aria-hidden="true" />
            <span>
              <b>Browse</b>
              <small>{c.profiles} profiles</small>
            </span>
          </a>
          <a href="/dating/messages" className={`dt-quick-btn${unread ? " is-hot" : ""}`}>
            <MessageCircle size={18} aria-hidden="true" />
            <span>
              <b>Messages</b>
              <small>{unread ? `${unread} unread` : "All caught up"}</small>
            </span>
          </a>
        </div>
        <div className="dt-mystats">
          <a href="/dating/likes">
            <b>{data.counts.likes}</b> likes
          </a>
          <a href="/dating/matches">
            <b>{data.counts.matches}</b> matches
          </a>
          <a href="/dating/friends">
            <b>{data.counts.friends}</b> friends
          </a>
        </div>
      </section>

      {!data.hasProfile ? (
        <section className="dt-hero-cta">
          <span className="dt-hero-cta-icon">
            <Wand2 size={30} aria-hidden="true" />
          </span>
          <div>
            <h2>Let&apos;s make your profile</h2>
            <p>A few friendly questions, some photos if you like, and our matching AI does the rest. Here for friends? That works too.</p>
          </div>
          <a className="dt-btn dt-btn--big" href="/dating/setup">
            Get started <ArrowRight size={16} aria-hidden="true" />
          </a>
        </section>
      ) : data.needsReview ? (
        <a className="dt-banner" href="/dating/setup?mode=review">
          <Sparkles size={18} aria-hidden="true" />
          <span>
            <b>Your profile moved to the new website.</b> Take a minute to check a few answers we converted, add photos and prompts, and you&apos;re all set.
          </span>
          <ArrowRight size={16} aria-hidden="true" />
        </a>
      ) : null}

      <div className="dt-home-grid">
        {/* Featured this hour */}
        <section className="dt-featured" style={{ "--acc": f?.card.accent ?? "#f59b2a" } as CSSProperties}>
          <header>
            <span className="dt-kicker">
              <Trophy size={14} aria-hidden="true" /> Featured this hour
            </span>
            {f ? <Countdown until={f.until} /> : null}
          </header>
          {f ? (
            <a href={`/dating/u/${f.card.id}`} className="dt-featured-card">
              <Photo src={f.card.photo} name={f.card.name} accent={f.card.accent} className="dt-featured-photo" />
              <div>
                <h2>
                  {f.card.name}
                  {f.card.age ? <span>, {f.card.age}</span> : null}
                </h2>
                {f.card.headline ? <p className="dt-headline">{f.card.headline}</p> : null}
                <p className="dt-muted">{[f.card.gender, f.card.pronouns, f.card.location].filter(Boolean).join(" · ")}</p>
                <p>{f.card.bio}</p>
                <span className="dt-featured-foot">
                  Drawn from {f.pool} open profiles · {(f.chance * 100).toFixed(1)}% chance
                  <span className="dt-textlink">
                    View profile <ArrowRight size={14} aria-hidden="true" />
                  </span>
                </span>
              </div>
            </a>
          ) : (
            <p className="dt-muted">No one is open to dating right now. Check back soon!</p>
          )}
          {data.recent.length ? (
            <div className="dt-featured-recent">
              <small>Earlier today</small>
              {data.recent.map((r) => (
                <a key={r.hour} href={`/dating/u/${r.card.id}`} title={r.card.name}>
                  <Photo src={r.card.photo} name={r.card.name} accent={r.card.accent} />
                  <span>{r.card.name}</span>
                </a>
              ))}
            </div>
          ) : null}
          <p className="dt-fine">💎 Server boosters get extra weight in the draw.</p>
        </section>

        <div className="dt-side">
          {data.top.length ? (
            <Widget
              title={data.looking ? "Your top matches" : "You'd get along with"}
              icon={<Flame size={16} />}
              action={
                <a className="dt-textlink" href={data.looking ? "/dating/discover" : "/dating/discover?mode=friends"}>
                  See all
                </a>
              }
            >
              <div className="dt-toplist">
                {data.top.map((t) => (
                  <a key={t.id} href={`/dating/u/${t.id}`} className="dt-toprow" style={{ "--acc": t.accent } as CSSProperties}>
                    <Photo src={t.photo} name={t.name} accent={t.accent} className="dt-avatar" />
                    <span>
                      <b>{t.name}</b>
                      <small className="dt-muted">{t.shared.slice(0, 2).join(" · ") || [t.age, t.location].filter(Boolean).join(" · ")}</small>
                    </span>
                    <span className={`dt-score-pill${t.datingFit ? "" : " is-friendly"}`}>
                      {t.datingFit ? t.emoji : "🤝"} {t.score}%
                    </span>
                  </a>
                ))}
              </div>
            </Widget>
          ) : null}
          {data.strength ? (
            <div className="dt-strength">
              <div className="dt-ring" style={{ "--p": data.strength.score } as CSSProperties}>
                <b>{data.strength.score}%</b>
              </div>
              <div>
                <b>Profile strength</b>
                {data.strength.missing.length ? (
                  <ul>
                    {data.strength.missing.slice(0, 2).map((m) => (
                      <li key={m.label}>{m.tip}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="dt-muted">Looking amazing. Nothing left to add!</p>
                )}
                <a className="dt-textlink" href="/dating/profile">
                  <PenLine size={13} aria-hidden="true" /> Edit profile
                </a>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {data.active.length ? (
        <Widget title="Active today" icon={<Zap size={16} />} action={<small className="dt-muted">{c.activeToday} members</small>} className="dt-widget--wide">
          <Faces cards={data.active} show="active" />
        </Widget>
      ) : null}

      <div className="dt-widget-grid">
        <Widget title="Prompt spotlight" icon={<Quote size={16} />}>
          <p className="dt-spot-q">{data.spotlight.prompt}</p>
          {data.spotlight.answers.length ? (
            <div className="dt-spot">
              {data.spotlight.answers.map((a) => (
                <a key={a.card.id} href={`/dating/u/${a.card.id}`} className="dt-spot-a" style={{ "--acc": a.card.accent } as CSSProperties}>
                  <Photo src={a.card.photo} name={a.card.name} accent={a.card.accent} className="dt-avatar dt-avatar--sm" />
                  <span>
                    <b>{a.card.name}</b>
                    <q>{a.answer}</q>
                  </span>
                </a>
              ))}
            </div>
          ) : (
            <p className="dt-muted">Nobody has answered this one yet. Be the first!</p>
          )}
          {!data.spotlight.mineAnswered && data.hasProfile ? (
            <a className="dt-textlink" href="/dating/profile#prompts">
              Answer a prompt <ArrowRight size={13} aria-hidden="true" />
            </a>
          ) : null}
        </Widget>

        <Widget title="Popular interests" icon={<Sparkles size={16} />}>
          {data.interests.length ? (
            <div className="dt-cloud">
              {data.interests.map((i) => (
                <a key={i.name} href={`/dating/browse?q=${encodeURIComponent(i.name)}`} className={i.mine ? "is-mine" : undefined} title={`${i.count} members`}>
                  {i.name} <small>{i.count}</small>
                </a>
              ))}
            </div>
          ) : (
            <p className="dt-muted">Not enough interests yet.</p>
          )}
          <p className="dt-fine">Highlighted ones are on your profile too. Tap one to find people who share it.</p>
        </Widget>

        <Widget title="Community pulse" icon={<Users size={16} />}>
          <div className="dt-pulse">
            <div>
              <b>{c.profiles}</b>
              <small>profiles</small>
            </div>
            <div>
              <b>{c.openToDating}</b>
              <small>open to dating</small>
            </div>
            <div>
              <b>{c.friendsOnly}</b>
              <small>here for friends</small>
            </div>
            <div>
              <b>{c.newThisWeek}</b>
              <small>new this week</small>
            </div>
            <div>
              <b>{c.matchesThisWeek}</b>
              <small>matches this week</small>
            </div>
            <div>
              <b>{c.withPhotos}</b>
              <small>with photos</small>
            </div>
          </div>
        </Widget>
      </div>

      <div className="dt-widget-grid dt-widget-grid--two">
        {data.newest.length ? (
          <Widget
            title="New faces"
            icon={<Sparkles size={16} />}
            action={
              <a className="dt-textlink" href="/dating/browse">
                Browse all
              </a>
            }
          >
            <Faces cards={data.newest} show="new" />
          </Widget>
        ) : null}
        <Widget
          title="Recent chats"
          icon={<MessageCircle size={16} />}
          action={
            <a className="dt-textlink" href="/dating/messages">
              Open
            </a>
          }
        >
          {data.recentChats.length ? (
            <div className="dt-toplist">
              {data.recentChats.map((ch) => (
                <a key={ch.other} href={`/dating/messages/${ch.other}`} className={`dt-toprow${ch.unread ? " is-unread" : ""}`}>
                  <Photo src={ch.photo} name={ch.name} accent={ch.accent} className="dt-avatar" />
                  <span>
                    <b>{ch.name}</b>
                    <small className="dt-muted">
                      {ch.lastFromMe ? "You: " : ""}
                      {ch.lastText}
                    </small>
                  </span>
                  {ch.unread ? <span className="dt-dot-count">{ch.unread}</span> : null}
                </a>
              ))}
            </div>
          ) : (
            <p className="dt-muted">
              No chats yet. Matches and friends can message freely, and anyone else can send a request.{" "}
              <a className="dt-textlink" href="/dating/discover">
                <Compass size={13} aria-hidden="true" /> Discover people
              </a>
            </p>
          )}
        </Widget>
      </div>
    </div>
  );
}
