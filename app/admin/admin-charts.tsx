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
  unit: "day" | "week" | "month";
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
    new Date(iso).toLocaleDateString(undefined, unit === "month" ? { month: "short", year: "2-digit" } : { month: "short", day: "numeric" });
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
export function Donut({ parts, size = 170, label }: { parts: { key: string; label: string; value: number; color: string }[]; size?: number; label: string }) {
  const total = parts.reduce((a, p) => a + p.value, 0);
  const r = 42;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="adm-donut">
      <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true">
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--line)" strokeWidth="12" />
        {total > 0
          ? parts.map((p) => {
              const len = (p.value / total) * c;
              const el = (
                <circle
                  key={p.key}
                  cx="50"
                  cy="50"
                  r={r}
                  fill="none"
                  stroke={p.color}
                  strokeWidth="12"
                  strokeDasharray={`${len} ${c - len}`}
                  strokeDashoffset={-offset}
                  transform="rotate(-90 50 50)"
                />
              );
              offset += len;
              return el;
            })
          : null}
        <text x="50" y="49" textAnchor="middle" className="adm-donut-total">
          {total.toLocaleString()}
        </text>
        <text x="50" y="62" textAnchor="middle" className="adm-donut-label">
          {label}
        </text>
      </svg>
      <ul className="adm-legend">
        {parts.map((p) => (
          <li key={p.key}>
            <i style={{ background: p.color }} />
            <span>{p.label}</span>
            <strong>{p.value.toLocaleString()}</strong>
            <small>{total ? Math.round((p.value / total) * 100) : 0}%</small>
          </li>
        ))}
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

/** Horizontal bars for a ranked list. */
export function BarList({ items, color = "var(--ember)" }: { items: { key: string; label: React.ReactNode; value: number; color?: string }[]; color?: string }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  if (!items.length) return <p className="adm-empty">Nothing here yet.</p>;
  return (
    <ul className="adm-barlist">
      {items.map((item) => (
        <li key={item.key}>
          <span className="adm-barlist-fill" style={{ width: `${(item.value / max) * 100}%`, background: item.color ?? color }} />
          <span className="adm-barlist-label">{item.label}</span>
          <strong>{item.value.toLocaleString()}</strong>
        </li>
      ))}
    </ul>
  );
}
