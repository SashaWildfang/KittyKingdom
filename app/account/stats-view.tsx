"use client";

import {
  ArrowLeft,
  AtSign,
  CalendarDays,
  Clock,
  Crown,
  Dices,
  Flame,
  Hash,
  Headphones,
  Heart,
  Image as ImageIcon,
  MessageCircle,
  Mic,
  Rocket,
  Smile,
  Sparkles,
  Ticket,
  TrendingUp,
  Trophy,
  UserRound,
  Users,
  Zap,
} from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { MemberStats } from "../../lib/member-stats";
import { LeafEmote } from "../ui-icons";

const POLL_MS = 20_000;
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const reducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const fmt = (n: number) => Math.round(n).toLocaleString();
const compact = (n: number) => (Math.abs(n) >= 10_000 ? new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 }).format(n) : fmt(n));
const pct = (x: number) => `${Math.round(x * 100)}%`;
const hourLabel = (h: number) => new Date(2020, 0, 1, h).toLocaleTimeString([], { hour: "numeric" });
const dateLabel = (iso: string | null, opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" }) =>
  iso ? new Date(iso).toLocaleDateString([], opts) : "—";

function duration(seconds: number) {
  const s = Math.max(0, Math.round(seconds));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d) return `${d}d ${h}h`;
  if (h) return `${h}h ${m}m`;
  return `${m}m`;
}

function since(iso: string | null) {
  if (!iso) return "—";
  const days = Math.floor((Date.now() - Date.parse(iso)) / 86400000);
  if (days < 1) return "today";
  if (days < 60) return `${days} day${days === 1 ? "" : "s"} ago`;
  const months = Math.floor(days / 30.44);
  if (months < 24) return `${months} months ago`;
  return `${Math.floor(days / 365.25)} years ago`;
}

