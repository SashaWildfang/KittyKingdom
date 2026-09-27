"use client";

import { BarChart3, Grid3x3, LineChart as LineIcon, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { BarList } from "./admin-charts";
import { formatMs, useStored } from "./admin-shared";

type Row = { key: string; views: number; visitors: number };
type Slot = { hour?: number; weekday?: number };
type SlotDetail = {
  views: number;
  visitors: number;
  visits: number;
  avgMs: number | null;
  newViews: number;
  pages: Row[];
  referrers: Row[];
  countries: Row[];
  devices: Row[];
  audience: Row[];
  byDate: { date: string; views: number }[];
};

export type TimesData = {
  hours: number[];
  hourVisitors: number[];
  weekdays: number[];
  weekdayVisitors: number[];
  heat: { views: number[][]; visitors: number[][] };
};

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const hourLabel = (h: number) => new Date(2020, 0, 1, h).toLocaleTimeString([], { hour: "numeric" });
const hourRange = (h: number) => `${hourLabel(h)} – ${hourLabel((h + 1) % 24)}`;
const fmt = (n: number) => n.toLocaleString();
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);

function slotTitle(slot: Slot) {
  if (slot.weekday !== undefined && slot.hour !== undefined) return `${DAYS[slot.weekday]}s, ${hourRange(slot.hour)}`;
  if (slot.weekday !== undefined) return `${DAYS[slot.weekday]}s`;
  return hourRange(slot.hour ?? 0);
}

function zoneName() {
  try {
    return new Intl.DateTimeFormat(undefined, { timeZoneName: "short" }).formatToParts(new Date()).find((p) => p.type === "timeZoneName")?.value ?? "";
  } catch {
    return "";
  }
}

// ---------- Charts ----------
function BarChart({ values, labels, ticks, selected, onPick, format }: { values: number[]; labels: string[]; ticks: string[]; selected: number | null; onPick: (i: number) => void; format: (n: number) => string }) {
  const max = Math.max(1, ...values);
  const [hover, setHover] = useState<number | null>(null);
  const peak = values.indexOf(Math.max(...values));
  return (
    <div className="tt-bars" style={{ "--n": values.length } as CSSProperties} onMouseLeave={() => setHover(null)}>
      {values.map((v, i) => (
        <button
          key={i}
          type="button"
          className={`tt-bar${i === selected ? " is-selected" : ""}${i === peak && v ? " is-peak" : ""}`}
          style={{ "--h": `${(v / max) * 100}%` } as CSSProperties}
          onMouseEnter={() => setHover(i)}
          onFocus={() => setHover(i)}
          onClick={() => onPick(i)}
          aria-label={`${labels[i]}: ${format(v)}`}
          aria-pressed={i === selected}
        >
          <i />
          {hover === i ? (
            <span className="tt-tip">
              <b>{labels[i]}</b>
              {format(v)}
              <small>Click for details</small>
            </span>
          ) : null}
          <em>{values.length > 12 ? (i % 3 === 0 ? ticks[i] : "") : ticks[i]}</em>
        </button>
      ))}
    </div>
  );
}

