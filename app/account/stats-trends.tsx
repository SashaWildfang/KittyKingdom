"use client";

import { ArrowDownRight, ArrowUpRight, CalendarDays, Flame, Minus, Trophy } from "lucide-react";
import { useMemo, useState, type CSSProperties } from "react";

type Day = { date: string; n: number };

const RANGES = [
  { key: 14, label: "2 weeks" },
  { key: 30, label: "30 days" },
  { key: 90, label: "90 days" },
  { key: 364, label: "Year" },
] as const;
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const fmt = (n: number) => Math.round(n).toLocaleString();
const dayOf = (date: string) => (new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7; // Mon = 0
const label = (date: string, long = false) =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString(undefined, long ? { weekday: "long", month: "short", day: "numeric" } : { month: "short", day: "numeric" });

/** Messages over time: pick a range, hover or tap the chart, compare weekdays. */
export function TrendsCard({ calendar }: { calendar: Day[] }) {
  const [range, setRange] = useState<number>(30);
  const [hover, setHover] = useState<number | null>(null);
  const [pinned, setPinned] = useState<number | null>(null);
  const [weekday, setWeekday] = useState<number | null>(null);

  const data = useMemo(() => {
    const days = calendar.slice(-range);
    const prev = range < 364 ? calendar.slice(-range * 2, -range) : [];
    // A year is easier to read by week
    const points =
      range === 364
        ? Array.from({ length: Math.ceil(days.length / 7) }, (_, i) => {
            const chunk = days.slice(i * 7, i * 7 + 7);
            return { date: chunk[0].date, end: chunk[chunk.length - 1].date, n: chunk.reduce((a, d) => a + d.n, 0) };
          })
        : days.map((d) => ({ ...d, end: d.date }));
    const total = days.reduce((a, d) => a + d.n, 0);
    const prevTotal = prev.reduce((a, d) => a + d.n, 0);
    const active = days.filter((d) => d.n > 0).length;
    const best = days.reduce((b, d) => (d.n > b.n ? d : b), days[0] ?? { date: "", n: 0 });
    let streak = 0;
    for (let i = days.length - 1; i >= 0 && days[i].n > 0; i--) streak++;
    const byWeekday = WEEKDAYS.map((_, w) => {
      const list = days.filter((d) => dayOf(d.date) === w);
      return list.length ? list.reduce((a, d) => a + d.n, 0) / list.length : 0;
    });
    // Momentum: second half of the range vs the first half
    const half = Math.floor(days.length / 2);
    const first = days.slice(0, half).reduce((a, d) => a + d.n, 0);
    const second = days.slice(half).reduce((a, d) => a + d.n, 0);
    return { days, points, total, prevTotal, active, best, streak, byWeekday, first, second };
  }, [calendar, range]);

  const { points } = data;
  const max = Math.max(1, ...points.map((p) => p.n));
  const avg = points.length ? points.reduce((a, p) => a + p.n, 0) / points.length : 0;
  const W = 600;
  const H = 180;
  const x = (i: number) => (points.length <= 1 ? W / 2 : (i / (points.length - 1)) * W);
  const y = (n: number) => H - 8 - (n / max) * (H - 24);
  const line = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.n).toFixed(1)}`).join(" ");
  const area = `${line} L${W},${H} L0,${H} Z`;
  const peakIndex = points.reduce((b, p, i) => (p.n > points[b].n ? i : b), 0);
  const focus = hover ?? pinned ?? peakIndex;
  const fp = points[focus];
  const change = data.prevTotal ? (data.total - data.prevTotal) / data.prevTotal : null;
  const momentum = data.first ? (data.second - data.first) / data.first : data.second ? 1 : 0;
  const unit = range === 364 ? "week" : "day";
  const wdMax = Math.max(1, ...data.byWeekday);
  const topWeekday = data.byWeekday.indexOf(Math.max(...data.byWeekday));

  function pick(clientX: number, el: SVGSVGElement) {
    const r = el.getBoundingClientRect();
    const i = Math.round(((clientX - r.left) / r.width) * (points.length - 1));
    return Math.max(0, Math.min(points.length - 1, i));
  }

  return (
    <div className="st-trend">
      <div className="st-seg st-seg--small st-trend-ranges" role="tablist" aria-label="Range">
        {RANGES.map((r) => (
          <button key={r.key} type="button" role="tab" aria-selected={range === r.key} className={range === r.key ? "is-on" : undefined} onClick={() => { setRange(r.key); setPinned(null); setWeekday(null); }}>
            {r.label}
          </button>
        ))}
      </div>

      <div className="st-trend-tiles">
        <div>
          <span>Messages</span>
          <strong>{fmt(data.total)}</strong>
          {change !== null ? (
            <em className={change > 0.02 ? "st-up" : change < -0.02 ? "st-down" : undefined}>
              {change > 0.02 ? <ArrowUpRight size={13} /> : change < -0.02 ? <ArrowDownRight size={13} /> : <Minus size={13} />}
              {change > 0 ? "+" : ""}
              {Math.round(change * 100)}% vs before
            </em>
          ) : (
            <em>the last 52 weeks</em>
          )}
        </div>
        <div>
          <span>Per day</span>
          <strong>{(data.total / Math.max(1, data.days.length)).toFixed(1)}</strong>
          <em>on average</em>
        </div>
        <button type="button" onClick={() => setPinned(range === 364 ? Math.floor(data.days.findIndex((d) => d.date === data.best.date) / 7) : data.days.findIndex((d) => d.date === data.best.date))} title="Show it on the chart">
          <span>
            <Trophy size={12} /> Best day
          </span>
          <strong>{fmt(data.best.n)}</strong>
          <em>{data.best.n ? label(data.best.date) : "—"}</em>
        </button>
        <div>
          <span>
            <CalendarDays size={12} /> Active days
          </span>
          <strong>
            {data.active}
            <small>/{data.days.length}</small>
          </strong>
          <em>
            {data.streak ? (
              <>
                <Flame size={12} /> {data.streak} in a row now
              </>
            ) : (
              "no streak right now"
            )}
          </em>
        </div>
      </div>

      <div className="st-trend-chart">
        <p className="st-trend-readout" aria-live="polite">
          {fp ? (
            <>
              <b>{fmt(fp.n)}</b> message{fp.n === 1 ? "" : "s"} {range === 364 ? `the week of ${label(fp.date)}` : `on ${label(fp.date, true)}`}
              {focus === peakIndex && fp.n ? <span className="st-peak-tag">PEAK</span> : null}
              {pinned !== null ? (
                <button type="button" onClick={() => setPinned(null)}>
                  unpin
                </button>
              ) : null}
            </>
          ) : null}
        </p>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          role="img"
          aria-label={`Messages per ${unit}`}
          onMouseMove={(e) => setHover(pick(e.clientX, e.currentTarget))}
          onMouseLeave={() => setHover(null)}
          onClick={(e) => setPinned(pick(e.clientX, e.currentTarget))}
          onTouchMove={(e) => setHover(pick(e.touches[0].clientX, e.currentTarget))}
          onTouchEnd={() => { if (hover !== null) setPinned(hover); setHover(null); }}
        >
          <defs>
            <linearGradient id="st-trend-fill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="var(--ember)" stopOpacity="0.45" />
              <stop offset="100%" stopColor="var(--ember)" stopOpacity="0.02" />
            </linearGradient>
          </defs>
          {weekday !== null
            ? points.map((p, i) =>
                range !== 364 && dayOf(p.date) === weekday ? <rect key={i} x={x(i) - W / points.length / 2} y={0} width={W / points.length} height={H} className="st-trend-wd" /> : null,
              )
            : null}
          <line x1={0} x2={W} y1={y(avg)} y2={y(avg)} className="st-trend-avg" />
          <path d={area} fill="url(#st-trend-fill)" />
          <path d={line} className="st-trend-line" vectorEffect="non-scaling-stroke" />
          {fp ? (
            <>
              <line x1={x(focus)} x2={x(focus)} y1={0} y2={H} className="st-trend-cross" vectorEffect="non-scaling-stroke" />
              <circle cx={x(focus)} cy={y(fp.n)} r={5} className="st-trend-dot" vectorEffect="non-scaling-stroke" />
            </>
          ) : null}
        </svg>
        <div className="st-trend-axis" aria-hidden="true">
          <span>{points[0] ? label(points[0].date) : ""}</span>
          <span>avg {avg.toFixed(1)}/{unit}</span>
          <span>{points.length ? (range === 364 ? "this week" : "today") : ""}</span>
        </div>
      </div>

      <div className="st-trend-week">
        <p className="st-note">Average by weekday · tap one to highlight it</p>
        <div className="st-trend-wdays">
          {data.byWeekday.map((v, i) => (
            <button
              key={i}
              type="button"
              className={`${weekday === i ? "is-on" : ""}${i === topWeekday && v ? " is-top" : ""}`}
              onClick={() => setWeekday(weekday === i ? null : i)}
              title={`${WEEKDAYS[i]}: ${v.toFixed(1)} messages on average`}
              style={{ "--h": `${Math.max(6, (v / wdMax) * 100)}%` } as CSSProperties}
            >
              <i />
              <span>{WEEKDAYS[i]}</span>
            </button>
          ))}
        </div>
      </div>

      <p className={`st-trend-say ${momentum > 0.1 ? "is-up" : momentum < -0.1 ? "is-down" : ""}`}>
        {data.total === 0
          ? "Quiet stretch. Say hi in chat and this fills right up."
          : momentum > 0.1
            ? `📈 You're chatting ${Math.round(momentum * 100)}% more in the second half of this range. Heating up!`
            : momentum < -0.1
              ? `📉 A bit quieter lately (${Math.round(-momentum * 100)}% less than earlier in this range).`
              : "➖ Steady as ever: about the same all the way through."}
        {data.byWeekday[topWeekday] ? ` ${WEEKDAYS[topWeekday]}s are your big day.` : ""}
      </p>
    </div>
  );
}
