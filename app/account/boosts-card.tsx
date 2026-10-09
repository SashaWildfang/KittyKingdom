"use client";

import { Heart, Leaf, Rocket, Sparkles, Star, TriangleAlert, Zap } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { BoostStatus, Part } from "../../lib/boosts";
import { CurrencyName } from "../season-context";

const ICON: Record<string, typeof Zap> = { booster_xp: Zap, booster_balance: Leaf, booster_profile: Heart, booster_spotlight: Star };

function left(endsAt: string) {
  const ms = Date.parse(endsAt) - Date.now();
  if (ms <= 0) return "ending now";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h >= 24 ? `${Math.floor(h / 24)}d ${h % 24}h left` : h ? `${h}h ${m}m left` : `${m}m left`;
}

const pct = (n: number) => (n >= 0.995 ? "99%+" : n >= 0.1 ? `${Math.round(n * 100)}%` : n >= 0.01 ? `${(n * 100).toFixed(1)}%` : `${(n * 100).toFixed(2)}%`);

function Parts({ parts }: { parts: Part[] }) {
  return (
    <ul className="bst-parts">
      {parts.map((p) => (
        <li key={p.label}>
          <span>{p.label}</span>
          <b>{p.value}</b>
        </li>
      ))}
    </ul>
  );
}

/** My Account: boosters running now, your earning multipliers and your odds in Social's Featured draw. */
export function BoostsCard() {
  const [data, setData] = useState<BoostStatus | null>(null);
  const [error, setError] = useState(false);
  const [, tick] = useState(0);

  useEffect(() => {
    let stop = false;
    const load = () =>
      fetch("/api/account/boosts", { cache: "no-store" })
        .then((r) => r.json())
        .then((r) => !stop && (r?.ok ? (setData(r.status), setError(false)) : setError(true)))
        .catch(() => !stop && setError(true));
    void load();
    const poll = setInterval(load, 120_000);
    const clock = setInterval(() => tick((n) => n + 1), 30_000);
    return () => {
      stop = true;
      clearInterval(poll);
      clearInterval(clock);
    };
  }, []);

  if (error && !data) return <p className="acct-muted">Couldn&apos;t load your boosts right now.</p>;
  if (!data) return <div className="bst-loading" aria-busy="true" />;

  const s = data.social;
  return (
    <div className="bst">
      <section className="bst-block">
        <h3>
          <Rocket size={16} aria-hidden="true" /> Running now
        </h3>
        {data.boosters.length ? (
          <ul className="bst-list">
            {data.boosters.map((b) => {
              const Icon = ICON[b.id] ?? Sparkles;
              const total = b.startedAt ? Date.parse(b.endsAt) - Date.parse(b.startedAt) : 0;
              const done = total > 0 ? Math.min(1, Math.max(0, (Date.now() - Date.parse(b.startedAt!)) / total)) : 0;
              return (
                <li key={`${b.id}-${b.endsAt}`} className={`bst-booster is-${b.id}`}>
                  <span className="bst-booster-icon">
                    <Icon size={18} aria-hidden="true" />
                  </span>
                  <span className="bst-booster-copy">
                    <b>{b.name}</b>
                    {b.what ? <small>{b.what}</small> : null}
                    <i className="bst-bar" style={{ width: `${(1 - done) * 100}%` }} aria-hidden="true" />
                  </span>
                  <span className="bst-left" title={new Date(b.endsAt).toLocaleString()}>
                    {left(b.endsAt)}
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="bst-empty">
            No boosters running. <Link href="/store">Get one in the Store</Link> or use one from your inventory.
          </p>
        )}
      </section>

      <section className="bst-block bst-mults">
        <div className="bst-mult">
          <h3>
            <Zap size={16} aria-hidden="true" /> XP
          </h3>
          <strong>{data.xp.total}×</strong>
          <Parts parts={data.xp.parts} />
        </div>
        <div className="bst-mult">
          <h3>
            <Leaf size={16} aria-hidden="true" /> <CurrencyName />
          </h3>
          <strong>{data.leaves.total}×</strong>
          <Parts parts={data.leaves.parts} />
        </div>
      </section>

      <section className="bst-block">
        <h3>
          <Heart size={16} aria-hidden="true" /> Social Featured draw
        </h3>
        {!s.hasProfile ? (
          <p className="bst-empty">
            Make a <Link href="/social">Social profile</Link> to be in the hourly Featured draw.
          </p>
        ) : (
          <>
            <div className="bst-odds">
              <div>
                <small>Your weight</small>
                <strong>{Math.round(s.weight * 100) / 100}</strong>
              </div>
              <div>
                <small>Each hour</small>
                <strong>{pct(s.chancePerHour)}</strong>
                <em>1 in {Math.max(1, Math.round(1 / s.chancePerHour)).toLocaleString()}</em>
              </div>
              <div>
                <small>In the next day</small>
                <strong>{pct(s.chancePerDay)}</strong>
                <em>about {(s.chancePerHour * 24).toFixed(1)} times a day</em>
              </div>
            </div>
            <Parts parts={s.weightParts} />
            <p className="bst-fine">
              {s.poolSize.toLocaleString()} profiles are in the draw, with a combined weight of {Math.round(s.totalWeight).toLocaleString()}. A new member is featured every hour,
              picked at random by weight.
              {s.spotlight ? " Your Spotlight is on, so you're also at the top of Discover and Browse." : ""}
            </p>
            {!s.eligible ? (
              <div className="bst-warn">
                <TriangleAlert size={16} aria-hidden="true" />
                <span>
                  <b>You&apos;re not in the draw right now.</b> These odds are what you&apos;d have once you are:
                  <ul>
                    {s.blockers.map((b) => (
                      <li key={b}>{b}</li>
                    ))}
                  </ul>
                </span>
              </div>
            ) : null}
            {!s.profileBooster ? (
              <p className="bst-tip">
                <Sparkles size={14} aria-hidden="true" /> A <Link href="/store">Profile Booster</Link> doubles your weight for a day.
              </p>
            ) : null}
          </>
        )}
      </section>
    </div>
  );
}