function LineChart({ values, second, labels, ticks, selected, onPick, format }: { values: number[]; second: number[]; labels: string[]; ticks: string[]; selected: number | null; onPick: (i: number) => void; format: (n: number) => string }) {
  // Drawn at the container's real width so text and dots stay the same size on any screen
  const box = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(720);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const H = 240;
  const pad = { l: 36, r: 12, t: 14, b: 26 };
  const max = Math.max(1, ...values, ...second);
  const n = values.length;
  const x = (i: number) => pad.l + (n === 1 ? 0 : (i / (n - 1)) * (W - pad.l - pad.r));
  const y = (v: number) => pad.t + (1 - v / max) * (H - pad.t - pad.b);
  const path = (vals: number[]) => vals.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const area = `${path(values)} L${x(n - 1)},${H - pad.b} L${x(0)},${H - pad.b} Z`;
  const [hover, setHover] = useState<number | null>(null);
  const active = hover ?? selected;
  const yTicks = [0, 0.5, 1].map((f) => Math.round(max * f));
  return (
    <div className="tt-line" ref={box}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="Line chart"
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const box = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
          const px = ((e.clientX - box.left) / box.width) * W;
          const i = Math.round(((px - pad.l) / (W - pad.l - pad.r)) * (n - 1));
          setHover(Math.max(0, Math.min(n - 1, i)));
        }}
        onClick={() => hover !== null && onPick(hover)}
      >
        <defs>
          <linearGradient id="tt-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--ember)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="var(--ember)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {yTicks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} className="tt-grid" />
            <text x={pad.l - 6} y={y(t) + 4} textAnchor="end" className="tt-axis">
              {t >= 1000 ? `${Math.round(t / 100) / 10}k` : t}
            </text>
          </g>
        ))}
        <path d={area} fill="url(#tt-fill)" />
        <path d={path(second)} className="tt-path tt-path--second" />
        <path d={path(values)} className="tt-path" />
        {labels.map((l, i) =>
          n <= 7 || i % (W < 520 ? 6 : 3) === 0 ? (
            <text key={i} x={x(i)} y={H - 6} textAnchor="middle" className="tt-axis">
              {ticks[i] ?? l}
            </text>
          ) : null,
        )}
        {active !== null ? (
          <g>
            <line x1={x(active)} x2={x(active)} y1={pad.t} y2={H - pad.b} className="tt-cursor" />
            <circle cx={x(active)} cy={y(second[active])} r="4" className="tt-dot tt-dot--second" />
            <circle cx={x(active)} cy={y(values[active])} r="5" className="tt-dot" />
          </g>
        ) : null}
        {values.map((v, i) => (
          <circle key={i} cx={x(i)} cy={y(v)} r={i === selected ? 5 : 2.5} className={`tt-point${i === selected ? " is-selected" : ""}`} />
        ))}
      </svg>
      {active !== null ? (
        <p className="tt-line-readout">
          <b>{labels[active]}</b> · {format(values[active])} · <span className="tt-second-key">{fmt(second[active])}</span> <small>(click to see details)</small>
        </p>
      ) : (
        <p className="tt-line-readout adm-muted">Hover the chart to read it, click to see details.</p>
      )}
    </div>
  );
}

function Heatmap({ grid, selected, onPick, label }: { grid: number[][]; selected: Slot | null; onPick: (s: Slot) => void; label: string }) {
  const max = Math.max(1, ...grid.flat());
  // Monday first
  const order = [1, 2, 3, 4, 5, 6, 0];
  return (
    <div className="tt-heat" role="grid" aria-label={`${label} by day and hour`}>
      {order.map((d) => (
        <div className="tt-heat-row" role="row" key={d}>
          <span className="tt-heat-day">{DAYS[d].slice(0, 3)}</span>
          {grid[d].map((v, h) => (
            <button
              key={h}
              type="button"
              role="gridcell"
              className={selected?.weekday === d && selected?.hour === h ? "is-selected" : undefined}
              style={{ "--a": v ? 0.12 + (v / max) * 0.88 : 0 } as CSSProperties}
              title={`${DAYS[d]} ${hourRange(h)}: ${fmt(v)} ${label.toLowerCase()}`}
              aria-label={`${DAYS[d]} ${hourRange(h)}: ${fmt(v)}`}
              onClick={() => onPick({ weekday: d, hour: h })}
            />
          ))}
        </div>
      ))}
      <div className="tt-heat-row tt-heat-axis" aria-hidden="true">
        <span />
        {Array.from({ length: 24 }, (_, h) => (
          <em key={h}>{h % 3 === 0 ? hourLabel(h) : ""}</em>
        ))}
      </div>
      <div className="tt-heat-legend" aria-hidden="true">
        <span>Less</span>
        {[0.12, 0.35, 0.6, 0.85, 1].map((a) => (
          <i key={a} style={{ "--a": a } as CSSProperties} />
        ))}
        <span>More</span>
      </div>
    </div>
  );
}

