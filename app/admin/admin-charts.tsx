"use client";

import { useState } from "react";

type Series = { key: string; label: string; color: string };

/** Stacked bars over time. Buckets are ISO dates; hovering a bar shows its breakdown. */
export function StackedBars({
  points,
  series,
  unit,
  height = 220,
}: {
  points: { bucket: string; action: string; count: number }[];
  series: Series[];
  unit: "hour" | "day" | "week" | "month";
  height?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const buckets = Array.from(new Set(points.map((p) => p.bucket))).sort();
  const visible = new Set(series.map((s) => s.key));
  const rows = buckets.map((bucket) => {
    const values: Record<string, number> = {};
    for (const p of points) if (p.bucket === bucket && visible.has(p.action)) values[p.action] = (values[p.action] ?? 0) + p.count;
    return { bucket, values, total: Object.values(values).reduce((a, b) => a + b, 0) };
  });
  const max = Math.max(1, ...rows.map((r) => r.total));
  if (!rows.length) return <p className="adm-empty">Nothing in this range yet.</p>;

  const width = 100 / rows.length;
  const label = (iso: string) =>
    unit === "hour"
      ? new Date(iso).toLocaleTimeString(undefined, { hour: "numeric" })
      : new Date(iso).toLocaleDateString(undefined, unit === "month" ? { month: "short", year: "2-digit" } : { month: "short", day: "numeric" });
  const tickEvery = Math.max(1, Math.ceil(rows.length / 8));
  const hovered = hover !== null ? rows[hover] : null;

  return (
    <div className="adm-chart">
      <div className="adm-bars" style={{ height }} onMouseLeave={() => setHover(null)}>
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <span key={f} className="adm-gridline" style={{ bottom: `${f * 100}%` }}>
            <small>{Math.round(max * f)}</small>
          </span>
        ))}
        {rows.map((row, i) => (
          <div
            key={row.bucket}
            className={`adm-bar-col${hover === i ? " is-hover" : ""}`}
            style={{ width: `${width}%` }}
            onMouseEnter={() => setHover(i)}
          >
            <div className="adm-bar-stack" style={{ height: `${(row.total / max) * 100}%` }}>
              {series
                .filter((s) => row.values[s.key])
                .map((s) => (
                  <span key={s.key} style={{ flexGrow: row.values[s.key], background: s.color }} />
                ))}
            </div>
          </div>
        ))}
        {hovered ? (
          <div className="adm-tooltip" style={{ left: `${Math.min(80, Math.max(0, (hover! + 0.5) * width - 10))}%` }}>
            <strong>
              {label(hovered.bucket)} · {hovered.total}
            </strong>
            {series
              .filter((s) => hovered.values[s.key])
              .map((s) => (
                <span key={s.key}>
                  <i style={{ background: s.color }} /> {s.label}: {hovered.values[s.key]}
                </span>
              ))}
          </div>
        ) : null}
      </div>
      <div className="adm-axis">
        {rows.map((row, i) => (
          <span key={row.bucket} style={{ width: `${width}%` }}>
            {i % tickEvery === 0 ? label(row.bucket) : ""}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Ring chart with a total in the middle. */
export function Donut({
  parts,
  size = 170,
  label,
  onSelect,
}: {
  parts: { key: string; label: string; value: number; color: string }[];
  size?: number;
  label: string;
  /** Makes slices and legend rows clickable */
  onSelect?: (key: string) => void;
}) {
  const [hover, setHover] = useState<string | null>(null);
  const total = parts.reduce((a, p) => a + p.value, 0);
  const r = 42;
  const c = 2 * Math.PI * r;
  let offset = 0;
  const hovered = parts.find((p) => p.key === hover);
  return (
    <div className={`adm-donut${onSelect ? " is-clickable" : ""}`}>
      <svg viewBox="0 0 100 100" width={size} height={size} role={onSelect ? "group" : undefined} aria-hidden={onSelect ? undefined : true} aria-label={onSelect ? "Breakdown chart" : undefined}>
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--line)" strokeWidth="12" />
        {total > 0
          ? parts.map((p) => {
              const len = (p.value / total) * c;
              const el = (
                <circle
                  key={p.key}
                  className={`adm-donut-slice${hover && hover !== p.key ? " is-dim" : ""}${hover === p.key ? " is-hover" : ""}`}
                  cx="50"
                  cy="50"
                  r={r}
                  fill="none"
                  stroke={p.color}
                  strokeWidth="12"
                  strokeDasharray={`${len} ${c - len}`}
                  strokeDashoffset={-offset}
                  transform="rotate(-90 50 50)"
                  onMouseEnter={() => setHover(p.key)}
                  onMouseLeave={() => setHover(null)}
                  onClick={onSelect ? () => onSelect(p.key) : undefined}
                >
                  <title>{`${p.label}: ${p.value.toLocaleString()}${onSelect ? " (click for the causes)" : ""}`}</title>
                </circle>
              );
              offset += len;
              return el;
            })
          : null}
        <text x="50" y="49" textAnchor="middle" className="adm-donut-total">
          {(hovered?.value ?? total).toLocaleString()}
        </text>
        <text x="50" y="62" textAnchor="middle" className="adm-donut-label">
          {hovered ? hovered.label.toLowerCase() : label}
        </text>
      </svg>
      <ul className="adm-legend">
        {parts.map((p) => {
          const inner = (
            <>
              <i style={{ background: p.color }} />
              <span>{p.label}</span>
              <strong>{p.value.toLocaleString()}</strong>
              <small>{total ? Math.round((p.value / total) * 100) : 0}%</small>
            </>
          );
          return (
            <li key={p.key} className={hover === p.key ? "is-hover" : undefined} onMouseEnter={() => setHover(p.key)} onMouseLeave={() => setHover(null)}>
              {onSelect ? (
                <button type="button" onClick={() => onSelect(p.key)} title={`See what caused these ${p.label.toLowerCase()}s`}>
                  {inner}
                </button>
              ) : (
                inner
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** 24 cells, one per hour of the day (server time), shaded by activity. */
export function HourStrip({ hours }: { hours: number[] }) {
  const max = Math.max(1, ...hours);
  return (
    <div className="adm-hours">
      <div className="adm-hours-row">
        {hours.map((n, h) => (
          <span key={h} title={`${h}:00 · ${n}`} style={{ opacity: n ? 0.18 + (n / max) * 0.82 : 0.08 }} />
        ))}
      </div>
      <div className="adm-hours-axis">
        <small>12am</small>
        <small>6am</small>
        <small>12pm</small>
        <small>6pm</small>
        <small>11pm</small>
      </div>
    </div>
  );
}

/** Horizontal bars for a ranked list. Rows with onClick open a drill-down. */
export function BarList({
  items,
  color = "var(--ember)",
}: {
  items: { key: string; label: React.ReactNode; value: number; color?: string; onClick?: () => void; hint?: string }[];
  color?: string;
}) {
  const max = Math.max(1, ...items.map((i) => i.value));
  if (!items.length) return <p className="adm-empty">Nothing here yet.</p>;
  return (
    <ul className="adm-barlist">
      {items.map((item) => {
        const inner = (
          <>
            <span className="adm-barlist-fill" style={{ width: `${(item.value / max) * 100}%`, background: item.color ?? color }} />
            <span className="adm-barlist-label">{item.label}</span>
            <strong>{item.value.toLocaleString()}</strong>
          </>
        );
        return (
          <li key={item.key}>
            {item.onClick ? (
              <button type="button" className="adm-barlist-row" onClick={item.onClick} title={item.hint}>
                {inner}
                <span className="adm-barlist-go" aria-hidden="true">
                  ›
                </span>
              </button>
            ) : (
              <div className="adm-barlist-row">{inner}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** Lines over time (e.g. page views and visitors). Hovering shows that point's numbers. */
export function LineChart({
  points,
  series,
  unit,
  height = 220,
}: {
  points: { bucket: string; values: Record<string, number> }[];
  series: Series[];
  unit: "hour" | "day" | "week";
  height?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  if (!points.length) return <p className="adm-empty">No visits in this range yet.</p>;
  const max = Math.max(1, ...points.flatMap((p) => series.map((s) => p.values[s.key] ?? 0)));
  const W = 1000;
  const H = 300;
  const x = (i: number) => (points.length === 1 ? W / 2 : (i / (points.length - 1)) * W);
  const y = (v: number) => H - (v / max) * (H - 16) - 4;
  const label = (iso: string) =>
    unit === "hour"
      ? new Date(iso).toLocaleTimeString(undefined, { hour: "numeric" })
      : new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const tickEvery = Math.max(1, Math.ceil(points.length / 8));
  const hovered = hover !== null ? points[hover] : null;

  return (
    <div className="adm-chart adm-line-chart">
      <div className="adm-line-wrap" style={{ height }} onMouseLeave={() => setHover(null)}>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
          {[0.25, 0.5, 0.75].map((f) => (
            <line key={f} x1="0" x2={W} y1={H * f} y2={H * f} className="adm-line-grid" />
          ))}
          {series.map((s) => {
            const line = points.map((p, i) => `${x(i)},${y(p.values[s.key] ?? 0)}`).join(" ");
            return (
              <g key={s.key}>
                <polygon points={`0,${H} ${line} ${W},${H}`} fill={s.color} opacity="0.12" />
                <polyline points={line} fill="none" stroke={s.color} strokeWidth="3" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
              </g>
            );
          })}
          {hover !== null ? <line x1={x(hover)} x2={x(hover)} y1="0" y2={H} className="adm-line-cursor" /> : null}
        </svg>
        <div className="adm-line-hit">
          {points.map((p, i) => (
            <span key={p.bucket} onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} tabIndex={-1} />
          ))}
        </div>
        {hovered ? (
          <div className="adm-line-tip" style={{ left: `${(x(hover!) / W) * 100}%` }}>
            <strong>{unit === "hour" ? `${new Date(hovered.bucket).toLocaleDateString(undefined, { month: "short", day: "numeric" })} ${label(hovered.bucket)}` : label(hovered.bucket)}</strong>
            {series.map((s) => (
              <span key={s.key}>
                <i style={{ background: s.color }} /> {s.label} <b>{(hovered.values[s.key] ?? 0).toLocaleString()}</b>
              </span>
            ))}
          </div>
        ) : null}
      </div>
      <div className="adm-line-axis">
        {points.map((p, i) => (
          <small key={p.bucket} style={{ left: `${(x(i) / W) * 100}%` }}>
            {i % tickEvery === 0 ? label(p.bucket) : ""}
          </small>
        ))}
      </div>
      <div className="adm-line-legend">
        {series.map((s) => (
          <span key={s.key}>
            <i style={{ background: s.color }} /> {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}
