"use client";

import "./games.css";
import { Crown, Dices, Flame, Globe, MessageCircle, Sparkles, TrendingDown, TrendingUp, Trophy } from "lucide-react";
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import type { GameLine, PersonalGames, SiteGames } from "../../lib/games/stats";
import { LeafEmote } from "../ui-icons";

const fmt = (n: number) => Math.round(n).toLocaleString();
const compact = (n: number) => {
  const a = Math.abs(n);
  const s = a >= 1e6 ? `${+(a / 1e6).toFixed(1)}M` : a >= 1e4 ? `${+(a / 1e3).toFixed(1)}K` : fmt(a);
  return n < 0 ? `-${s}` : s;
};
const signed = (n: number) => (n > 0 ? `+${compact(n)}` : compact(n));
const pct = (n: number | null) => (n === null ? "—" : `${(n * 100).toFixed(1)}%`);
const dayLabel = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString([], { month: "short", day: "numeric" });
const GAME_ICON: Record<string, string> = { slots: "🎰", blackjack: "🃏", scratchoff: "🎟️", roulette: "🎡", mines: "💣" };

function Kpi({ label, value, sub, tone, icon }: { label: string; value: ReactNode; sub?: ReactNode; tone?: "up" | "down" | "gold"; icon?: ReactNode }) {
  return (
    <div className={`gs-kpi${tone ? ` is-${tone}` : ""}`}>
      <span>
        {icon}
        {label}
      </span>
      <strong>{value}</strong>
      {sub ? <small>{sub}</small> : null}
    </div>
  );
}

/** A running total as an area chart (green above zero, red below). */
function ProfitChart({ points, labels }: { points: number[]; labels: string[] }) {
  const w = 600;
  const h = 170;
  const min = Math.min(0, ...points);
  const max = Math.max(0, ...points);
  const span = max - min || 1;
  const x = (i: number) => (points.length > 1 ? (i / (points.length - 1)) * w : w / 2);
  const y = (v: number) => h - 10 - ((v - min) / span) * (h - 20);
  const line = points.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  const zero = y(0);
  const last = points[points.length - 1] ?? 0;
  const [hover, setHover] = useState<number | null>(null);
  return (
    <div className="gs-chart">
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" onMouseLeave={() => setHover(null)}>
        <defs>
          <linearGradient id="gs-up" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#3ddc84" stopOpacity="0.45" />
            <stop offset="1" stopColor="#3ddc84" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="gs-down" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0" stopColor="#e5484d" stopOpacity="0.45" />
            <stop offset="1" stopColor="#e5484d" stopOpacity="0" />
          </linearGradient>
          <clipPath id="gs-above">
            <rect x="0" y="0" width={w} height={zero} />
          </clipPath>
          <clipPath id="gs-below">
            <rect x="0" y={zero} width={w} height={h - zero} />
          </clipPath>
        </defs>
        <line x1="0" x2={w} y1={zero} y2={zero} className="gs-zero" />
        <path d={`${line} L${w} ${zero} L0 ${zero} Z`} fill="url(#gs-up)" clipPath="url(#gs-above)" />
        <path d={`${line} L${w} ${zero} L0 ${zero} Z`} fill="url(#gs-down)" clipPath="url(#gs-below)" />
        <path d={line} fill="none" stroke={last >= 0 ? "#3ddc84" : "#e5484d"} strokeWidth="2.5" vectorEffect="non-scaling-stroke" className="gs-line" />
        {points.map((v, i) => (
          <rect key={i} x={x(i) - w / points.length / 2} y="0" width={w / points.length} height={h} fill="transparent" onMouseEnter={() => setHover(i)} />
        ))}
        {hover !== null ? <circle cx={x(hover)} cy={y(points[hover])} r="4" fill="#fff" vectorEffect="non-scaling-stroke" /> : null}
      </svg>
      <div className="gs-chart-foot">
        <span>{labels[0] ? dayLabel(labels[0]) : ""}</span>
        <b className={hover !== null ? "" : last >= 0 ? "is-up" : "is-down"}>
          {hover !== null ? `${dayLabel(labels[hover])}: ${signed(points[hover])}` : `${signed(last)} over 30 days`}
        </b>
        <span>Today</span>
      </div>
    </div>
  );
}

