"use client";

import { ArrowRight, Clock, Compass, Heart, MessageCircle, PenLine, Sparkles, Trophy, Wand2 } from "lucide-react";
import { useEffect, useState, type CSSProperties } from "react";
import { Photo, useApi, type Card } from "./ui";

type Featured = { hour: number; until: string; card: Card; pool: number; chance: number };
type Home = {
  booster: boolean;
  hasProfile: boolean;
  needsReview: boolean;
  strength: { score: number; missing: { points: number; label: string; tip: string }[] } | null;
  featured: Featured | null;
  recent: Featured[];
  counts: { likes: number; matches: number; unread: number; requests: number };
  likesLeft: number | null;
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

export default function DatingHome() {
  const { data, error } = useApi<Home>("/api/dating/home", 60_000);
  if (error) return <p className="dt-error">{error}</p>;
  if (!data) return <div className="dt-loading" aria-busy="true" />;
  const f = data.featured;
  return (
    <div className="dt-home">
      {!data.hasProfile ? (
        <section className="dt-hero-cta">
          <span className="dt-hero-cta-icon">
            <Wand2 size={30} aria-hidden="true" />
          </span>
          <div>
            <h1>Let&apos;s make your dating profile</h1>
            <p>A few friendly questions, some photos if you like, and our matching AI does the rest. It takes about five minutes and you can change anything later.</p>
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

        <aside className="dt-side">
          <div className="dt-stats">
            <a href="/dating/likes">
              <Heart size={18} aria-hidden="true" />
              <b>{data.counts.likes}</b>
              <span>likes</span>
            </a>
            <a href="/dating/matches">
              <Sparkles size={18} aria-hidden="true" />
              <b>{data.counts.matches}</b>
              <span>matches</span>
            </a>
            <a href="/dating/messages" className={data.counts.unread + data.counts.requests ? "is-hot" : undefined}>
              <MessageCircle size={18} aria-hidden="true" />
              <b>{data.counts.unread + data.counts.requests}</b>
              <span>unread</span>
            </a>
          </div>
          <a className="dt-discover-cta" href="/dating/discover">
            <Compass size={22} aria-hidden="true" />
            <span>
              <b>Discover</b>
              <small>{data.likesLeft === null ? "Unlimited likes (booster perk)" : `${data.likesLeft} of 3 likes left today`}</small>
            </span>
            <ArrowRight size={18} aria-hidden="true" />
          </a>
          {data.strength ? (
            <div className="dt-strength">
              <div className="dt-ring" style={{ "--p": data.strength.score } as CSSProperties}>
                <b>{data.strength.score}%</b>
              </div>
              <div>
                <b>Profile strength</b>
                {data.strength.missing.length ? (
                  <ul>
                    {data.strength.missing.slice(0, 3).map((m) => (
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
        </aside>
      </div>
    </div>
  );
}