// ---------- Details for a clicked slot ----------
function SlotPanel({ slot, range, total, onClose }: { slot: Slot; range: string; total: number; onClose: () => void }) {
  const [data, setData] = useState<SlotDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    setData(null);
    setError(null);
    const q = new URLSearchParams({ range });
    if (slot.hour !== undefined) q.set("hour", String(slot.hour));
    if (slot.weekday !== undefined) q.set("weekday", String(slot.weekday));
    fetch(`/api/admin/traffic/slot?${q}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((body) => {
        if (!alive) return;
        if (body.ok) setData(body);
        else setError(body.error ?? "Couldn't load that time slot.");
      })
      .catch(() => alive && setError("Couldn't load that time slot."));
    return () => {
      alive = false;
    };
  }, [slot.hour, slot.weekday, range]);

  const bars = (rows: Row[]) => rows.map((r) => ({ key: r.key, label: r.key, value: r.views, hint: `${fmt(r.views)} views · ${fmt(r.visitors)} visitors` }));
  const maxDate = data ? Math.max(1, ...data.byDate.map((d) => d.views)) : 1;

  return (
    <div className="tt-panel" aria-live="polite">
      <header>
        <div>
          <p className="tt-panel-eyebrow">Time slot</p>
          <h4>{slotTitle(slot)}</h4>
        </div>
        <button type="button" className="tt-close" onClick={onClose} aria-label="Close details">
          <X size={16} />
        </button>
      </header>
      {error ? <p className="adm-empty">{error}</p> : null}
      {!data && !error ? <div className="adm-skeleton adm-skeleton--short" /> : null}
      {data ? (
        <>
          <div className="tt-panel-stats">
            <div><span>Views</span><strong>{fmt(data.views)}</strong><small>{pct(data.views, total)}% of the range</small></div>
            <div><span>Visitors</span><strong>{fmt(data.visitors)}</strong><small>{fmt(data.visits)} visits</small></div>
            <div><span>Avg. time on page</span><strong>{formatMs(data.avgMs)}</strong><small>&nbsp;</small></div>
            <div><span>New visitors</span><strong>{pct(data.newViews, data.views)}%</strong><small>of views</small></div>
          </div>
          {data.byDate.length > 1 ? (
            <div className="tt-dates">
              <p>Each day in this range</p>
              <div className="tt-dates-bars">
                {data.byDate.map((d) => (
                  <i
                    key={d.date}
                    style={{ "--h": `${(d.views / maxDate) * 100}%` } as CSSProperties}
                    title={`${new Date(`${d.date}T12:00:00`).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}: ${fmt(d.views)} views`}
                  />
                ))}
              </div>
            </div>
          ) : null}
          <div className="tt-panel-grid">
            <div><h5>Top pages</h5><BarList items={bars(data.pages)} color="rgba(245, 155, 42, 0.3)" /></div>
            <div><h5>Referrers</h5><BarList items={bars(data.referrers)} color="rgba(88, 101, 242, 0.3)" /></div>
            <div><h5>Countries</h5><BarList items={bars(data.countries)} color="rgba(59, 165, 93, 0.3)" /></div>
            <div><h5>Devices & audience</h5><BarList items={[...bars(data.devices), ...bars(data.audience)]} color="rgba(214, 64, 159, 0.28)" /></div>
          </div>
        </>
      ) : null}
    </div>
  );
}

/** Admin → Traffic: when people visit, as bars, a line or a day × hour heatmap. Click any point for details. */
export function TrafficTimes({ data, range }: { data: TimesData; range: string }) {
  const [chart, setChart] = useStored<"bars" | "line" | "heat">("traffic-times-chart", "bars");
  const [group, setGroup] = useStored<"hour" | "day">("traffic-times-group", "hour");
  const [metric, setMetric] = useStored<"views" | "visitors">("traffic-times-metric", "views");
  const [slot, setSlot] = useState<Slot | null>(null);
  const zone = useMemo(zoneName, []);

  useEffect(() => setSlot(null), [range]);

  const byHour = group === "hour";
  const views = byHour ? data.hours : data.weekdays;
  const visitors = byHour ? data.hourVisitors : data.weekdayVisitors;
  const values = metric === "views" ? views : visitors;
  const second = metric === "views" ? visitors : views;
  const labels = byHour ? Array.from({ length: 24 }, (_, h) => hourRange(h)) : DAYS;
  const ticks = byHour ? Array.from({ length: 24 }, (_, h) => hourLabel(h)) : DAYS.map((d) => d.slice(0, 3));
  const format = (n: number) => `${fmt(n)} ${metric}`;
  const total = data.hours.reduce((a, b) => a + b, 0);
  const selectedIndex = slot && chart !== "heat" ? (byHour ? slot.hour ?? null : slot.weekday ?? null) : null;
  const pick = (i: number) => setSlot(byHour ? { hour: i } : { weekday: i });
  const peak = values.indexOf(Math.max(...values));

  return (
    <div className="tt">
      <div className="tt-controls">
        <div className="adm-seg" role="tablist" aria-label="Chart type">
          {(
            [
              ["bars", BarChart3, "Bars"],
              ["line", LineIcon, "Line"],
              ["heat", Grid3x3, "Heatmap"],
            ] as const
          ).map(([key, Icon, label]) => (
            <button key={key} type="button" role="tab" aria-selected={chart === key} className={chart === key ? "is-active" : undefined} onClick={() => setChart(key)}>
              <Icon size={14} aria-hidden="true" /> {label}
            </button>
          ))}
        </div>
        {chart !== "heat" ? (
          <div className="adm-seg" role="tablist" aria-label="Group by">
            <button type="button" role="tab" aria-selected={byHour} className={byHour ? "is-active" : undefined} onClick={() => { setGroup("hour"); setSlot(null); }}>
              Hour of day
            </button>
            <button type="button" role="tab" aria-selected={!byHour} className={!byHour ? "is-active" : undefined} onClick={() => { setGroup("day"); setSlot(null); }}>
              Day of week
            </button>
          </div>
        ) : null}
        <div className="adm-seg" role="tablist" aria-label="Measure">
          {(["views", "visitors"] as const).map((m) => (
            <button key={m} type="button" role="tab" aria-selected={metric === m} className={metric === m ? "is-active" : undefined} onClick={() => setMetric(m)}>
              {m === "views" ? "Page views" : "Visitors"}
            </button>
          ))}
        </div>
      </div>

      {total ? (
        <p className="tt-summary">
          {chart === "heat" ? (
            <>Busiest slot: <b>{(() => {
              const grid = metric === "views" ? data.heat.views : data.heat.visitors;
              let best = { d: 0, h: 0, v: -1 };
              grid.forEach((row, d) => row.forEach((v, h) => { if (v > best.v) best = { d, h, v }; }));
              return `${DAYS[best.d]}s ${hourRange(best.h)}`;
            })()}</b></>
          ) : (
            <>Peak: <b>{labels[peak]}</b> with {format(values[peak])}</>
          )}
          {zone ? <small> · times in {zone}</small> : null}
        </p>
      ) : null}

      {!total ? (
        <p className="adm-empty">No visits in this range yet.</p>
      ) : chart === "bars" ? (
        <BarChart values={values} labels={labels} ticks={ticks} selected={selectedIndex} onPick={pick} format={format} />
      ) : chart === "line" ? (
        <>
          <LineChart values={values} second={second} labels={labels} ticks={ticks} selected={selectedIndex} onPick={pick} format={format} />
          <p className="tt-legend">
            <span className="tt-key" /> {metric === "views" ? "Page views" : "Visitors"} <span className="tt-key tt-key--second" /> {metric === "views" ? "Visitors" : "Page views"}
          </p>
        </>
      ) : (
        <Heatmap grid={metric === "views" ? data.heat.views : data.heat.visitors} selected={slot} onPick={setSlot} label={metric === "views" ? "Views" : "Visitors"} />
      )}

      {slot ? <SlotPanel slot={slot} range={range} total={total} onClose={() => setSlot(null)} /> : null}
    </div>
  );
}