/** Daily bars: total height = wagered, the bright part = what the house kept (or a red dip when it paid out more). */
function DayBars({ days }: { days: SiteGames["days"] }) {
  const max = Math.max(1, ...days.map((d) => d.wagered));
  return (
    <div className="gs-bars" role="img" aria-label="Wagered per day over the last 30 days">
      {days.map((d) => (
        <span key={d.day} className="gs-bar" title={`${dayLabel(d.day)} · ${fmt(d.plays)} games by ${d.players} players · wagered ${fmt(d.wagered)} · house ${signed(d.house)}`}>
          <i style={{ "--h": `${(d.wagered / max) * 100}%` } as CSSProperties} />
          <em className={d.house < 0 ? "is-down" : ""} style={{ "--h": `${(Math.min(Math.abs(d.house), d.wagered) / max) * 100}%` } as CSSProperties} />
        </span>
      ))}
    </div>
  );
}

function HourBars({ hours }: { hours: number[] }) {
  const max = Math.max(1, ...hours);
  const label = (h: number) => (h === 0 ? "12a" : h < 12 ? `${h}a` : h === 12 ? "12p" : `${h - 12}p`);
  return (
    <div className="gs-hours">
      {hours.map((n, h) => (
        <span key={h} title={`${label(h)} · ${fmt(n)} games`}>
          <i style={{ "--h": `${(n / max) * 100}%` } as CSSProperties} />
          {h % 3 === 0 ? <small>{label(h)}</small> : null}
        </span>
      ))}
    </div>
  );
}