/** A number that counts up to its value (and to new values when the stats refresh). */
function Count({ value, format = fmt }: { value: number; format?: (n: number) => string }) {
  const [shown, setShown] = useState(reducedMotion() ? value : 0);
  const from = useRef(reducedMotion() ? value : 0);
  useEffect(() => {
    if (reducedMotion()) {
      setShown(value);
      return;
    }
    const start = performance.now();
    const origin = from.current;
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 900);
      const eased = 1 - (1 - t) ** 3;
      const v = origin + (value - origin) * eased;
      setShown(v);
      if (t < 1) frame = requestAnimationFrame(tick);
      else from.current = value;
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return <>{format(shown)}</>;
}

function Card({ title, icon, children, className, aside }: { title: string; icon: ReactNode; children: ReactNode; className?: string; aside?: ReactNode }) {
  return (
    <section className={`st-card${className ? ` ${className}` : ""}`}>
      <header className="st-card-head">
        <h3>
          {icon} {title}
        </h3>
        {aside}
      </header>
      {children}
    </section>
  );
}

function Tile({ icon, label, value, sub, tone }: { icon: ReactNode; label: string; value: ReactNode; sub?: ReactNode; tone?: string }) {
  return (
    <div className="st-tile" data-tone={tone}>
      <span className="st-tile-icon">{icon}</span>
      <span className="st-tile-label">{label}</span>
      <strong className="st-tile-value">{value}</strong>
      {sub ? <span className="st-tile-sub">{sub}</span> : null}
    </div>
  );
}

function Avatar({ src, name, size = 40 }: { src: string | null; name: string; size?: number }) {
  return src ? (
    <img className="st-avatar" src={src} alt="" width={size} height={size} />
  ) : (
    <span className="st-avatar st-avatar--letter" style={{ width: size, height: size }} aria-hidden="true">
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

function Emoji({ e }: { e: { name: string; url: string | null } }) {
  return e.url ? <img className="st-emoji" src={e.url} alt={`:${e.name}:`} title={`:${e.name}:`} /> : <span className="st-emoji-char">{e.name}</span>;
}

// ---------- Level hero with the animated XP bar ----------
/** Level badge in the level role's color, with dark or light text depending on how bright it is. */
function badgeStyle(colors: string[] | null): CSSProperties | undefined {
  if (!colors?.length) return undefined;
  const stops = colors.length === 1 ? [colors[0], colors[0]] : colors;
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(colors[0].slice(i, i + 2), 16) / 255);
  const light = 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.55;
  return {
    background: `radial-gradient(circle at 30% 25%, rgba(255, 255, 255, 0.35), transparent 55%), linear-gradient(135deg, ${stops.join(", ")})`,
    color: light ? "#1d0b05" : "#fff",
    boxShadow: `0 10px 30px ${colors[0]}66`,
  };
}
function LevelHero({ s }: { s: MemberStats }) {
  const { level } = s;
  const progress = Math.min(1, level.needed ? level.xp / level.needed : 0);
  const [fill, setFill] = useState(reducedMotion() ? progress : 0);
  useEffect(() => {
    const t = window.setTimeout(() => setFill(progress), 60);
    return () => window.clearTimeout(t);
  }, [progress]);
  return (
    <section className="st-hero">
      <div className="st-level-badge" aria-label={`Level ${level.level}`} style={badgeStyle(level.color)}>
        <span>Level</span>
        <strong>
          <Count value={level.level} />
        </strong>
      </div>
      <div className="st-hero-main">
        <div className="st-hero-top">
          <div>
            <p className="st-eyebrow">{level.role ?? "Rank"}</p>
            <h2>
              <Count value={level.xp} /> <small>/ {fmt(level.needed)} XP</small>
            </h2>
          </div>
          <div className="st-hero-rank" title="Your level rank among current members">
            <Trophy size={16} aria-hidden="true" /> #{fmt(level.rank)} <small>of {fmt(level.of)}</small>
          </div>
        </div>
        <div className="st-xp" role="progressbar" aria-valuemin={0} aria-valuemax={level.needed} aria-valuenow={level.xp} aria-label="XP to next level">
          <i style={{ width: `${fill * 100}%` }} />
          <span>{pct(progress)}</span>
        </div>
        <p className="st-hero-foot">
          <b>{fmt(Math.max(0, level.needed - level.xp))} XP</b> to level {level.level + 1}
          {level.nextRole ? (
            <>
              {" "}
              · next reward <b>{level.nextRole.name}</b> at level {level.nextRole.level}
            </>
          ) : (
            " · every level role unlocked"
          )}
          {level.totalXp ? <> · {fmt(level.totalXp)} XP earned all time</> : null}
        </p>
      </div>
    </section>
  );
}

// ---------- Charts ----------
function Bars({ values, labels, highlight, format = fmt }: { values: number[]; labels: string[]; highlight?: number; format?: (n: number) => string }) {
  const max = Math.max(1, ...values);
  const [hover, setHover] = useState<number | null>(null);
  const shown = hover ?? highlight ?? values.indexOf(Math.max(...values));
  return (
    <div className="st-bars-wrap">
      <div className="st-bars" style={{ "--n": values.length } as CSSProperties} onMouseLeave={() => setHover(null)}>
        {values.map((v, i) => (
          <button
            key={i}
            type="button"
            className={`st-bar${i === shown ? " is-on" : ""}`}
            style={{ "--h": `${Math.max(v ? 4 : 0, (v / max) * 100)}%` } as CSSProperties}
            onMouseEnter={() => setHover(i)}
            onFocus={() => setHover(i)}
            onClick={() => setHover(i)}
            aria-label={`${labels[i]}: ${format(v)}`}
          >
            <i />
          </button>
        ))}
      </div>
      <div className="st-bars-axis" aria-hidden="true">
        {labels.map((l, i) => (
          <span key={i}>{values.length > 12 ? (i % 3 === 0 ? l : "") : l}</span>
        ))}
      </div>
      {values.length ? (
        <p className="st-bars-readout">
          <b>{labels[shown]}</b> · {format(values[shown] ?? 0)}
        </p>
      ) : null}
    </div>
  );
}

function Heatmap({ heat }: { heat: number[][] }) {
  const max = Math.max(1, ...heat.flat());
  return (
    <div className="st-heat" role="img" aria-label="Messages by day of week and hour">
      {heat.map((row, d) => (
        <div className="st-heat-row" key={d}>
          <span>{DAYS[d]}</span>
          {row.map((v, h) => (
            <i key={h} style={{ "--a": v ? 0.15 + (v / max) * 0.85 : 0 } as CSSProperties} title={`${DAYS[d]} ${hourLabel(h)}: ${fmt(v)} messages`} />
          ))}
        </div>
      ))}
      <div className="st-heat-row st-heat-axis" aria-hidden="true">
        <span />
        {Array.from({ length: 24 }, (_, h) => (
          <em key={h}>{h % 6 === 0 ? hourLabel(h) : ""}</em>
        ))}
      </div>
    </div>
  );
}

function Calendar({ days }: { days: { date: string; n: number }[] }) {
  const max = Math.max(1, ...days.map((d) => d.n));
  // Pad so columns are whole weeks (Monday first)
  const firstDay = (new Date(`${days[0].date}T00:00:00Z`).getUTCDay() + 6) % 7;
  const cells: ({ date: string; n: number } | null)[] = [...Array(firstDay).fill(null), ...days];
  return (
    <div className="st-cal" role="img" aria-label="Messages per day for the last 26 weeks">
      {cells.map((c, i) =>
        c ? (
          <i
            key={i}
            style={{ "--a": c.n ? 0.2 + (c.n / max) * 0.8 : 0 } as CSSProperties}
            title={`${new Date(`${c.date}T12:00:00Z`).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}: ${fmt(c.n)} messages`}
          />
        ) : (
          <b key={i} />
        ),
      )}
    </div>
  );
}

function persona(hours: number[]) {
  const total = hours.reduce((a, b) => a + b, 0);
  if (!total) return null;
  const night = hours.slice(0, 5).reduce((a, b) => a + b, 0) + hours[23] + hours[22];
  const morning = hours.slice(5, 11).reduce((a, b) => a + b, 0);
  if (night / total > 0.35) return { icon: "🦉", text: "Night owl" };
  if (morning / total > 0.35) return { icon: "🐦", text: "Early bird" };
  return { icon: "☀️", text: "Daytime chatter" };
}

// ---------- The page ----------
export function StatsView({ onBack }: { onBack: () => void }) {
  const [stats, setStats] = useState<MemberStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [whenView, setWhenView] = useState<"hours" | "days" | "heat">("hours");

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch("/api/account/stats", { cache: "no-store" });
        const body = await res.json();
        if (!alive) return;
        if (res.ok && body.ok) {
          setStats(body.stats);
          setError(null);
        } else setError(body.error ?? "Your stats couldn't be loaded.");
      } catch {
        if (alive) setError((e) => e ?? "Your stats couldn't be loaded.");
      }
    };
    void load();
    const timer = window.setInterval(() => document.visibilityState === "visible" && void load(), POLL_MS);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, []);

  const top = (
    <div className="st-topbar">
      <button type="button" className="acct-button acct-button--small acct-button--ghost" onClick={onBack}>
        <ArrowLeft size={16} aria-hidden="true" /> Back to profile
      </button>
      <span className="st-live">
        <i aria-hidden="true" /> Live
      </span>
    </div>
  );

  if (!stats) {
    return (
      <div className="st-page">
        {top}
        <div className="st-card st-loading">{error ?? "Loading your stats…"}</div>
      </div>
    );
  }

  const s = stats;
  const m = s.messages;
  const who = persona(s.when.hours);
  const bestie = s.circle[0] ?? null;
  const peakHour = s.when.hours.indexOf(Math.max(...s.when.hours));
  const peakDay = s.when.weekdays.indexOf(Math.max(...s.when.weekdays));
  const favoriteVc = s.voice.channels[0] ?? null;
  const g = s.economy.gambling;

  return (
    <div className="st-page">
      {top}
      <LevelHero s={s} />

      <div className="st-tiles">
        <Tile icon={<MessageCircle size={18} />} label="Messages" value={<Count value={m.total} format={compact} />} sub={`#${fmt(m.rank)} of ${fmt(m.of)}`} />
        <Tile icon={<LeafEmote size={18} />} label="Leaves" value={<Count value={s.economy.balance} format={compact} />} sub={`#${fmt(s.economy.rank)} richest`} tone="gold" />
        <Tile icon={<Headphones size={18} />} label="Voice time" value={duration(s.voice.totalSeconds)} sub={`${duration(s.voice.monthSeconds)} this month`} />
        <Tile icon={<Flame size={18} />} label="Chat streak" value={<Count value={m.currentStreak} />} sub={`best ${fmt(m.longestStreak)} days`} tone="ember" />
        <Tile icon={<CalendarDays size={18} />} label="Active days" value={<Count value={m.activeDays} />} sub={m.busiestDay ? `busiest: ${fmt(m.busiestDay.n)} msgs` : "—"} />
        <Tile icon={<Heart size={18} />} label="Reactions received" value={<Count value={s.emojis.reactionsReceived} format={compact} />} sub={`${fmt(s.emojis.reactionsGiven)} given`} tone="rose" />
      </div>

      <div className="st-grid">
        <Card title="Server bestie" icon={<Heart size={17} />} className="st-bestie">
          {bestie ? (
            <>
              <div className="st-bestie-main">
                <Avatar src={bestie.avatar} name={bestie.name} size={72} />
                <div>
                  <strong>{bestie.name}</strong>
                  <p>
                    {[
                      bestie.conversations ? `${fmt(bestie.conversations)} back-and-forths` : null,
                      bestie.replies ? `${fmt(bestie.replies)} replies` : null,
                      bestie.mentions ? `${fmt(bestie.mentions)} mentions` : null,
                      bestie.voiceSeconds ? `${duration(bestie.voiceSeconds)} in VC together` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "You two talk the most"}
                  </p>
                </div>
              </div>
              {s.circle.length > 1 ? (
                <ol className="st-circle">
                  {s.circle.slice(1).map((c) => (
                    <li key={c.id}>
                      <Avatar src={c.avatar} name={c.name} size={28} />
                      <span>{c.name}</span>
                      <i style={{ "--w": `${(c.score / Math.max(1, bestie.score)) * 100}%` } as CSSProperties} />
                    </li>
                  ))}
                </ol>
              ) : null}
            </>
          ) : (
            <p className="st-empty">Chat, reply and hang out in VC and your bestie will show up here.</p>
          )}
        </Card>

        <Card title="Where you chat" icon={<Hash size={17} />}>
          {s.channels.length ? (
            <ul className="st-rank-list">
              {s.channels.map((c) => (
                <li key={c.id}>
                  <span className="st-rank-name">#{c.name}</span>
                  <span className="st-rank-bar">
                    <i style={{ "--w": `${(c.n / s.channels[0].n) * 100}%` } as CSSProperties} />
                  </span>
                  <span className="st-rank-val">
                    {compact(c.n)} <small>{pct(c.share)}</small>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="st-empty">Send a few messages and your favorite channels will show up here.</p>
          )}
        </Card>

        <Card
          title="When you chat"
          icon={<Clock size={17} />}
          className="st-wide"
          aside={
            <div className="st-seg" role="tablist" aria-label="Chart">
              {(["hours", "days", "heat"] as const).map((v) => (
                <button key={v} type="button" role="tab" aria-selected={whenView === v} className={whenView === v ? "is-on" : undefined} onClick={() => setWhenView(v)}>
                  {v === "hours" ? "By hour" : v === "days" ? "By day" : "Heatmap"}
                </button>
              ))}
            </div>
          }
        >
          {who ? (
            <p className="st-persona">
              <span aria-hidden="true">{who.icon}</span> <b>{who.text}</b> · most active around <b>{hourLabel(peakHour)}</b> on <b>{DAYS[peakDay]}s</b>
              <small> (your time)</small>
            </p>
          ) : null}
          {whenView === "hours" ? (
            <Bars values={s.when.hours} labels={s.when.hours.map((_, h) => hourLabel(h))} format={(n) => `${fmt(n)} messages`} />
          ) : whenView === "days" ? (
            <Bars values={s.when.weekdays} labels={DAYS} format={(n) => `${fmt(n)} messages`} />
          ) : (
            <Heatmap heat={s.when.heat} />
          )}
        </Card>

        <Card title="Last 26 weeks" icon={<CalendarDays size={17} />} className="st-wide">
          <Calendar days={s.calendar} />
          <p className="st-note">
            {m.first ? <>First counted message {dateLabel(m.first)} · </> : null}
            last message {since(m.last)}
          </p>
        </Card>

        <Card title="Voice" icon={<Mic size={17} />}>
          <dl className="st-dl">
            <div><dt>All time</dt><dd>{duration(s.voice.totalSeconds)}</dd></div>
            <div><dt>This month</dt><dd>{duration(s.voice.monthSeconds)}</dd></div>
            <div><dt>With others</dt><dd>{s.voice.trackedSeconds ? pct(s.voice.withOthersSeconds / s.voice.trackedSeconds) : "—"}</dd></div>
            <div><dt>Times joined</dt><dd>{fmt(s.voice.joins)}</dd></div>
          </dl>
          {favoriteVc ? (
            <p className="st-fav">
              <Headphones size={15} aria-hidden="true" /> Favorite VC: <b>{favoriteVc.name}</b> ({duration(favoriteVc.seconds)})
            </p>
          ) : null}
          {s.voice.buddies.length ? (
            <ul className="st-people">
              {s.voice.buddies.map((b) => (
                <li key={b.id}>
                  <Avatar src={b.avatar} name={b.name} size={26} />
                  <span>{b.name}</span>
                  <small>{duration(b.seconds)}</small>
                </li>
              ))}
            </ul>
          ) : null}
        </Card>

        <Card title="Emojis & reactions" icon={<Smile size={17} />}>
          {s.emojis.top.length ? (
            <div className="st-emoji-row">
              {s.emojis.top.map((e) => (
                <span key={e.key} className="st-emoji-chip">
                  <Emoji e={e} /> <small>{compact(e.count)}</small>
                </span>
              ))}
            </div>
          ) : (
            <p className="st-empty">No emojis counted yet.</p>
          )}
          <dl className="st-dl">
            <div><dt>Reactions given</dt><dd>{fmt(s.emojis.reactionsGiven)}</dd></div>
            <div><dt>Reactions received</dt><dd>{fmt(s.emojis.reactionsReceived)}</dd></div>
            <div>
              <dt>Your go-to reaction</dt>
              <dd>{s.emojis.topGiven[0] ? <Emoji e={s.emojis.topGiven[0]} /> : "—"}</dd>
            </div>
            <div>
              <dt>People react with</dt>
              <dd>{s.emojis.topReceived[0] ? <Emoji e={s.emojis.topReceived[0]} /> : "—"}</dd>
            </div>
          </dl>
          {s.emojis.biggestFan ? (
            <p className="st-fav">
              <Sparkles size={15} aria-hidden="true" /> Biggest fan: <b>{s.emojis.biggestFan.name}</b> ({fmt(s.emojis.biggestFan.n)} reactions)
            </p>
          ) : null}
        </Card>

        <Card title="How you chat" icon={<AtSign size={17} />}>
          <dl className="st-dl st-dl--3">
            <div><dt>Words</dt><dd>{compact(m.words)}</dd></div>
            <div><dt>Words / message</dt><dd>{m.avgWords}</dd></div>
            <div><dt>Characters</dt><dd>{compact(m.characters)}</dd></div>
            <div><dt>Replies sent</dt><dd>{fmt(m.repliesSent)}</dd></div>
            <div><dt>Replies received</dt><dd>{fmt(m.repliesReceived)}</dd></div>
            <div><dt>Emojis used</dt><dd>{fmt(m.emojis)}</dd></div>
            <div><dt><ImageIcon size={13} aria-hidden="true" /> Images</dt><dd>{fmt(m.images)}</dd></div>
            <div><dt>Videos</dt><dd>{fmt(m.videos)}</dd></div>
            <div><dt>GIFs</dt><dd>{fmt(m.gifs)}</dd></div>
            <div><dt>Links</dt><dd>{fmt(m.links)}</dd></div>
            <div><dt>Stickers</dt><dd>{fmt(m.stickers)}</dd></div>
            <div><dt>Voice notes & audio</dt><dd>{fmt(m.audio)}</dd></div>
          </dl>
        </Card>

        <Card title="Leaves & store" icon={<LeafEmote size={17} />}>
          <dl className="st-dl">
            <div><dt>Balance</dt><dd><Count value={s.economy.balance} /></dd></div>
            <div><dt>Daily streak</dt><dd>{fmt(s.economy.dailyStreak)} days</dd></div>
            <div><dt>Store purchases</dt><dd>{fmt(s.economy.purchases)}</dd></div>
            <div><dt>Leaves spent</dt><dd>{compact(s.economy.spent)}</dd></div>
            <div><dt>Gifts sent</dt><dd>{fmt(s.economy.giftsSent)}</dd></div>
            <div><dt>Gifts received</dt><dd>{fmt(s.economy.giftsReceived)}</dd></div>
            <div><dt>Items owned</dt><dd>{fmt(s.economy.items)}</dd></div>
            <div><dt>Server bumps</dt><dd>{fmt(s.economy.bumps)} <small>({fmt(s.economy.monthlyBumps)} this month)</small></dd></div>
            <div><dt>QOTD answers</dt><dd>{fmt(s.economy.qotdAnswers)}</dd></div>
          </dl>
        </Card>

        <Card title="Boosts" icon={<Zap size={17} />}>
          <div className="st-mults">
            <div>
              <span>XP</span>
              <strong>{s.multipliers.xp.toFixed(2)}×</strong>
            </div>
            <div>
              <span>Leaves</span>
              <strong>{s.multipliers.leaves.toFixed(2)}×</strong>
            </div>
          </div>
          <ul className="st-checks">
            <li className={s.multipliers.booster ? "is-on" : undefined}><Rocket size={14} aria-hidden="true" /> Server booster {s.multipliers.booster ? "(+15%)" : ""}</li>
            <li className={s.multipliers.patreon ? "is-on" : undefined}><Crown size={14} aria-hidden="true" /> Patreon {s.multipliers.patreon ? `· ${s.multipliers.patreon}` : ""}</li>
            <li className={s.multipliers.xpWeekend ? "is-on" : undefined}><TrendingUp size={14} aria-hidden="true" /> XP weekend</li>
            <li className={s.multipliers.globalBooster ? "is-on" : undefined}><Sparkles size={14} aria-hidden="true" /> Server-wide booster</li>
          </ul>
          {s.multipliers.consumable ? (
            <p className="st-fav">
              <Flame size={15} aria-hidden="true" /> <b>{s.multipliers.consumable.name}</b>
              {s.multipliers.consumable.endsAt ? <> · ends {new Date(s.multipliers.consumable.endsAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</> : null}
            </p>
          ) : null}
        </Card>

        {g ? (
          <Card title="Games" icon={<Dices size={17} />}>
            <dl className="st-dl">
              <div><dt>Spins</dt><dd>{fmt(g.spins)}</dd></div>
              <div><dt>Net</dt><dd className={g.net >= 0 ? "st-up" : "st-down"}>{g.net >= 0 ? "+" : ""}{compact(g.net)}</dd></div>
              <div><dt>Won</dt><dd>{compact(g.won)}</dd></div>
              <div><dt>Spent</dt><dd>{compact(g.spent)}</dd></div>
              <div><dt>Biggest win</dt><dd>{compact(g.biggestWin)}</dd></div>
              <div><dt>Biggest loss</dt><dd>{compact(Math.abs(g.biggestLoss))}</dd></div>
            </dl>
          </Card>
        ) : null}

        <Card title="Tickets" icon={<Ticket size={17} />}>
          <dl className="st-dl">
            <div><dt>Opened</dt><dd>{fmt(s.tickets.total)}</dd></div>
            <div><dt>Open now</dt><dd>{fmt(s.tickets.open)}</dd></div>
            <div><dt>Last ticket</dt><dd>{since(s.tickets.last)}</dd></div>
          </dl>
          {s.tickets.byType.length ? (
            <div className="st-emoji-row">
              {s.tickets.byType.map((t) => (
                <span key={t.type} className="st-pill">
                  {t.type} <b>{t.n}</b>
                </span>
              ))}
            </div>
          ) : null}
        </Card>

        <Card title="Account" icon={<UserRound size={17} />}>
          <dl className="st-dl">
            <div><dt>Joined the server</dt><dd>{dateLabel(s.profile.joinedServer)}</dd></div>
            <div><dt>Discord account made</dt><dd>{dateLabel(s.profile.discordCreated)}</dd></div>
            {s.profile.boostingSince ? <div><dt>Boosting since</dt><dd>{dateLabel(s.profile.boostingSince)}</dd></div> : null}
            <div><dt>Time in the kingdom</dt><dd>{since(s.profile.joinedServer).replace(" ago", "")}</dd></div>
          </dl>
          {s.profile.isStaff ? (
            <p className="st-fav">
              <Users size={15} aria-hidden="true" /> Part of the staff team
            </p>
          ) : null}
        </Card>
      </div>

      <p className="st-footnote">
        Levels, leaves, total messages and voice time come straight from the bot. Channels, besties, emojis, reactions and hours are counted
        {s.countedSince ? ` since ${dateLabel(s.countedSince)}` : " from now on"}. Times are shown in your time zone.
      </p>
    </div>
  );
}
