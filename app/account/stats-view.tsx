"use client";

import {
  ArrowDownRight,
  ArrowLeft,
  ArrowUpRight,
  AtSign,
  Award,
  CalendarDays,
  Camera,
  Clock,
  Crown,
  Dices,
  Flame,
  Gift,
  Hash,
  Headphones,
  Heart,
  HelpCircle,
  Image as ImageIcon,
  Lock,
  MessageCircle,
  Mic,
  MonitorUp,
  Moon,
  Rocket,
  ShoppingBag,
  Smile,
  Sparkles,
  Star,
  Sun,
  Terminal,
  Ticket,
  Timer,
  TrendingUp,
  Trophy,
  UserRound,
  Users,
  X,
  Zap,
  Shapes,
  VolumeX,
  Coins,
  BarChart3,
  CalendarRange,
  Sunrise,
  Sunset,
  CornerDownRight,
  MessagesSquare,
  Network,
  PieChart,
  Reply,
  Snowflake,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { BadgeHistory } from "../../lib/badge-history";
import type { BadgeShowcase, EarnedBadge } from "../../lib/badges";
import type { MemberStats } from "../../lib/member-stats";
import { LeafEmote } from "../ui-icons";
import { BadgeMedal } from "./badge-medal";
import { BadgeCollection } from "./stats-badges";
import { FriendshipMap, PeopleExplorer } from "./stats-social";
import { TopicMap } from "./stats-topics";
import { TrendsCard } from "./stats-trends";

const POLL_MS = 7_000;
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const FULL_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
type Tab = "overview" | "social" | "activity" | "topics" | "voice" | "economy" | "badges";
const TABS: { key: Tab; label: string; icon: LucideIcon }[] = [
  { key: "overview", label: "Overview", icon: Sparkles },
  { key: "social", label: "Social", icon: Heart },
  { key: "activity", label: "Activity", icon: MessageCircle },
  { key: "topics", label: "Topics", icon: Shapes },
  { key: "voice", label: "Voice", icon: Headphones },
  { key: "economy", label: "Leaves & store", icon: ShoppingBag },
  { key: "badges", label: "Badges", icon: Award },
];

const reducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const fmt = (n: number) => Math.round(n).toLocaleString();
const compact = (n: number) => (Math.abs(n) >= 10_000 ? new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 }).format(n) : fmt(n));
const pct = (x: number) => `${Math.round(x * 100)}%`;
const hourLabel = (h: number) => new Date(2020, 0, 1, h).toLocaleTimeString([], { hour: "numeric" });
const dateLabel = (iso: string | null, opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" }) =>
  iso ? new Date(iso).toLocaleDateString([], opts) : "—";
const dayLabel = (d: string, opts: Intl.DateTimeFormatOptions = { weekday: "long", month: "long", day: "numeric", year: "numeric" }) =>
  new Date(`${d}T12:00:00`).toLocaleDateString([], opts);

function duration(seconds: number) {
  const s = Math.max(0, Math.round(seconds));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d) return `${d}d ${h}h`;
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m`;
  return s ? `${s}s` : "0m";
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

function change(now: number, before: number) {
  if (!before) return now ? { up: true, text: "new" } : null;
  const d = (now - before) / before;
  return { up: d >= 0, text: `${d >= 0 ? "+" : ""}${Math.round(d * 100)}%` };
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
      setShown(origin + (value - origin) * (1 - (1 - t) ** 3));
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

function Tile({ icon, label, value, sub, tone, onClick, spark }: { icon: ReactNode; label: string; value: ReactNode; sub?: ReactNode; tone?: string; onClick?: () => void; spark?: number[] }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag type={onClick ? "button" : undefined} className={`st-tile${onClick ? " is-link" : ""}`} data-tone={tone} onClick={onClick}>
      <span className="st-tile-icon">{icon}</span>
      <span className="st-tile-label">{label}</span>
      <strong className="st-tile-value">{value}</strong>
      {sub ? <span className="st-tile-sub">{sub}</span> : null}
      {spark ? <Spark values={spark} /> : null}
      {onClick ? (
        <span className="st-tile-go" aria-hidden="true">
          <ArrowUpRight size={14} />
        </span>
      ) : null}
    </Tag>
  );
}

function Spark({ values }: { values: number[] }) {
  const max = Math.max(1, ...values);
  const pts = values.map((v, i) => `${(i / Math.max(1, values.length - 1)) * 100},${30 - (v / max) * 28}`).join(" ");
  return (
    <svg className="st-spark" viewBox="0 0 100 32" preserveAspectRatio="none" aria-hidden="true">
      <polyline points={pts} />
    </svg>
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

// ---------- Level orb ----------
function roleGradient(colors: string[] | null | undefined) {
  if (!colors?.length) return ["#f59b2a", "#c85f18", "#ffd27a"];
  return colors.length === 1 ? [colors[0], colors[0]] : colors;
}

function isLight(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.55;
}

/** The level bubble: the level role's colors and icon, a spinning halo, the XP ring and sparkles. */
function LevelOrb({ s, onOpen }: { s: MemberStats; onOpen: () => void }) {
  const { level } = s;
  const progress = Math.min(1, level.needed ? level.xp / level.needed : 0);
  const stops = roleGradient(level.color);
  const light = isLight(stops[0]);
  const [ring, setRing] = useState(reducedMotion() ? progress : 0);
  useEffect(() => {
    const t = window.setTimeout(() => setRing(progress), 120);
    return () => window.clearTimeout(t);
  }, [progress]);
  const R = 58;
  const C = 2 * Math.PI * R;
  return (
    <button
      type="button"
      className="st-orb"
      onClick={onOpen}
      title="Open your level journey"
      aria-label={`Level ${level.level}. Open your level journey`}
      style={{ "--c1": stops[0], "--c2": stops[1] ?? stops[0], "--c3": stops[2] ?? stops[1] ?? stops[0], "--ink": light ? "#1d0b05" : "#fff" } as CSSProperties}
    >
      <span className="st-orb-glow" aria-hidden="true" />
      <span className="st-orb-spin" aria-hidden="true" />
      <svg className="st-orb-ring" viewBox="0 0 132 132" aria-hidden="true">
        <defs>
          <linearGradient id="st-orb-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={stops[0]} />
            <stop offset="55%" stopColor={stops[1] ?? stops[0]} />
            <stop offset="100%" stopColor={stops[2] ?? stops[1] ?? stops[0]} />
          </linearGradient>
        </defs>
        <circle cx="66" cy="66" r={R} className="st-orb-track" />
        <circle cx="66" cy="66" r={R} className="st-orb-fill" strokeDasharray={C} strokeDashoffset={C * (1 - ring)} />
      </svg>
      <span className="st-orb-core">
        <span className="st-orb-icon" aria-hidden="true">
          {level.icon ? <img src={level.icon} alt="" /> : level.emoji ? <span>{level.emoji}</span> : <Crown size={20} strokeWidth={2.4} />}
        </span>
        <strong>
          <Count value={level.level} />
        </strong>
        <span className="st-orb-label">Level</span>
      </span>
      {[0, 1, 2, 3].map((i) => (
        <i key={i} className="st-orb-spark" style={{ "--i": i } as CSSProperties} aria-hidden="true" />
      ))}
    </button>
  );
}

function LevelHero({ s }: { s: MemberStats }) {
  const { level } = s;
  const progress = Math.min(1, level.needed ? level.xp / level.needed : 0);
  const [fill, setFill] = useState(reducedMotion() ? progress : 0);
  const [journey, setJourney] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setFill(progress), 60);
    return () => window.clearTimeout(t);
  }, [progress]);
  const totalNow = level.startXp + level.xp;
  return (
    <section className="st-hero">
      <LevelOrb s={s} onOpen={() => setJourney((j) => !j)} />
      <div className="st-hero-main">
        <div className="st-hero-top">
          <div>
            <p className="st-eyebrow" style={level.color?.[0] ? { color: level.color[0] } : undefined}>
              {level.role ?? "Rank"}
            </p>
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
          {[0.25, 0.5, 0.75].map((mark) => (
            <b key={mark} className={progress >= mark ? "is-past" : undefined} style={{ left: `${mark * 100}%` }} aria-hidden="true" />
          ))}
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
          <button type="button" className="st-link" onClick={() => setJourney((j) => !j)}>
            {journey ? "Hide" : "See"} level journey
          </button>
        </p>
      </div>
      {journey ? (
        <div className="st-journey">
          <ol>
            {level.journey.map((j) => {
              const reachPct = j.reached ? 1 : Math.min(1, totalNow / Math.max(1, j.xpToReach));
              const stops = roleGradient(j.colors.length ? j.colors : null);
              return (
                <li key={j.level} className={`${j.reached ? "is-reached" : ""}${j.current ? " is-current" : ""}`}>
                  <span className="st-journey-dot" style={{ background: `linear-gradient(135deg, ${stops.join(", ")})` }}>
                    {j.icon ? <img src={j.icon} alt="" /> : j.emoji ? j.emoji : j.reached ? <Star size={12} /> : <Lock size={11} />}
                  </span>
                  <div>
                    <b style={j.colors[0] ? { color: j.colors[0] } : undefined}>{j.name}</b>
                    <small>
                      Level {j.level}
                      {j.until ? `–${j.until}` : "+"} · {fmt(j.xpToReach)} total XP
                    </small>
                    {!j.reached ? (
                      <span className="st-journey-bar">
                        <i style={{ width: `${reachPct * 100}%` }} />
                      </span>
                    ) : null}
                  </div>
                  <em>{j.current ? "You're here" : j.reached ? "Unlocked" : `${compact(Math.max(0, j.xpToReach - totalNow))} XP to go`}</em>
                </li>
              );
            })}
          </ol>
          <p className="st-note">You&apos;ve earned {fmt(level.totalXp || totalNow)} XP in total.</p>
        </div>
      ) : null}
    </section>
  );
}

// ---------- Charts ----------
function Bars({ values, labels, format = fmt }: { values: number[]; labels: string[]; format?: (n: number) => string }) {
  const max = Math.max(1, ...values);
  const [hover, setHover] = useState<number | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const peak = values.indexOf(Math.max(...values));
  const shown = hover ?? picked ?? peak;
  const total = values.reduce((a, b) => a + b, 0);
  return (
    <div className="st-bars-wrap">
      <div className="st-bars" style={{ "--n": values.length } as CSSProperties} onMouseLeave={() => setHover(null)}>
        {values.map((v, i) => (
          <button
            key={i}
            type="button"
            className={`st-bar${i === shown ? " is-on" : ""}${i === peak && v ? " is-peak" : ""}`}
            style={{ "--h": `${Math.max(v ? 4 : 0, (v / max) * 100)}%` } as CSSProperties}
            onMouseEnter={() => setHover(i)}
            onFocus={() => setHover(i)}
            onClick={() => setPicked(i)}
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
      <p className="st-bars-readout">
        <b>{labels[shown]}</b> · {format(values[shown] ?? 0)}
        {total ? <small> ({pct((values[shown] ?? 0) / total)} of the total)</small> : null}
        {shown === peak && total ? <em className="st-peak-tag">Peak</em> : null}
      </p>
    </div>
  );
}

function Heatmap({ heat }: { heat: number[][] }) {
  const max = Math.max(1, ...heat.flat());
  const [picked, setPicked] = useState<{ d: number; h: number } | null>(null);
  return (
    <div>
      <div className="st-heat" role="grid" aria-label="Messages by day of week and hour">
        {heat.map((row, d) => (
          <div className="st-heat-row" key={d} role="row">
            <span>{DAYS[d]}</span>
            {row.map((v, h) => (
              <button
                type="button"
                key={h}
                className={picked?.d === d && picked?.h === h ? "is-on" : undefined}
                style={{ "--a": v ? 0.15 + (v / max) * 0.85 : 0 } as CSSProperties}
                title={`${FULL_DAYS[d]} ${hourLabel(h)}: ${fmt(v)} messages`}
                onClick={() => setPicked({ d, h })}
                aria-label={`${FULL_DAYS[d]} ${hourLabel(h)}: ${fmt(v)} messages`}
              />
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
      <p className="st-bars-readout">
        {picked ? (
          <>
            <b>
              {FULL_DAYS[picked.d]}s, {hourLabel(picked.h)}–{hourLabel((picked.h + 1) % 24)}
            </b>{" "}
            · {fmt(heat[picked.d][picked.h])} messages
          </>
        ) : (
          "Tap a square to see that hour."
        )}
      </p>
    </div>
  );
}

function Calendar({ days }: { days: { date: string; n: number }[] }) {
  const [range, setRange] = useState<91 | 182 | 364>(182);
  const [picked, setPicked] = useState<{ date: string; n: number } | null>(null);
  const shown = days.slice(-range);
  const max = Math.max(1, ...shown.map((d) => d.n));
  const active = shown.filter((d) => d.n > 0);
  const avg = active.length ? active.reduce((a, d) => a + d.n, 0) / active.length : 0;
  const firstDay = (new Date(`${shown[0].date}T12:00:00`).getDay() + 6) % 7;
  const cells: ({ date: string; n: number } | null)[] = [...Array(firstDay).fill(null), ...shown];
  const months: { col: number; label: string }[] = [];
  cells.forEach((c, i) => {
    if (c && c.date.endsWith("-01")) months.push({ col: Math.floor(i / 7), label: new Date(`${c.date}T12:00:00`).toLocaleDateString([], { month: "short" }) });
  });
  return (
    <div className="st-cal-wrap">
      <div className="st-seg st-seg--small" role="tablist" aria-label="Calendar range">
        {([91, 182, 364] as const).map((r) => (
          <button key={r} type="button" role="tab" aria-selected={range === r} className={range === r ? "is-on" : undefined} onClick={() => setRange(r)}>
            {r === 91 ? "3 months" : r === 182 ? "6 months" : "1 year"}
          </button>
        ))}
      </div>
      <div className="st-cal-scroll">
        <div className="st-cal-months" style={{ "--cols": Math.ceil(cells.length / 7) } as CSSProperties} aria-hidden="true">
          {months.map((mo) => (
            <span key={`${mo.col}-${mo.label}`} style={{ gridColumn: mo.col + 1 }}>
              {mo.label}
            </span>
          ))}
        </div>
        <div className="st-cal" role="grid" aria-label="Messages per day">
          {cells.map((c, i) =>
            c ? (
              <button
                type="button"
                key={i}
                className={picked?.date === c.date ? "is-on" : undefined}
                style={{ "--a": c.n ? 0.2 + (c.n / max) * 0.8 : 0 } as CSSProperties}
                title={`${dayLabel(c.date, { weekday: "short", month: "short", day: "numeric" })}: ${fmt(c.n)} messages`}
                onClick={() => setPicked(c)}
                aria-label={`${dayLabel(c.date)}: ${fmt(c.n)} messages`}
              />
            ) : (
              <b key={i} />
            ),
          )}
        </div>
      </div>
      <p className="st-bars-readout">
        {picked ? (
          <>
            <b>{dayLabel(picked.date)}</b> · {fmt(picked.n)} messages
            {avg && picked.n ? <small> ({picked.n >= avg ? `${(picked.n / avg).toFixed(1)}× your average day` : `${Math.round((picked.n / avg) * 100)}% of your average day`})</small> : null}
          </>
        ) : (
          <>
            <b>{fmt(active.length)}</b> active days in this range · about <b>{fmt(avg)}</b> messages on an active day. Tap a day for details.
          </>
        )}
      </p>
    </div>
  );
}

// ---------- Social ----------
type CirclePerson = MemberStats["circle"][number];

function PersonDetail({ p, onClose }: { p: CirclePerson; onClose: () => void }) {
  const parts = [
    { label: "Back-and-forths", value: p.conversations },
    { label: "Replies", value: p.replies },
    { label: "Mentions", value: p.mentions },
    { label: "Reactions", value: p.reactions },
  ];
  const max = Math.max(1, ...parts.map((x) => x.value));
  return (
    <div className="st-person">
      <header>
        <Avatar src={p.avatar} name={p.name} size={48} />
        <div>
          <b>{p.name}</b>
          <small>
            {p.inServer ? "In the server" : "Left the server"} · friendship score {fmt(p.score)}
          </small>
        </div>
        <button type="button" className="st-x" onClick={onClose} aria-label="Close">
          <X size={15} />
        </button>
      </header>
      <ul className="st-rank-list">
        {parts.map((x) => (
          <li key={x.label}>
            <span className="st-rank-name">{x.label}</span>
            <span className="st-rank-bar st-rank-bar--rose">
              <i style={{ "--w": `${(x.value / max) * 100}%` } as CSSProperties} />
            </span>
            <span className="st-rank-val">{fmt(x.value)}</span>
          </li>
        ))}
      </ul>
      {p.voiceSeconds ? (
        <p className="st-fav">
          <Headphones size={15} aria-hidden="true" /> <b>{duration(p.voiceSeconds)}</b> in voice together
        </p>
      ) : null}
    </div>
  );
}

// ---------- The page ----------
export function StatsView({ onBack }: { onBack: () => void }) {
  const [stats, setStats] = useState<MemberStats | null>(null);
  const [badges, setBadges] = useState<EarnedBadge[]>([]);
  const [showcase, setShowcase] = useState<BadgeShowcase>({ pinned: [], title: null });
  const [history, setHistory] = useState<BadgeHistory>({ earned: {}, events: [] });
  const [openPerson, setOpenPerson] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [whenView, setWhenView] = useState<"hours" | "days" | "heat">("hours");
  const [person, setPerson] = useState<CirclePerson | null>(null);
  const [channel, setChannel] = useState<string | null>(null);
  const [emoji, setEmoji] = useState<string | null>(null);
  const tabsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    let first = true;
    const load = async () => {
      try {
        const res = await fetch(`/api/account/stats${first ? "?open=1" : ""}`, { cache: "no-store" });
        first = false;
        const body = await res.json();
        if (!alive) return;
        if (res.ok && body.ok) {
          setStats(body.stats);
          setBadges(body.badges ?? []);
          if (body.showcase) setShowcase(body.showcase);
          if (body.history) setHistory(body.history);
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

  const go = (t: Tab) => {
    setTab(t);
    requestAnimationFrame(() => {
      const el = tabsRef.current;
      if (el && el.getBoundingClientRect().top < 80) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 90, behavior: "smooth" });
    });
  };

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
  const hours = s.when.hours;
  const totalHours = hours.reduce((a, b) => a + b, 0);
  const peakHour = hours.indexOf(Math.max(...hours));
  const peakDay = s.when.weekdays.indexOf(Math.max(...s.when.weekdays));
  const bestie = s.circle[0] ?? null;
  const favoriteVc = s.voice.channels[0] ?? null;
  const g = s.economy.gambling;
  const topPct = (rank: number, of: number) => (of ? Math.max(1, Math.round((rank / of) * 100)) : 100);
  const joinedDays = s.profile.joinedServer ? Math.floor((Date.now() - Date.parse(s.profile.joinedServer)) / 86400000) : null;
  const earnedBadges = badges.filter((b) => b.tier > 0);
  const soc = s.social;

  const highlights: { icon: LucideIcon; text: ReactNode; tab: Tab }[] = [
    { icon: Trophy, text: <>You&apos;re in the <b>top {topPct(m.rank, m.of)}%</b> of members for messages</>, tab: "activity" },
    ...(bestie ? [{ icon: Heart, text: <>Your server bestie is <b>{bestie.name}</b></>, tab: "social" as Tab }] : []),
    ...(s.channels[0] ? [{ icon: Hash, text: <><b>{pct(s.channels[0].share)}</b> of your messages are in <b>#{s.channels[0].name}</b></>, tab: "activity" as Tab }] : []),
    ...(totalHours ? [{ icon: Clock, text: <>You&apos;re most active around <b>{hourLabel(peakHour)}</b> on <b>{FULL_DAYS[peakDay]}s</b></>, tab: "activity" as Tab }] : []),
    ...(m.longestStreak ? [{ icon: Flame, text: <>Your longest chat streak is <b>{fmt(m.longestStreak)} days</b></>, tab: "activity" as Tab }] : []),
    ...(favoriteVc ? [{ icon: Headphones, text: <>You spend the most voice time in <b>{favoriteVc.name}</b></>, tab: "voice" as Tab }] : []),
    ...(s.emojis.top[0] ? [{ icon: Smile, text: <>Your favorite emoji is <Emoji e={s.emojis.top[0]} /></>, tab: "social" as Tab }] : []),
    ...(joinedDays !== null ? [{ icon: CalendarDays, text: <>You&apos;ve been in the kingdom for <b>{fmt(joinedDays)} days</b></>, tab: "badges" as Tab }] : []),
    ...(s.activity.pagesWritten ? [{ icon: MessageCircle, text: <>You&apos;ve written about <b>{fmt(s.activity.pagesWritten)} pages</b> of chat (~{duration(s.activity.typingMinutes * 60)} of typing)</>, tab: "activity" as Tab }] : []),
    ...(s.social.mutual ? [{ icon: Users, text: <><b>{fmt(s.social.mutual)}</b> mutual friendships, and you started <b>{fmt(s.social.starts)}</b> conversations</>, tab: "social" as Tab }] : []),
    ...(s.compare && s.voice.totalSeconds ? [{ icon: Headphones, text: <>You&apos;ve spent <b>{(s.voice.totalSeconds / Math.max(1, s.compare.voiceSeconds)).toFixed(1)}×</b> the average member&apos;s time in voice</>, tab: "voice" as Tab }] : []),
  ];

  const compareRows = s.compare
    ? [
        { label: "Messages", you: m.total, avg: s.compare.messages, format: compact },
        { label: "Level", you: s.level.level, avg: s.compare.level, format: (n: number) => (Math.round(n * 10) / 10).toString() },
        { label: "Leaves", you: s.economy.balance, avg: s.compare.balance, format: compact },
        { label: "Voice time", you: s.voice.totalSeconds, avg: s.compare.voiceSeconds, format: duration },
      ]
    : [];

  const pickedChannel = s.channels.find((c) => c.id === channel) ?? null;
  const pickedEmoji = s.emojis.top.find((e) => e.key === emoji) ?? null;

  return (
    <div className="st-page">
      {top}
      <LevelHero
        s={s}
      />

      <div className="st-tabs" role="tablist" aria-label="Stats sections" ref={tabsRef}>
        {TABS.map(({ key, label, icon: Icon }) => (
          <button key={key} type="button" role="tab" aria-selected={tab === key} className={tab === key ? "is-on" : undefined} onClick={() => go(key)}>
            <Icon size={15} aria-hidden="true" /> {label}
          </button>
        ))}
      </div>

      {tab === "overview" ? (
        <div className="st-tab" key="overview">
          <div className="st-tiles">
            <Tile icon={<MessageCircle size={18} />} label="Messages" value={<Count value={m.total} format={compact} />} sub={`#${fmt(m.rank)} of ${fmt(m.of)}`} spark={s.trends.spark} onClick={() => go("activity")} />
            <Tile icon={<LeafEmote size={18} />} label="Leaves" value={<Count value={s.economy.balance} format={compact} />} sub={`#${fmt(s.economy.rank)} richest`} tone="gold" onClick={() => go("economy")} />
            <Tile icon={<Headphones size={18} />} label="Voice time" value={duration(s.voice.totalSeconds)} sub={`${duration(s.voice.monthSeconds)} this month`} tone="blue" onClick={() => go("voice")} />
            <Tile icon={<Flame size={18} />} label="Chat streak" value={<Count value={m.currentStreak} />} sub={`best ${fmt(m.longestStreak)} days`} tone="ember" onClick={() => go("activity")} />
            <Tile icon={<Users size={18} />} label="People you talk to" value={<Count value={s.records.people} />} sub={bestie ? `bestie: ${bestie.name}` : "—"} tone="rose" onClick={() => go("social")} />
            <Tile icon={<Award size={18} />} label="Badges" value={`${earnedBadges.length}/${badges.length}`} sub="tap to see them" tone="green" onClick={() => go("badges")} />
          </div>

          <div className="st-grid">
            <Card title="Highlights" icon={<Sparkles size={17} />}>
              <ul className="st-highlights">
                {highlights.map((h, i) => (
                  <li key={i}>
                    <button type="button" onClick={() => go(h.tab)}>
                      <h.icon size={16} aria-hidden="true" /> <span>{h.text}</span>
                      <ArrowUpRight size={14} aria-hidden="true" className="st-go" />
                    </button>
                  </li>
                ))}
              </ul>
            </Card>

            <Card title="Trends" icon={<TrendingUp size={17} />} className="st-trend-card">
              <TrendsCard calendar={s.calendar} />
            </Card>

            {compareRows.length ? (
              <Card title="You vs the average member" icon={<Users size={17} />} className="st-wide">
                <ul className="st-compare">
                  {compareRows.map((r) => {
                    const max = Math.max(1, r.you, r.avg);
                    return (
                      <li key={r.label}>
                        <span className="st-compare-label">{r.label}</span>
                        <span className="st-compare-bars">
                          <i className="is-you" style={{ "--w": `${(r.you / max) * 100}%` } as CSSProperties}>
                            <b>You · {r.format(r.you)}</b>
                          </i>
                          <i style={{ "--w": `${(r.avg / max) * 100}%` } as CSSProperties}>
                            <b>Average · {r.format(r.avg)}</b>
                          </i>
                        </span>
                        <em className={r.you >= r.avg ? "st-up" : "st-down"}>{r.avg ? `${(r.you / r.avg).toFixed(1)}×` : "—"}</em>
                      </li>
                    );
                  })}
                </ul>
              </Card>
            ) : null}

            <Card title="Account" icon={<UserRound size={17} />}>
              <dl className="st-dl">
                <div><dt>Joined the server</dt><dd>{dateLabel(s.profile.joinedServer)}</dd></div>
                <div><dt>Discord account made</dt><dd>{dateLabel(s.profile.discordCreated)}</dd></div>
                {s.profile.boostingSince ? <div><dt>Boosting since</dt><dd>{dateLabel(s.profile.boostingSince)}</dd></div> : null}
                <div><dt>Days in the kingdom</dt><dd>{joinedDays !== null ? fmt(joinedDays) : "—"}</dd></div>
                <div><dt>Last message</dt><dd>{since(m.last)}</dd></div>
                <div>
                  <dt>Busiest month</dt>
                  <dd>
                    {s.records.busiestMonth
                      ? `${new Date(`${s.records.busiestMonth.month}-15T12:00:00`).toLocaleDateString([], { month: "short", year: "numeric" })} (${compact(s.records.busiestMonth.n)})`
                      : "—"}
                  </dd>
                </div>
              </dl>
              {s.profile.isStaff ? (
                <p className="st-fav">
                  <Users size={15} aria-hidden="true" /> Part of the staff team
                </p>
              ) : null}
            </Card>

            <Card title="Boosts" icon={<Zap size={17} />}>
              <div className="st-mults">
                <div><span>XP</span><strong>{s.multipliers.xp.toFixed(2)}×</strong></div>
                <div><span>Leaves</span><strong>{s.multipliers.leaves.toFixed(2)}×</strong></div>
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
          </div>
        </div>
      ) : null}

      {tab === "social" ? (
        <div className="st-tab" key="social">
          <div className="st-tiles st-tiles--4">
            <Tile icon={<Users size={18} />} label="People you talk to" value={<Count value={soc.count} />} sub={`${fmt(soc.mutual)} mutual`} tone="rose" />
            <Tile icon={<ArrowUpRight size={18} />} label="You reach out" value={<Count value={soc.youReach} />} sub={`${fmt(soc.theyReach)} reach out to you`} tone="ember" />
            <Tile icon={<Snowflake size={18} />} label="Conversations started" value={<Count value={soc.starts} />} sub="after a quiet spell" tone="blue" />
            <Tile icon={<Timer size={18} />} label="Reply speed" value={soc.avgReplySeconds !== null ? duration(soc.avgReplySeconds) : "—"} sub="average time to reply" tone="green" />
            <Tile icon={<Reply size={18} />} label="Replies back" value={soc.replyRatio !== null ? `${soc.replyRatio.toFixed(2)}×` : "—"} sub="replies you get per reply you send" tone="rose" />
            <Tile icon={<AtSign size={18} />} label="Mentions" value={<Count value={s.records.mentionsReceived} />} sub={`${fmt(s.records.mentionsSent)} sent`} tone="blue" />
            <Tile icon={<Heart size={18} />} label="Reactions" value={<Count value={s.emojis.reactionsReceived} format={compact} />} sub={`${compact(s.emojis.reactionsGiven)} given`} tone="rose" />
            <Tile icon={<PieChart size={18} />} label="Inner circle" value={pct(soc.topThreeShare)} sub="of your social time is with your top 3" tone="gold" />
          </div>

          <div className="st-grid">
            <Card
              title="Your friendship map"
              icon={<Network size={17} />}
              className="st-wide"
              aside={<span className="st-chip">{fmt(soc.everyone.filter((p) => p.inServer && p.score > 0).length)} people still in the server</span>}
            >
              {soc.everyone.length ? (
                <FriendshipMap
                  me={{ name: "You", avatar: s.profile.avatar }}
                  people={soc.everyone}
                  color={s.level.color?.[0] ?? "#f59b2a"}
                  picked={openPerson}
                  onPick={(id) => {
                    setOpenPerson(id);
                    requestAnimationFrame(() => document.getElementById("st-people")?.scrollIntoView({ behavior: "smooth", block: "start" }));
                  }}
                />
              ) : (
                <p className="st-empty">Chat, reply and hang out in VC and your friendship map will fill in.</p>
              )}
            </Card>

            <Card title="Who's who" icon={<Crown size={17} />} className="st-wide">
              <div className="st-leaders">
                {(
                  [
                    ["conversations", "Most back-and-forths", MessagesSquare, (n: number) => `${fmt(n)} chats`],
                    ["repliesFrom", "Replies to you most", Reply, (n: number) => `${fmt(n)} replies`],
                    ["repliesTo", "You reply to most", CornerDownRight, (n: number) => `${fmt(n)} replies`],
                    ["mentionsFrom", "Mentions you most", AtSign, (n: number) => `${fmt(n)} mentions`],
                    ["mentionsTo", "You mention most", AtSign, (n: number) => `${fmt(n)} mentions`],
                    ["reactedBy", "Your biggest fan", Heart, (n: number) => `${fmt(n)} reactions`],
                    ["reactedTo", "You react to most", Sparkles, (n: number) => `${fmt(n)} reactions`],
                    ["voice", "VC buddy", Headphones, (n: number) => duration(n)],
                  ] as const
                ).map(([key, label, Icon, f], i) => {
                  const p = soc.leaders[key];
                  return (
                    <button
                      key={key}
                      type="button"
                      className="st-leader"
                      style={{ "--d": `${i * 50}ms` } as CSSProperties}
                      disabled={!p}
                      onClick={() => {
                        if (!p) return;
                        setOpenPerson(p.id);
                        requestAnimationFrame(() => document.getElementById("st-people")?.scrollIntoView({ behavior: "smooth", block: "start" }));
                      }}
                    >
                      <span className="st-leader-label">
                        <Icon size={13} aria-hidden="true" /> {label}
                      </span>
                      {p ? (
                        <span className="st-leader-who">
                          <Avatar src={p.avatar} name={p.name} size={34} />
                          <span>
                            <b>{p.name}</b>
                            <small>{f(p.n)}</small>
                          </span>
                        </span>
                      ) : (
                        <span className="st-empty">Nobody yet</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </Card>

            <Card title="Everyone you talk to" icon={<Users size={17} />} className="st-wide st-anchor" aside={<span className="adm-muted">{fmt(soc.count)} people</span>}>
              <div id="st-people" />
              {soc.everyone.length ? (
                <PeopleExplorer people={soc.everyone} openId={openPerson} onOpen={setOpenPerson} />
              ) : (
                <p className="st-empty">Nobody yet. Say hi in the server!</p>
              )}
            </Card>

            <Card title="Server bestie" icon={<Heart size={17} />} className="st-bestie">
              {bestie ? (
                <>
                  <button type="button" className="st-bestie-main" onClick={() => setPerson(person?.id === bestie.id ? null : bestie)}>
                    <Avatar src={bestie.avatar} name={bestie.name} size={76} />
                    <div>
                      <strong>{bestie.name}</strong>
                      <p>
                        {[
                          bestie.conversations ? `${fmt(bestie.conversations)} back-and-forths` : null,
                          bestie.replies ? `${fmt(bestie.replies)} replies` : null,
                          bestie.voiceSeconds ? `${duration(bestie.voiceSeconds)} in VC together` : null,
                        ]
                          .filter(Boolean)
                          .join(" · ") || "You two talk the most"}
                      </p>
                      <small>Tap for the full breakdown</small>
                    </div>
                  </button>
                  {person ? <PersonDetail p={person} onClose={() => setPerson(null)} /> : null}
                </>
              ) : (
                <p className="st-empty">Chat, reply and hang out in VC and your bestie will show up here.</p>
              )}
            </Card>

            <Card title="Reactions" icon={<Sparkles size={17} />}>
              <p className="st-note">People react to you with</p>
              <div className="st-emoji-row">
                {s.emojis.topReceived.length ? s.emojis.topReceived.map((e) => <span key={e.key} className="st-emoji-chip"><Emoji e={e} /> <small>{compact(e.count)}</small></span>) : <span className="st-empty">Nothing yet</span>}
              </div>
              <p className="st-note">You react with</p>
              <div className="st-emoji-row">
                {s.emojis.topGiven.length ? s.emojis.topGiven.map((e) => <span key={e.key} className="st-emoji-chip"><Emoji e={e} /> <small>{compact(e.count)}</small></span>) : <span className="st-empty">Nothing yet</span>}
              </div>
            </Card>

            <Card title="Favorite emojis" icon={<Smile size={17} />} className="st-wide">
              {s.emojis.top.length ? (
                <>
                  <div className="st-emoji-row st-emoji-row--big">
                    {s.emojis.top.map((e) => (
                      <button key={e.key} type="button" className={`st-emoji-chip${emoji === e.key ? " is-on" : ""}`} onClick={() => setEmoji(emoji === e.key ? null : e.key)}>
                        <Emoji e={e} /> <small>{compact(e.count)}</small>
                      </button>
                    ))}
                  </div>
                  <p className="st-bars-readout">
                    {pickedEmoji ? (
                      <>
                        <Emoji e={pickedEmoji} /> used <b>{fmt(pickedEmoji.count)}</b> times · {pct(pickedEmoji.count / Math.max(1, m.emojis))} of all your emojis
                      </>
                    ) : (
                      <>Tap an emoji for details · {fmt(m.emojis)} emojis used in total</>
                    )}
                  </p>
                </>
              ) : (
                <p className="st-empty">No emojis counted yet.</p>
              )}
            </Card>
          </div>
        </div>
      ) : null}

      {tab === "activity" ? (
        <div className="st-grid st-tab" key="activity">
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
            {whenView === "hours" ? (
              <Bars values={hours} labels={hours.map((_, h) => hourLabel(h))} format={(n) => `${fmt(n)} messages`} />
            ) : whenView === "days" ? (
              <Bars values={s.when.weekdays} labels={DAYS} format={(n) => `${fmt(n)} messages`} />
            ) : (
              <Heatmap heat={s.when.heat} />
            )}
            <p className="st-note">Times are in your time zone.</p>
          </Card>

          <Card title="Messages by month" icon={<BarChart3 size={17} />} className="st-wide">
            <Bars
              values={s.activity.months.map((mo) => mo.n)}
              labels={s.activity.months.map((mo) => new Date(`${mo.month}-15T12:00:00`).toLocaleDateString([], { month: "short" }))}
              format={(n) => `${fmt(n)} messages`}
            />
          </Card>

          <Card title="Your day" icon={<Sun size={17} />}>
            {(() => {
              const parts = [
                { key: "morning", label: "Morning", sub: "6 AM – noon", icon: Sunrise, color: "#facc15", n: s.activity.parts.morning },
                { key: "afternoon", label: "Afternoon", sub: "noon – 6 PM", icon: Sun, color: "#f59b2a", n: s.activity.parts.afternoon },
                { key: "evening", label: "Evening", sub: "6 PM – midnight", icon: Sunset, color: "#ec4899", n: s.activity.parts.evening },
                { key: "night", label: "Night", sub: "midnight – 6 AM", icon: Moon, color: "#6366f1", n: s.activity.parts.night },
              ];
              const total = parts.reduce((acc, p) => acc + p.n, 0) || 1;
              return (
                <>
                  <div className="st-stack" aria-hidden="true">
                    {parts.map((p) => (
                      <i key={p.key} style={{ "--w": `${(p.n / total) * 100}%`, background: p.color } as CSSProperties} />
                    ))}
                  </div>
                  <ul className="st-parts">
                    {parts.map((p) => (
                      <li key={p.key}>
                        <span className="st-parts-icon" style={{ color: p.color }}>
                          <p.icon size={16} />
                        </span>
                        <span>
                          <b>{p.label}</b>
                          <small>{p.sub}</small>
                        </span>
                        <strong>{pct(p.n / total)}</strong>
                      </li>
                    ))}
                  </ul>
                </>
              );
            })()}
          </Card>

          <Card title="Weekdays vs weekends" icon={<CalendarRange size={17} />}>
            <div className="st-split">
              <div style={{ "--w": `${(1 - s.activity.weekendShare) * 100}%` } as CSSProperties}>
                <span>Weekdays</span>
                <strong>{pct(1 - s.activity.weekendShare)}</strong>
              </div>
              <div className="is-weekend" style={{ "--w": `${s.activity.weekendShare * 100}%` } as CSSProperties}>
                <span>Weekends</span>
                <strong>{pct(s.activity.weekendShare)}</strong>
              </div>
            </div>
            <p className="st-note">
              Weekends are 29% of the week, so {s.activity.weekendShare > 0.33 ? "you're more of a weekend chatter" : s.activity.weekendShare < 0.25 ? "you mostly chat on weekdays" : "you chat pretty evenly all week"}.
            </p>
            <p className="st-note">What you send</p>
            {(() => {
              const mix = [
                { label: "Images", n: m.images, color: "#14b8a6" },
                { label: "GIFs", n: m.gifs, color: "#a855f7" },
                { label: "Videos", n: m.videos, color: "#ef4444" },
                { label: "Links", n: m.links, color: "#0ea5e9" },
                { label: "Stickers", n: m.stickers, color: "#fb923c" },
                { label: "Voice notes", n: m.audio, color: "#22c55e" },
              ].filter((x) => x.n > 0);
              const all = mix.reduce((acc, x) => acc + x.n, 0);
              return all ? (
                <>
                  <div className="st-stack" aria-hidden="true">
                    {mix.map((x) => (
                      <i key={x.label} style={{ "--w": `${(x.n / all) * 100}%`, background: x.color } as CSSProperties} title={`${x.label}: ${fmt(x.n)}`} />
                    ))}
                  </div>
                  <div className="st-mix-legend">
                    {mix.map((x) => (
                      <span key={x.label}>
                        <i style={{ background: x.color }} /> {x.label} <b>{fmt(x.n)}</b>
                      </span>
                    ))}
                  </div>
                </>
              ) : (
                <p className="st-empty">No media yet.</p>
              );
            })()}
          </Card>

          <Card title="By the numbers" icon={<Hash size={17} />} className="st-wide">
            <dl className="st-dl st-dl--4">
              <div><dt>Per active day</dt><dd>{s.activity.perActiveDay} <small>msgs</small></dd></div>
              <div><dt>Per day in the server</dt><dd>{s.activity.perDayInServer ?? "—"} <small>msgs</small></dd></div>
              <div><dt>Days you show up</dt><dd>{s.activity.activeShare !== null ? pct(s.activity.activeShare) : "—"}</dd></div>
              <div><dt>Days in the server</dt><dd>{s.activity.daysInServer !== null ? fmt(s.activity.daysInServer) : "—"}</dd></div>
              <div><dt>Longest break</dt><dd>{fmt(s.activity.longestGap)} <small>days</small></dd></div>
              <div><dt>Since last message</dt><dd>{s.activity.daysSinceLast === null ? "—" : s.activity.daysSinceLast === 0 ? "today" : `${fmt(s.activity.daysSinceLast)} days`}</dd></div>
              <div><dt>Busiest day</dt><dd>{m.busiestDay ? `${fmt(m.busiestDay.n)}` : "—"} <small>{m.busiestDay ? dayLabel(m.busiestDay.date, { month: "short", day: "numeric", year: "numeric" }) : ""}</small></dd></div>
              <div><dt>Quietest active day</dt><dd>{s.activity.quietestDay ? fmt(s.activity.quietestDay.n) : "—"} <small>{s.activity.quietestDay ? dayLabel(s.activity.quietestDay.date, { month: "short", day: "numeric" }) : ""}</small></dd></div>
              <div><dt>Channels used</dt><dd>{fmt(s.activity.channelsUsed)}</dd></div>
              <div><dt>Characters / msg</dt><dd>{fmt(s.activity.charsPerMessage)}</dd></div>
              <div><dt>Emojis / msg</dt><dd>{s.activity.emojisPerMessage}</dd></div>
              <div><dt>Messages with media</dt><dd>{pct(s.activity.mediaShare)}</dd></div>
              <div><dt>Pages written</dt><dd>{fmt(s.activity.pagesWritten)} <small>(300 words each)</small></dd></div>
              <div><dt>Time spent typing</dt><dd>~{duration(s.activity.typingMinutes * 60)}</dd></div>
              <div><dt>Current streak</dt><dd>{fmt(m.currentStreak)} <small>days</small></dd></div>
              <div><dt>Longest streak</dt><dd>{fmt(m.longestStreak)} <small>days</small></dd></div>
            </dl>
          </Card>

          <Card title="Activity calendar" icon={<CalendarDays size={17} />} className="st-wide">
            <Calendar days={s.calendar} />
          </Card>

          <Card title="Where you chat" icon={<Hash size={17} />}>
            {s.channels.length ? (
              <>
                <ul className="st-rank-list st-rank-list--click">
                  {s.channels.map((c) => (
                    <li key={c.id}>
                      <button type="button" className={channel === c.id ? "is-on" : undefined} onClick={() => setChannel(channel === c.id ? null : c.id)}>
                        <span className="st-rank-name">#{c.name}</span>
                        <span className="st-rank-bar">
                          <i style={{ "--w": `${(c.n / s.channels[0].n) * 100}%` } as CSSProperties} />
                        </span>
                        <span className="st-rank-val">
                          {compact(c.n)} <small>{pct(c.share)}</small>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
                <p className="st-bars-readout">
                  {pickedChannel ? (
                    <>
                      <b>#{pickedChannel.name}</b> · your #{s.channels.indexOf(pickedChannel) + 1} channel · {fmt(pickedChannel.n)} messages ({pct(pickedChannel.share)} of everything you send)
                    </>
                  ) : (
                    "Tap a channel for details."
                  )}
                </p>
              </>
            ) : (
              <p className="st-empty">Send a few messages and your favorite channels will show up here.</p>
            )}
          </Card>

          <Card title="How you chat" icon={<MessageCircle size={17} />}>
            <dl className="st-dl st-dl--3">
              <div><dt>Words</dt><dd>{compact(m.words)}</dd></div>
              <div><dt>Words / msg</dt><dd>{m.avgWords}</dd></div>
              <div><dt>Longest msg</dt><dd>{fmt(s.records.longestMessage)} <small>chars</small></dd></div>
              <div><dt>Questions</dt><dd>{fmt(s.records.questions)}</dd></div>
              <div><dt><ImageIcon size={13} aria-hidden="true" /> Images</dt><dd>{fmt(m.images)}</dd></div>
              <div><dt>Videos</dt><dd>{fmt(m.videos)}</dd></div>
              <div><dt>GIFs</dt><dd>{fmt(m.gifs)}</dd></div>
              <div><dt>Links</dt><dd>{fmt(m.links)}</dd></div>
              <div><dt>Stickers</dt><dd>{fmt(m.stickers)}</dd></div>
              <div><dt>Voice notes</dt><dd>{fmt(m.audio)}</dd></div>
              <div><dt>Edits</dt><dd>{fmt(m.edited)}</dd></div>
              <div><dt>Characters</dt><dd>{compact(m.characters)}</dd></div>
            </dl>
          </Card>

          {s.records.commands.length ? (
            <Card title="Favorite bot commands" icon={<Terminal size={17} />}>
              <ul className="st-rank-list">
                {s.records.commands.map((c) => (
                  <li key={c.name}>
                    <span className="st-rank-name">/{c.name}</span>
                    <span className="st-rank-bar">
                      <i style={{ "--w": `${(c.n / s.records.commands[0].n) * 100}%` } as CSSProperties} />
                    </span>
                    <span className="st-rank-val">{fmt(c.n)}</span>
                  </li>
                ))}
              </ul>
              <p className="st-note">{fmt(s.records.commandsUsed)} commands used in total</p>
            </Card>
          ) : null}
        </div>
      ) : null}

      {tab === "topics" ? (
        <div className="st-tab" key="topics">
          <Card title="Your topic map" icon={<Shapes size={17} />} aside={s.topics.total ? <span className="adm-muted">{fmt(s.topics.total)} topic mentions</span> : null}>
            <TopicMap topics={s.topics} />
          </Card>
        </div>
      ) : null}

      {tab === "voice" ? (
        <div className="st-tab" key="voice">
          <div className="st-tiles">
            <Tile icon={<Headphones size={18} />} label="All time" value={duration(s.voice.totalSeconds)} sub={s.compare ? `average member: ${duration(s.compare.voiceSeconds)}` : undefined} tone="blue" />
            <Tile icon={<CalendarDays size={18} />} label="This month" value={duration(s.voice.monthSeconds)} tone="blue" />
            <Tile icon={<Timer size={18} />} label="Longest session" value={duration(s.voice.longestSession)} sub={`${fmt(s.voice.sessions || s.voice.joins)} sessions`} tone="blue" />
            <Tile icon={<Users size={18} />} label="With others" value={s.voice.trackedSeconds ? pct(s.voice.withOthersSeconds / s.voice.trackedSeconds) : "—"} sub="of your VC time" tone="rose" />
            <Tile icon={<MonitorUp size={18} />} label="Streaming" value={duration(s.voice.streamSeconds)} tone="green" />
            <Tile icon={<Camera size={18} />} label="Camera on" value={duration(s.voice.cameraSeconds)} tone="green" />
            <Tile icon={<VolumeX size={18} />} label="Muted" value={s.voice.trackedSeconds && s.voice.mutedSeconds ? pct(Math.min(1, s.voice.mutedSeconds / Math.max(s.voice.trackedSeconds, s.voice.totalSeconds))) : "—"} sub="of your VC time, self-muted" tone="rose" />
            <Tile icon={<Coins size={18} />} label="Earned in VC" value={s.voice.rewards ? compact(s.voice.rewards.leaves) : "—"} sub={s.voice.rewards ? `leaves · ${compact(s.voice.rewards.xp)} XP` : undefined} tone="gold" />
            <Tile icon={<Users size={18} />} label="Sessions with others" value={s.voice.rewards ? fmt(s.voice.rewards.withOthers) : "—"} sub={s.voice.rewards ? `${fmt(s.voice.rewards.solo)} solo` : undefined} tone="blue" />
          </div>
          <div className="st-grid">
            <Card title="Favorite voice channels" icon={<Mic size={17} />}>
              {s.voice.channels.length ? (
                <ul className="st-rank-list">
                  {s.voice.channels.map((c) => (
                    <li key={c.id}>
                      <span className="st-rank-name">{c.name}</span>
                      <span className="st-rank-bar st-rank-bar--blue">
                        <i style={{ "--w": `${(c.seconds / s.voice.channels[0].seconds) * 100}%` } as CSSProperties} />
                      </span>
                      <span className="st-rank-val">{duration(c.seconds)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="st-empty">Hop in a voice channel and it&apos;ll show up here.</p>
              )}
            </Card>
            <Card title="VC buddies" icon={<Users size={17} />}>
              {s.voice.buddies.length ? (
                <ul className="st-people">
                  {s.voice.buddies.map((b) => (
                    <li key={b.id}>
                      <Avatar src={b.avatar} name={b.name} size={30} />
                      <span>
                        {b.name}
                        {s.voice.buddySessions[b.id] ? <small className="st-sub"> · {fmt(s.voice.buddySessions[b.id])} sessions</small> : null}
                      </span>
                      <small>{duration(b.seconds)}</small>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="st-empty">Nobody yet. Invite someone to VC!</p>
              )}
            </Card>
            <Card title="When you join voice" icon={<Clock size={17} />} className="st-wide">
              {s.voice.byHour.some(Boolean) ? (
                <Bars values={s.voice.byHour} labels={s.voice.byHour.map((_, h) => hourLabel(h))} format={(n) => `${fmt(n)} joins`} />
              ) : (
                <p className="st-empty">Your voice habits show up here after a few sessions.</p>
              )}
              {s.voice.historySince ? (
                <p className="st-note">Voice history comes from the VC logs (since {dateLabel(s.voice.historySince)}) and the VC reward messages.</p>
              ) : null}
            </Card>
          </div>
        </div>
      ) : null}

      {tab === "economy" ? (
        <div className="st-grid st-tab" key="economy">
          <Card title="Leaves" icon={<LeafEmote size={17} />}>
            <div className="st-trends">
              <div>
                <span>Balance</span>
                <strong><Count value={s.economy.balance} /></strong>
                <em>#{fmt(s.economy.rank)} of {fmt(s.economy.of)}</em>
              </div>
              <div>
                <span>Spent in the store</span>
                <strong>{compact(s.economy.spent)}</strong>
                <em>{fmt(s.economy.purchases)} purchases</em>
              </div>
            </div>
            <dl className="st-dl">
              <div><dt>Daily streak</dt><dd>{fmt(s.economy.dailyStreak)} days</dd></div>
              <div><dt>Items owned</dt><dd>{fmt(s.economy.items)}</dd></div>
              <div><dt>Server bumps</dt><dd>{fmt(s.economy.bumps)} <small>({fmt(s.economy.monthlyBumps)} this month)</small></dd></div>
              <div><dt>QOTD answers</dt><dd>{fmt(s.economy.qotdAnswers)}</dd></div>
            </dl>
          </Card>

          <Card title="Store" icon={<ShoppingBag size={17} />}>
            {s.store.topItems.length ? (
              <ul className="st-rank-list">
                {s.store.topItems.map((it) => (
                  <li key={it.name}>
                    <span className="st-rank-name">{it.name}</span>
                    <span className="st-rank-bar">
                      <i style={{ "--w": `${(it.n / s.store.topItems[0].n) * 100}%` } as CSSProperties} />
                    </span>
                    <span className="st-rank-val">×{fmt(it.n)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="st-empty">You haven&apos;t bought anything yet.</p>
            )}
            {s.store.lastPurchase ? (
              <p className="st-fav">
                <ShoppingBag size={15} aria-hidden="true" /> Last buy: <b>{s.store.lastPurchase.name}</b> · {since(s.store.lastPurchase.at)}
              </p>
            ) : null}
          </Card>

          <Card title="Gifts" icon={<Gift size={17} />}>
            <div className="st-trends">
              <div><span>Sent</span><strong>{fmt(s.economy.giftsSent)}</strong></div>
              <div><span>Received</span><strong>{fmt(s.economy.giftsReceived)}</strong></div>
            </div>
            {s.store.giftsMostTo ? (
              <p className="st-fav">
                <Avatar src={s.store.giftsMostTo.avatar} name={s.store.giftsMostTo.name} size={22} /> You gift <b>{s.store.giftsMostTo.name}</b> the most ({fmt(s.store.giftsMostTo.n)})
              </p>
            ) : null}
            {s.store.giftsMostFrom ? (
              <p className="st-fav">
                <Avatar src={s.store.giftsMostFrom.avatar} name={s.store.giftsMostFrom.name} size={22} /> <b>{s.store.giftsMostFrom.name}</b> gifts you the most ({fmt(s.store.giftsMostFrom.n)})
              </p>
            ) : null}
            {!s.store.giftsMostTo && !s.store.giftsMostFrom ? <p className="st-empty">Send a gift from the store to someone special.</p> : null}
          </Card>

          {g ? (
            <Card title="Slots" icon={<Dices size={17} />}>
              <dl className="st-dl">
                <div><dt>Spins</dt><dd>{fmt(g.spins)}</dd></div>
                <div><dt>Net</dt><dd className={g.net >= 0 ? "st-up" : "st-down"}>{g.net >= 0 ? "+" : ""}{compact(g.net)}</dd></div>
                <div><dt>Biggest win</dt><dd>{compact(g.biggestWin)}</dd></div>
                <div><dt>Return</dt><dd>{g.spent ? pct(g.won / g.spent) : "—"}</dd></div>
              </dl>
              {s.games.recent.length ? (
                <>
                  <p className="st-note">Recent spins</p>
                  <ul className="st-spins">
                    {s.games.recent.map((r, i) => (
                      <li key={i} className={r.net > 0 ? "is-win" : r.net < 0 ? "is-loss" : undefined} title={r.at ? new Date(r.at).toLocaleString() : undefined}>
                        <span>{r.symbols ?? r.game}</span>
                        <b>
                          {r.net > 0 ? "+" : ""}
                          {compact(r.net)}
                        </b>
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
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
        </div>
      ) : null}

      {tab === "badges" ? (
        <div className="st-tab" key="badges">
          <Card title="Badges" icon={<Award size={17} />}>
            <BadgeCollection badges={badges} showcase={showcase} history={history} onSaved={setShowcase} />
          </Card>
        </div>
      ) : null}

      <p className="st-footnote">
        Levels, leaves, total messages and voice time come straight from the bot. Channels, besties, emojis, reactions and hours are counted
        {s.countedSince ? ` since ${dateLabel(s.countedSince)}` : " from now on"}. Times are shown in your time zone.
      </p>
    </div>
  );
}