function GameTable({ games, total, house }: { games: GameLine[]; total: GameLine; house?: boolean }) {
  const rows = [...games, total];
  return (
    <div className="gs-table-wrap">
      <table className="gs-table">
        <thead>
          <tr>
            <th>Game</th>
            <th>Plays</th>
            <th>Wagered</th>
            <th className="gs-opt">{house ? "Paid out" : "Won back"}</th>
            <th>{house ? "House kept" : "Net"}</th>
            <th title="Return to player: share of wagers paid back">Return</th>
            <th>Win rate</th>
            <th className="gs-opt">Biggest win</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((g) => {
            const net = house ? -g.net : g.net;
            return (
              <tr key={g.game} className={g.game === "all" ? "is-total" : ""}>
                <td>
                  <span className="gs-game">
                    {g.game === "all" ? <Dices size={15} aria-hidden="true" /> : <em>{GAME_ICON[g.game] ?? "🎲"}</em>} {g.label}
                  </span>
                </td>
                <td>{fmt(g.plays)}</td>
                <td>{compact(g.wagered)}</td>
                <td className="gs-opt">{compact(g.won)}</td>
                <td className={net > 0 ? "is-up" : net < 0 ? "is-down" : ""}>{signed(net)}</td>
                <td>{pct(g.rtp)}</td>
                <td>{g.plays ? pct(g.wins / g.plays) : "—"}</td>
                <td className="gs-opt">{g.biggestWin > 0 ? `+${compact(g.biggestWin)}` : "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Section({ title, icon, children, wide }: { title: string; icon: ReactNode; children: ReactNode; wide?: boolean }) {
  return (
    <section className={`gs-card${wide ? " is-wide" : ""}`}>
      <h3>
        {icon} {title}
      </h3>
      {children}
    </section>
  );
}

// ==========================================
// My Stats → Games
// ==========================================
export function PersonalGamesStats() {
  const [s, setS] = useState<PersonalGames | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    fetch("/api/games/stats", { cache: "no-store" })
      .then((r) => r.json())
      .then((r) => (r?.ok ? setS(r.stats) : setError(r?.error ?? "Couldn't load your game stats.")))
      .catch(() => setError("Couldn't load your game stats."));
  }, []);
  if (error) return <div className="gs-empty">{error}</div>;
  if (!s) return <div className="gs-empty">Counting your chips…</div>;
  if (!s.total.plays)
    return (
      <div className="gs-empty">
        <Dices size={28} aria-hidden="true" />
        <p>You haven&apos;t played any games yet.</p>
        <a className="gs-cta" href="/games">
          Try blackjack or a scratch-off
        </a>
      </div>
    );
  const t = s.total;
  return (
    <div className="gs">
      <div className="gs-kpis">
        <Kpi label="Net" icon={t.net >= 0 ? <TrendingUp size={15} /> : <TrendingDown size={15} />} value={<>{signed(t.net)} <LeafEmote size={16} /></>} tone={t.net >= 0 ? "up" : "down"} sub={`${pct(t.rtp)} of wagers back`} />
        <Kpi label="Games played" value={fmt(t.plays)} sub={s.firstPlayed ? `since ${new Date(s.firstPlayed).toLocaleDateString()}` : undefined} />
        <Kpi label="Wagered" value={<>{compact(t.wagered)} <LeafEmote size={16} /></>} sub={`avg bet ${compact(t.avgBet)}`} />
        <Kpi label="Win rate" value={pct(t.plays ? t.wins / t.plays : null)} sub={`${fmt(t.wins)} W · ${fmt(t.losses)} L · ${fmt(t.pushes)} push`} />
        <Kpi label="Biggest win" icon={<Trophy size={15} />} value={t.biggestWin > 0 ? `+${compact(t.biggestWin)}` : "—"} tone="gold" sub={t.biggestLoss < 0 ? `worst loss ${compact(t.biggestLoss)}` : undefined} />
        <Kpi label="Best win streak" icon={<Flame size={15} />} value={fmt(s.streaks.bestWin)} sub={s.streaks.current > 0 ? `on a ${s.streaks.current}-win streak now` : s.streaks.current < 0 ? `${-s.streaks.current} losses in a row now` : undefined} />
      </div>

      <div className="gs-cards">
        <Section title="Profit, last 30 days" icon={<TrendingUp size={16} />} wide>
          <ProfitChart points={s.days.map((d) => d.cumulative)} labels={s.days.map((d) => d.day)} />
        </Section>
        <Section title="By game" icon={<Dices size={16} />} wide>
          <GameTable games={s.games} total={s.total} />
        </Section>
        <Section title="Your gambler profile" icon={<Sparkles size={16} />}>
          <dl className="gs-dl">
            <div><dt>Favorite game</dt><dd>{s.favorite ?? "—"}</dd></div>
            <div><dt>Luckiest game</dt><dd>{s.luckiest ?? "—"}</dd></div>
            <div><dt>Rank by profit</dt><dd>{s.rank.byNet ? `#${s.rank.byNet} of ${s.rank.of}` : "—"}</dd></div>
            <div><dt>Rank by wagered</dt><dd>{s.rank.byWagered ? `#${s.rank.byWagered} of ${s.rank.of}` : "—"}</dd></div>
            <div><dt>Worst losing streak</dt><dd>{fmt(s.streaks.worstLoss)}</dd></div>
            <div><dt>Played on</dt><dd className="gs-src-dd">
                <span><Globe size={13} aria-hidden="true" /> {fmt(s.sources.website)} website</span>
                <span><MessageCircle size={13} aria-hidden="true" /> {fmt(s.sources.discord)} Discord</span>
              </dd></div>
          </dl>
          <p className="gs-jackpot">
            <Crown size={15} aria-hidden="true" /> Slots jackpot: <b>{compact(s.jackpot)}</b> <LeafEmote size={14} />
          </p>
        </Section>
        <Section title="Recent games" icon={<Sparkles size={16} />}>
          <ul className="gs-recent">
            {s.recent.map((r, i) => (
              <li key={i} className={r.net > 0 ? "is-up" : r.net < 0 ? "is-down" : ""} title={r.at ? new Date(r.at).toLocaleString() : undefined}>
                <em>{GAME_ICON[r.game] ?? "🎲"}</em>
                <span>
                  <b>{r.label}</b>
                  <small>{r.detail ?? `bet ${compact(r.spent)}`}</small>
                </span>
                <strong>{r.net === 0 ? "±0" : signed(r.net)}</strong>
              </li>
            ))}
          </ul>
        </Section>
      </div>
    </div>
  );
}

// ==========================================
// Admin → Games
// ==========================================
type Period = "24h" | "7d" | "30d" | "all";
const PERIOD_LABEL: Record<Period, string> = { "24h": "24 hours", "7d": "7 days", "30d": "30 days", all: "All time" };

function PlayerList({ rows, value }: { rows: SiteGames["topWagered"]; value: (r: SiteGames["topWagered"][number]) => ReactNode }) {
  if (!rows.length) return <p className="gs-none">No one yet.</p>;
  return (
    <ol className="gs-players">
      {rows.map((r, i) => (
        <li key={r.id}>
          <span className="gs-rank">{i + 1}</span>
          {r.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={r.avatar} alt="" width={26} height={26} />
          ) : (
            <span className="gs-letter">{r.name.charAt(0)}</span>
          )}
          <span className="gs-player-name">
            {r.name}
            <small>{fmt(r.plays)} games</small>
          </span>
          <b>{value(r)}</b>
        </li>
      ))}
    </ol>
  );
}

export function SiteGamesStats({ stats }: { stats: SiteGames }) {
  const [period, setPeriod] = useState<Period>("30d");
  const p = stats.periods[period];
  const t = p.total;
  const totalSrc = stats.sources.website + stats.sources.discord || 1;
  return (
    <div className="gs">
      <div className="gs-periods" role="tablist" aria-label="Period">
        {(Object.keys(PERIOD_LABEL) as Period[]).map((k) => (
          <button key={k} type="button" role="tab" aria-selected={period === k} className={period === k ? "is-on" : ""} onClick={() => setPeriod(k)}>
            {PERIOD_LABEL[k]}
          </button>
        ))}
      </div>
      <div className="gs-kpis">
        <Kpi label="Wagered" value={<>{compact(t.wagered)} <LeafEmote size={16} /></>} sub={`${fmt(t.plays)} games`} />
        <Kpi label="Paid out" value={<>{compact(t.won)} <LeafEmote size={16} /></>} sub={`${pct(t.rtp)} return to players`} />
        <Kpi label="House kept" value={<>{signed(-t.net)} <LeafEmote size={16} /></>} tone={-t.net >= 0 ? "up" : "down"} sub={t.wagered ? `${pct(-t.net / t.wagered)} edge` : undefined} />
        <Kpi label="Players" value={fmt(p.players)} sub={t.plays && p.players ? `${(t.plays / p.players).toFixed(1)} games each` : undefined} />
        <Kpi label="Biggest win" icon={<Trophy size={15} />} value={t.biggestWin > 0 ? `+${compact(t.biggestWin)}` : "—"} tone="gold" />
        <Kpi label="Slots jackpot" icon={<Crown size={15} />} value={<>{compact(stats.jackpot)} <LeafEmote size={16} /></>} tone="gold" sub="fed by losing bets" />
      </div>

      <div className="gs-cards">
        <Section title={`By game · ${PERIOD_LABEL[period]}`} icon={<Dices size={16} />} wide>
          <GameTable games={p.games} total={t} house />
        </Section>
        <Section title="Daily volume, last 30 days" icon={<TrendingUp size={16} />} wide>
          <DayBars days={stats.days} />
          <p className="gs-legend">
            <i className="is-wager" /> wagered <i className="is-house" /> house kept <i className="is-paid" /> house paid out more
          </p>
        </Section>
        <Section title="Top players by wagered" icon={<Crown size={16} />}>
          <PlayerList rows={stats.topWagered} value={(r) => compact(r.wagered)} />
        </Section>
        <Section title="Biggest winners (all time)" icon={<TrendingUp size={16} />}>
          <PlayerList rows={stats.topWinners} value={(r) => <span className="is-up">{signed(r.net)}</span>} />
        </Section>
        <Section title="Biggest losers (all time)" icon={<TrendingDown size={16} />}>
          <PlayerList rows={stats.topLosers} value={(r) => <span className="is-down">{signed(r.net)}</span>} />
        </Section>
        <Section title="Biggest single wins" icon={<Trophy size={16} />}>
          {stats.bigWins.length ? (
            <ul className="gs-recent">
              {stats.bigWins.map((w, i) => (
                <li key={i} className="is-up" title={w.at ? new Date(w.at).toLocaleString() : undefined}>
                  <em>{GAME_ICON[w.game] ?? "🎲"}</em>
                  <span>
                    <b>{w.name}</b>
                    <small>
                      {w.label}
                      {w.detail ? ` · ${w.detail}` : ""}
                    </small>
                  </span>
                  <strong>+{compact(w.net)}</strong>
                </li>
              ))}
            </ul>
          ) : (
            <p className="gs-none">No wins yet.</p>
          )}
        </Section>
        <Section title="When people play (last 90 days)" icon={<Flame size={16} />}>
          <HourBars hours={stats.hours} />
        </Section>
        <Section title="Where people play" icon={<Globe size={16} />}>
          <div className="gs-split">
            <i style={{ "--w": `${(stats.sources.discord / totalSrc) * 100}%` } as CSSProperties} />
          </div>
          <dl className="gs-dl">
            <div><dt><MessageCircle size={13} aria-hidden="true" /> Discord</dt><dd>{fmt(stats.sources.discord)} games · {compact(stats.sources.discordWagered)} wagered</dd></div>
            <div><dt><Globe size={13} aria-hidden="true" /> Website</dt><dd>{fmt(stats.sources.website)} games · {compact(stats.sources.websiteWagered)} wagered</dd></div>
          </dl>
        </Section>
      </div>
    </div>
  );
}
