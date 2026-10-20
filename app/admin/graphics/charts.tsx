// Admin → Graphics: shareable stat graphics drawn as plain SVG (inline attributes only, no CSS classes), so the
// exact same picture can be turned into a PNG in the browser. Each chart takes its data already counted.

import type { ReactNode } from "react";
import { formatValue, type Fmt, type PartialEnds } from "../../../lib/graphics/spec";

/** Moving-average window by time unit: a week of days, a month of weeks, a quarter of months. */
const maWindow = (partial?: PartialEnds) => (partial?.step === "day" ? 7 : partial?.step === "week" ? 4 : 3);

export type Theme = "dark" | "light";
export type Size = "landscape" | "square" | "wide";
export const SIZES: Record<Size, { w: number; h: number; label: string }> = {
  landscape: { w: 1600, h: 1000, label: "Landscape 1600×1000" },
  wide: { w: 1920, h: 1080, label: "Widescreen 1920×1080" },
  square: { w: 1200, h: 1200, label: "Square 1200×1200" },
};

// The validated reference categorical palette, stepped for each surface; gray is for "no role" / "other"
const PALETTE = {
  dark: ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#9085e9", "#e66767", "#008300"],
  light: ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#6250d6", "#e34948", "#008300"],
};
export const TOKENS = {
  dark: { bg: "#120f0c", glow: "rgba(213,99,0,0.22)", card: "#1a1a19", line: "#2e2d2a", track: "#242321", text: "#f0efec", text2: "#c3c2b7", muted: "#8f8e86", brand: "#e58a3a", gray: "#5c5b56", gray2: "#45443f" },
  light: { bg: "#f6f1ea", glow: "rgba(213,99,0,0.16)", card: "#fcfcfb", line: "#e6ddd0", track: "#efe9e1", text: "#0b0b0b", text2: "#52514e", muted: "#7a786f", brand: "#b4530a", gray: "#a6a39b", gray2: "#c9c5bc" },
};
export type Tokens = (typeof TOKENS)["dark"];
export const seriesColor = (theme: Theme, i: number) => PALETTE[theme][i % PALETTE[theme].length];

const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, Roboto, Helvetica, Arial, sans-serif";
const fmt = (n: number) => n.toLocaleString("en-US");
export const pctText = (n: number, of: number) => (of ? `${((n / of) * 100).toFixed(n / of < 0.1 && n ? 1 : 0)}%` : "0%");
/** Rough text width, to keep labels inside their space */
const textW = (s: string, size: number, weight = 600) => s.length * size * (weight >= 800 ? 0.6 : 0.54);
const clip = (s: string, size: number, max: number, weight = 600) => {
  if (textW(s, size, weight) <= max) return s;
  let t = s;
  while (t.length > 1 && textW(`${t}…`, size, weight) > max) t = t.slice(0, -1);
  return `${t}…`;
};
/** Breaks text into lines that fit `max` pixels */
function wrap(s: string, size: number, max: number) {
  const words = s.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (textW(next, size, 500) > max && line) {
      lines.push(line);
      line = w;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

type T = { x: number; y: number; size: number; fill: string; weight?: number; anchor?: "start" | "middle" | "end"; spacing?: number; children: ReactNode; upper?: boolean };
const Txt = ({ x, y, size, fill, weight = 500, anchor = "start", spacing, children, upper }: T) => (
  <text x={x} y={y} fontSize={size} fill={fill} fontWeight={weight} textAnchor={anchor} fontFamily={FONT} letterSpacing={spacing} style={upper ? { textTransform: "uppercase" } : undefined}>
    {children}
  </text>
);
const Card = ({ x, y, w, h, t }: { x: number; y: number; w: number; h: number; t: Tokens }) => <rect x={x} y={y} width={w} height={h} rx={22} fill={t.card} stroke={t.line} strokeWidth={1.5} />;
const Label = ({ x, y, t, children }: { x: number; y: number; t: Tokens; children: string }) => (
  <Txt x={x} y={y} size={15} fill={t.text2} weight={800} spacing={2}>
    {children.toUpperCase()}
  </Txt>
);

export type Trend = "line" | "avg" | "both" | "none";

/**
 * Straight line of best fit (least squares) through the values. Periods only partly covered at either end
 * (a half-finished current week, a range starting mid-month) are left out so they don't tilt the line.
 */
function fitLine(all: number[], partial?: PartialEnds) {
  // Incomplete ends are always left out; with too few complete points left there's no trend to draw
  const from = partial?.first ? 1 : 0;
  const to = partial?.last ? all.length - 1 : all.length;
  const pts = all.slice(from, to).map((y, k) => [k + from, y] as const);
  const n = pts.length;
  if (n < 2) return null;
  const mx = pts.reduce((a, [x]) => a + x, 0) / n;
  const my = pts.reduce((a, [, y]) => a + y, 0) / n;
  let num = 0;
  let den = 0;
  pts.forEach(([x, y]) => {
    num += (x - mx) * (y - my);
    den += (x - mx) ** 2;
  });
  const slope = den ? num / den : 0;
  return { slope, from, to: to - 1, at: (x: number) => my + slope * (x - mx) };
}
/** Average of each point and the ones before it (a smoothed line). */
function movingAverage(v: number[], window: number) {
  return v.map((_, i) => {
    const part = v.slice(Math.max(0, i - window + 1), i + 1);
    return part.reduce((a, b) => a + b, 0) / part.length;
  });
}
/** "Rising 18%" / "Falling 6%" / "Flat" over the period, from the trend line. */
function trendWords(v: number[], partial?: PartialEnds) {
  const f = fitLine(v, partial);
  if (!f) return "";
  const start = f.at(f.from);
  const end = f.at(f.to);
  const avg = v.reduce((a, b) => a + b, 0) / v.length;
  const change = start > 0 ? ((end - start) / start) * 100 : avg ? ((end - start) / avg) * 100 : 0;
  if (Math.abs(change) < 3) return "Trend: flat";
  return `Trend: ${change > 0 ? "rising" : "falling"} ${Math.abs(change).toFixed(0)}%`;
}
const tipValue = (v: number, format?: Fmt) => (format ? formatValue(v, format) : Math.abs(v) < 10 && v % 1 ? v.toFixed(1) : Math.round(v).toLocaleString("en-US"));
/** The hover note for a point in a series: its value, how it compares with the one before and with the average. */
function seriesTip(label: string, v: number, prev: number | undefined, avg: number, format?: Fmt, name?: string) {
  const lines = [`${label}`, `${name ? `${name}: ` : ""}${tipValue(v, format)}`];
  if (prev !== undefined && prev > 0) lines.push(`${v >= prev ? "+" : "−"}${Math.abs(((v - prev) / prev) * 100).toFixed(0)}% vs the one before`);
  else if (prev !== undefined && prev === 0 && v > 0) lines.push("Up from 0 the one before");
  if (avg) lines.push(`${v >= avg ? "Above" : "Below"} the ${tipValue(avg, format)} average`);
  return lines.join("\n");
}
/** A see-through hover target (only the page's tooltip uses it; invisible in the PNG). */
const Hit = ({ x, y, w, h, tip }: { x: number; y: number; w: number; h: number; tip: string }) => <rect className="gx-hit" x={x} y={y} width={Math.max(0, w)} height={Math.max(0, h)} fill="#000" fillOpacity={0} data-tip={tip} />;
const HOURS24 = Array.from({ length: 24 }, (_, h) => (h === 0 ? "12am" : h < 12 ? `${h}am` : h === 12 ? "12pm" : `${h - 12}pm`));

export type Frame = { theme: Theme; size: Size; eyebrow: string; title: string; subtitle: string; stamp: string; footnote: string };

/** Background, header and footnote shared by every graphic; `body` draws inside the content box. */
export function Graphic({ frame, body, svgRef }: { frame: Frame; body: (box: { x: number; y: number; w: number; h: number; t: Tokens; theme: Theme }) => ReactNode; svgRef?: React.Ref<SVGSVGElement> }) {
  const { w, h } = SIZES[frame.size];
  const t = TOKENS[frame.theme];
  const pad = 64;
  const subLines = wrap(frame.subtitle, 20, w - pad * 2 - 300).slice(0, 2);
  const headH = 150 + (subLines.length - 1) * 26;
  const foot = frame.footnote ? wrap(frame.footnote, 15, w - pad * 2).slice(0, 3) : [];
  const footH = foot.length ? foot.length * 22 + 26 : 30;
  return (
    <svg ref={svgRef} xmlns="http://www.w3.org/2000/svg" width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <defs>
        <radialGradient id="gx-glow" cx="0" cy="0" r="0.75">
          <stop offset="0" stopColor={t.glow} />
          <stop offset="1" stopColor={t.glow} stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width={w} height={h} fill={t.bg} />
      <rect width={w} height={h} fill="url(#gx-glow)" />
      <Txt x={pad} y={pad + 14} size={15} fill={t.brand} weight={800} spacing={2.4}>
        {frame.eyebrow.toUpperCase()}
      </Txt>
      <Txt x={pad} y={pad + 66} size={44} fill={t.text} weight={800} spacing={-0.8}>
        {clip(frame.title, 44, w - pad * 2 - 260, 800)}
      </Txt>
      {subLines.map((l, i) => (
        <Txt key={i} x={pad} y={pad + 104 + i * 26} size={20} fill={t.text2}>
          {l}
        </Txt>
      ))}
      {frame.stamp.split("\n").map((l, i) => (
        <Txt key={i} x={w - pad} y={pad + 52 + i * 24} size={15} fill={t.muted} anchor="end">
          {l}
        </Txt>
      ))}
      {body({ x: pad, y: pad + headH, w: w - pad * 2, h: h - pad * 2 - headH - footH, t, theme: frame.theme })}
      {foot.map((l, i) => (
        <Txt key={i} x={pad} y={h - pad + 8 - (foot.length - 1 - i) * 22} size={15} fill={t.muted}>
          {l}
        </Txt>
      ))}
    </svg>
  );
}

export type BarRow = { label: string; count: number; color?: string };

/** Ranked horizontal bars with the count and share at the end of each row. */
export function BarsBlock({ x, y, w, h, t, rows, total, title, format, showPct = true }: { x: number; y: number; w: number; h: number; t: Tokens; rows: (BarRow & { note?: string })[]; total: number; title: string; format?: Fmt; showPct?: boolean }) {
  const inner = { x: x + 32, y: y + 70, w: w - 64, h: h - 100 };
  const n = Math.max(1, rows.length);
  const rowH = Math.min(58, inner.h / n);
  const barH = Math.max(8, Math.min(30, rowH * 0.55));
  const labelW = Math.min(320, inner.w * 0.36);
  const valW = showPct ? 170 : 210;
  const trackW = inner.w - labelW - valW - 24;
  const max = Math.max(1, ...rows.map((r) => r.count));
  const fs = Math.max(12, Math.min(18, rowH * 0.38));
  return (
    <g>
      <Card x={x} y={y} w={w} h={h} t={t} />
      <Label x={x + 32} y={y + 44} t={t}>
        {title}
      </Label>
      {rows.map((r, i) => {
        const cy = inner.y + i * rowH + rowH / 2;
        const bw = Math.max(r.count ? 4 : 0, (r.count / max) * trackW);
        return (
          <g key={`${r.label}-${i}`}>
            <rect x={inner.x} y={cy - 6} width={12} height={12} rx={3} fill={r.color ?? t.text2} />
            <Txt x={inner.x + 22} y={cy + fs * 0.35} size={fs} fill={t.text} weight={700}>
              {clip(r.label, fs, labelW - 30, 700)}
            </Txt>
            <rect x={inner.x + labelW} y={cy - barH / 2} width={trackW} height={barH} rx={4} fill={t.track} />
            {bw ? <rect x={inner.x + labelW} y={cy - barH / 2} width={bw} height={barH} rx={4} fill={r.color ?? t.text2} /> : null}
            <Txt x={inner.x + inner.w} y={cy + fs * 0.35} size={fs} fill={t.text2} anchor="end">
              <tspan fontWeight={800} fill={t.text} fontSize={fs * 1.2}>
                {format ? formatValue(r.count, format) : fmt(r.count)}
              </tspan>
              {showPct && total ? `  ${pctText(r.count, total)}` : r.note ? `  ${r.note}` : ""}
            </Txt>
            <Hit x={inner.x - 6} y={cy - rowH / 2} w={inner.w + 12} h={rowH} tip={[r.label, tipValue(r.count, format), total ? `${pctText(r.count, total)} of the total` : "", r.note ?? "", i > 0 ? `#${i + 1} of ${rows.length}` : `Top of ${rows.length}`].filter(Boolean).join("\n")} />
          </g>
        );
      })}
    </g>
  );
}

/** A big number with a caption under it. */
export function HeroBlock({ x, y, w, h, t, label, big, small, caption, chips }: { x: number; y: number; w: number; h: number; t: Tokens; label: string; big: string; small?: string; caption: string; chips?: { color: string; text: string }[] }) {
  const size = Math.min(110, (w - 64) / Math.max(3, big.length * 0.62 + (small ? small.length * 0.3 : 0)));
  const lines = wrap(caption, 19, w - 64).slice(0, 4);
  return (
    <g>
      <Card x={x} y={y} w={w} h={h} t={t} />
      <Label x={x + 32} y={y + 44} t={t}>
        {label}
      </Label>
      <Txt x={x + 30} y={y + 60 + size} size={size} fill={t.text} weight={900} spacing={-size * 0.04}>
        {big}
        {small ? (
          <tspan fontSize={size * 0.45} fill={t.text2} fontWeight={800} dx={12}>
            {small}
          </tspan>
        ) : null}
      </Txt>
      {lines.map((l, i) => (
        <Txt key={i} x={x + 32} y={y + 100 + size + i * 27} size={19} fill={t.text2}>
          {l}
        </Txt>
      ))}
      {chips?.slice(0, 4).map((c, i) => {
        const cx = x + 32 + chips.slice(0, i).reduce((acc, z) => acc + textW(z.text, 15, 700) + 46, 0);
        const cy = y + 120 + size + lines.length * 27;
        if (cy + 34 > y + h) return null;
        return (
          <g key={c.text}>
            <rect x={cx} y={cy} width={textW(c.text, 15, 700) + 36} height={32} rx={16} fill={t.track} />
            <rect x={cx + 13} y={cy + 11} width={10} height={10} rx={3} fill={c.color} />
            <Txt x={cx + 29} y={cy + 21} size={15} fill={t.text2} weight={700}>
              {c.text}
            </Txt>
          </g>
        );
      })}
    </g>
  );
}

/** A 100% strip of every part, labelled inside wide segments, with a legend under it. */
export function StripBlock({ x, y, w, h, t, rows, title }: { x: number; y: number; w: number; h: number; t: Tokens; rows: BarRow[]; title: string }) {
  const total = rows.reduce((a, r) => a + r.count, 0) || 1;
  const sx = x + 32;
  const sw = w - 64;
  const sy = y + 66;
  let at = sx;
  const legendY = sy + 74;
  let lx = sx;
  let ly = legendY;
  return (
    <g>
      <Card x={x} y={y} w={w} h={h} t={t} />
      <Label x={x + 32} y={y + 44} t={t}>
        {title}
      </Label>
      {rows.map((r, i) => {
        const segW = (r.count / total) * sw;
        const gx = at;
        at += segW;
        if (segW <= 0) return null;
        const label = `${r.label} · ${fmt(r.count)}`;
        return (
          <g key={`${r.label}-${i}`}>
            <rect x={gx} y={sy} width={Math.max(0, segW - (i < rows.length - 1 ? 2 : 0))} height={46} rx={i === 0 || i === rows.length - 1 ? 6 : 0} fill={r.color ?? t.gray} />
            <Hit x={gx} y={sy} w={segW} h={46} tip={`${r.label}\n${fmt(r.count)}\n${pctText(r.count, total)} of the total`} />
            {textW(label, 15, 800) + 16 < segW ? (
              <Txt x={gx + segW / 2} y={sy + 29} size={15} fill="#ffffff" weight={800} anchor="middle">
                {label}
              </Txt>
            ) : null}
          </g>
        );
      })}
      {rows.map((r, i) => {
        const item = `${r.label} ${fmt(r.count)}`;
        const iw = textW(item, 16) + 40;
        if (lx + iw > sx + sw) {
          lx = sx;
          ly += 28;
        }
        const gx = lx;
        lx += iw;
        if (ly > y + h - 12) return null;
        return (
          <g key={`l-${r.label}-${i}`}>
            <rect x={gx} y={ly - 11} width={12} height={12} rx={3} fill={r.color ?? t.gray} />
            <Txt x={gx + 20} y={ly} size={16} fill={t.text2}>
              {item}
            </Txt>
          </g>
        );
      })}
    </g>
  );
}

/** Columns over time (joins per month), with the value on top of each. */
export function ColumnsBlock({ x, y, w, h, t, cols, title, color, format, trend = "none", timeline = false, partial }: { x: number; y: number; w: number; h: number; t: Tokens; cols: { label: string; count: number }[]; title: string; color: string; format?: Fmt; trend?: Trend; timeline?: boolean; partial?: PartialEnds }) {
  const inner = { x: x + 40, y: y + 80, w: w - 80, h: h - 140 };
  const n = Math.max(1, cols.length);
  const slot = inner.w / n;
  const bw = Math.min(64, slot * 0.68);
  const max = Math.max(1, ...cols.map((c) => c.count));
  const fs = Math.max(11, Math.min(15, slot * 0.22));
  // Crowded charts only label every few columns (and skip the values on top)
  const every = Math.max(1, Math.ceil((n * (Math.max(30, ...cols.map((c) => textW(c.label, Math.max(11, fs - 1)))) + 14)) / inner.w));
  const showValues = slot >= 30;
  const vals = cols.map((c) => c.count);
  const avg = vals.reduce((a, b) => a + b, 0) / Math.max(1, vals.length);
  const total = vals.reduce((a, b) => a + b, 0);
  const CX = (i: number) => inner.x + i * slot + slot / 2;
  const CY = (v: number) => inner.y + inner.h - (Math.max(0, v) / max) * (inner.h - 30);
  const showTrend = timeline && trend !== "none" && cols.length >= 3;
  const fit = showTrend && (trend === "line" || trend === "both") ? fitLine(vals, partial) : null;
  const ma = showTrend && (trend === "avg" || trend === "both") ? movingAverage(vals, maWindow(partial)) : null;
  return (
    <g>
      <Card x={x} y={y} w={w} h={h} t={t} />
      <Label x={x + 32} y={y + 44} t={t}>
        {title}
      </Label>
      {showTrend ? (
        <Txt x={x + w - 32} y={y + 44} size={15} fill={t.text2} weight={700} anchor="end">
          {trendWords(vals, partial)}
        </Txt>
      ) : null}
      <line x1={inner.x} x2={inner.x + inner.w} y1={inner.y + inner.h} y2={inner.y + inner.h} stroke={t.line} strokeWidth={1.5} />
      {cols.map((c, i) => {
        const bh = (c.count / max) * (inner.h - 30);
        const cx = inner.x + i * slot + slot / 2;
        return (
          <g key={c.label}>
            {bh > 0 ? <rect x={cx - bw / 2} y={inner.y + inner.h - bh} width={bw} height={bh} rx={4} fill={color} /> : null}
            {showValues ? (
              <Txt x={cx} y={inner.y + inner.h - bh - 8} size={fs} fill={t.text} weight={800} anchor="middle">
                {format ? formatValue(c.count, format) : fmt(c.count)}
              </Txt>
            ) : null}
            {i % every === 0 ? (
              <Txt x={cx} y={inner.y + inner.h + 22} size={Math.max(11, fs - 1)} fill={t.muted} anchor="middle">
                {c.label}
              </Txt>
            ) : null}
          </g>
        );
      })}
      {ma ? <polyline points={ma.map((v, i) => `${CX(i)},${CY(v)}`).join(" ")} fill="none" stroke={t.text} strokeOpacity={0.75} strokeWidth={2.5} strokeLinejoin="round" /> : null}
      {fit ? <line x1={CX(0)} y1={CY(fit.at(0))} x2={CX(cols.length - 1)} y2={CY(fit.at(cols.length - 1))} stroke={t.brand} strokeWidth={3} strokeDasharray="10 8" strokeLinecap="round" /> : null}
      {cols.map((c, i) => (
        <Hit
          key={`hit-${i}`}
          x={inner.x + i * slot}
          y={inner.y}
          w={slot}
          h={inner.h}
          tip={
            timeline
              ? `${seriesTip(c.label, c.count, i > 0 ? vals[i - 1] : undefined, avg, format)}${fit ? `\nTrend line: ${tipValue(fit.at(i), format)}` : ""}${ma ? `\nMoving average: ${tipValue(ma[i], format)}` : ""}`
              : [c.label, tipValue(c.count, format), total && !format ? `${pctText(c.count, total)} of the total` : ""].filter(Boolean).join("\n")
          }
        />
      ))}
    </g>
  );
}

/** A line over time (up to four series), with gridlines, the peak marked and a legend. */
export function LineBlock({ x, y, w, h, t, labels, series, title, theme, format, trend = "none", partial }: { x: number; y: number; w: number; h: number; t: Tokens; labels: string[]; series: { name: string; values: number[] }[]; title: string; theme: Theme; format?: Fmt; trend?: Trend; partial?: PartialEnds }) {
  const inner = { x: x + 70, y: y + 84, w: w - 110, h: h - 150 };
  const max = Math.max(1, ...series.flatMap((s) => s.values));
  const nice = (() => {
    const p = Math.pow(10, Math.floor(Math.log10(max)));
    const m = max / p;
    return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p;
  })();
  const X = (i: number) => inner.x + (labels.length <= 1 ? inner.w / 2 : (i / (labels.length - 1)) * inner.w);
  const Y = (v: number) => inner.y + inner.h - (v / nice) * inner.h;
  // Label every few points so the dates never run into each other
  const labelW = Math.max(40, ...labels.map((l) => textW(l, 13))) + 18;
  const every = Math.max(1, Math.ceil((labels.length * labelW) / inner.w));
  // Trend lines follow the first series
  const first = series[0]?.values ?? [];
  const showTrend = trend !== "none" && first.length >= 3 && series.length === 1;
  const fit = showTrend && (trend === "line" || trend === "both") ? fitLine(first, partial) : null;
  const ma = showTrend && (trend === "avg" || trend === "both") ? movingAverage(first, maWindow(partial)) : null;
  const avgs = series.map((s) => s.values.reduce((a, b) => a + b, 0) / Math.max(1, s.values.length));
  const slotW = labels.length > 1 ? inner.w / (labels.length - 1) : inner.w;
  return (
    <g>
      <Card x={x} y={y} w={w} h={h} t={t} />
      <Label x={x + 32} y={y + 44} t={t}>
        {title}
      </Label>
      {showTrend && series.length === 1 ? (
        <Txt x={x + w - 32} y={y + 44} size={15} fill={t.text2} weight={700} anchor="end">
          {trendWords(first, partial)}
        </Txt>
      ) : null}
      {series.length > 1
        ? series.map((s, si) => {
            const lx = x + w - 32 - series.slice(si).reduce((a, z) => a + textW(z.name, 15) + 40, 0);
            return (
              <g key={s.name}>
                <rect x={lx} y={y + 33} width={22} height={4} rx={2} fill={seriesColor(theme, si)} />
                <Txt x={lx + 28} y={y + 40} size={15} fill={t.text2}>
                  {s.name}
                </Txt>
              </g>
            );
          })
        : null}
      {[0, 0.25, 0.5, 0.75, 1].map((f) => (
        <g key={f}>
          <line x1={inner.x} x2={inner.x + inner.w} y1={Y(nice * f)} y2={Y(nice * f)} stroke={t.line} strokeWidth={1} strokeDasharray={f ? "4 6" : undefined} />
          <Txt x={inner.x - 12} y={Y(nice * f) + 5} size={13} fill={t.muted} anchor="end">
            {format ? formatValue(nice * f, format) : fmt(nice * f)}
          </Txt>
        </g>
      ))}
      {labels.map((l, i) =>
        i % every === 0 || (i === labels.length - 1 && i % every >= every / 2) ? (
          <Txt key={i} x={X(i)} y={inner.y + inner.h + 26} size={13} fill={t.muted} anchor="middle">
            {l}
          </Txt>
        ) : null,
      )}
      {series.map((s, si) => {
        const color = seriesColor(theme, si);
        const pts = s.values.map((v, i) => `${X(i)},${Y(v)}`).join(" ");
        const peak = s.values.indexOf(Math.max(...s.values));
        return (
          <g key={s.name}>
            {si === 0 ? <polygon points={`${X(0)},${Y(0)} ${pts} ${X(s.values.length - 1)},${Y(0)}`} fill={color} fillOpacity={0.14} /> : null}
            <polyline points={pts} fill="none" stroke={color} strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />
            {peak >= 0 && s.values[peak] > 0 ? (
              <g>
                <circle cx={X(peak)} cy={Y(s.values[peak])} r={6} fill={color} stroke={t.card} strokeWidth={2} />
                <Txt x={Math.min(Math.max(X(peak), inner.x + 30), inner.x + inner.w - 30)} y={Y(s.values[peak]) - 14} size={14} fill={t.text} weight={800} anchor="middle">
                  {format ? formatValue(s.values[peak], format) : fmt(s.values[peak])}
                </Txt>
              </g>
            ) : null}
          </g>
        );
      })}
      {ma ? <polyline points={ma.map((v, i) => `${X(i)},${Y(v)}`).join(" ")} fill="none" stroke={t.text} strokeOpacity={0.75} strokeWidth={2.5} strokeLinejoin="round" /> : null}
      {fit ? <line x1={X(0)} y1={Y(fit.at(0))} x2={X(first.length - 1)} y2={Y(fit.at(first.length - 1))} stroke={t.brand} strokeWidth={3} strokeDasharray="10 8" strokeLinecap="round" /> : null}
      {labels.map((l, i) => (
        <g key={`hit-${i}`} className="gx-pt">
          <line className="gx-guide" x1={X(i)} x2={X(i)} y1={inner.y} y2={inner.y + inner.h} stroke={t.text2} strokeWidth={1} strokeDasharray="3 4" opacity={0} />
          {series.map((s, si) => (
            <circle key={s.name} className="gx-dot" cx={X(i)} cy={Y(s.values[i] ?? 0)} r={6} fill={seriesColor(theme, si)} stroke={t.card} strokeWidth={2} opacity={0} />
          ))}
          <Hit
            x={X(i) - slotW / 2}
            y={inner.y}
            w={slotW}
            h={inner.h}
            tip={
              series.length === 1
                ? `${seriesTip(l, first[i] ?? 0, i > 0 ? first[i - 1] : undefined, avgs[0], format)}${fit ? `\nTrend line: ${tipValue(fit.at(i), format)}` : ""}${ma ? `\nMoving average: ${tipValue(ma[i], format)}` : ""}`
                : [l, ...series.map((s) => `${s.name}: ${tipValue(s.values[i] ?? 0, format)}`)].join("\n")
            }
          />
        </g>
      ))}
    </g>
  );
}

/** Small stat tiles in a row. */
export function TilesBlock({ x, y, w, h, t, tiles }: { x: number; y: number; w: number; h: number; t: Tokens; tiles: { label: string; value: string; note?: string }[] }) {
  const gap = 20;
  const tw = (w - gap * (tiles.length - 1)) / tiles.length;
  return (
    <g>
      {tiles.map((tile, i) => {
        const tx = x + i * (tw + gap);
        const vs = Math.min(54, tw / Math.max(3, tile.value.length * 0.62));
        return (
          <g key={tile.label}>
            <Card x={tx} y={y} w={tw} h={h} t={t} />
            <Txt x={tx + 24} y={y + 38} size={13} fill={t.text2} weight={800} spacing={1.6}>
              {clip(tile.label.toUpperCase(), 13, tw - 40, 800)}
            </Txt>
            <Txt x={tx + 22} y={y + 44 + vs} size={vs} fill={t.text} weight={900} spacing={-1}>
              {tile.value}
            </Txt>
            {tile.note ? (
              <Txt x={tx + 24} y={y + h - 22} size={14} fill={t.muted}>
                {clip(tile.note, 14, tw - 40)}
              </Txt>
            ) : null}
          </g>
        );
      })}
    </g>
  );
}

/** Heat table: one role group down the side, another across the top. */
export function HeatBlock({ x, y, w, h, t, rows, cols, cells, totals, title, accent, byColumn }: { x: number; y: number; w: number; h: number; t: Tokens; rows: string[]; cols: string[]; cells: number[][]; totals?: number[]; title: string; accent: string; byColumn?: boolean }) {
  const inner = { x: x + 32, y: y + 70, w: w - 64, h: h - 96 };
  const labelW = Math.min(280, inner.w * 0.26);
  const totalW = 110;
  const cw = (inner.w - labelW - totalW) / Math.max(1, cols.length);
  const headH = 46;
  const rh = Math.min(54, (inner.h - headH) / Math.max(1, rows.length));
  const max = Math.max(1, ...cells.flat());
  const colMax = cols.map((_, ci) => Math.max(1, ...cells.map((r) => r[ci] ?? 0)));
  const fs = Math.max(12, Math.min(17, rh * 0.36));
  // Tight grids (like 24 hours) show colour only; the numbers wouldn't fit
  const showNumbers = cw >= 52;
  return (
    <g>
      <Card x={x} y={y} w={w} h={h} t={t} />
      <Label x={x + 32} y={y + 44} t={t}>
        {title}
      </Label>
      {cols.map((c, ci) => (
        <Txt key={c} x={inner.x + labelW + ci * cw + cw / 2} y={inner.y + 26} size={Math.min(15, fs)} fill={t.text2} weight={800} anchor="middle">
          {/* Short labels (hours) may run into the empty columns beside them */}
          {c.length <= 5 ? c : clip(c, Math.min(15, fs), cw - 8, 800)}
        </Txt>
      ))}
      {totals ? (
        <Txt x={inner.x + inner.w - totalW / 2} y={inner.y + 26} size={Math.min(15, fs)} fill={t.text2} weight={800} anchor="middle">
          Total
        </Txt>
      ) : null}
      {rows.map((r, ri) => {
        const ry = inner.y + headH + ri * rh;
        return (
          <g key={r}>
            <Txt x={inner.x} y={ry + rh / 2 + fs * 0.35} size={fs} fill={t.text} weight={700}>
              {clip(r, fs, labelW - 12, 700)}
            </Txt>
            {cells[ri].map((n, ci) => {
              const heat = n / (byColumn ? colMax[ci] : max);
              return (
                <g key={ci}>
                  <rect x={inner.x + labelW + ci * cw + 2} y={ry + 2} width={cw - 4} height={rh - 4} rx={8} fill={accent} fillOpacity={n ? 0.12 + heat * 0.78 : 0.04} />
                  <Hit x={inner.x + labelW + ci * cw} y={ry} w={cw} h={rh} tip={`${r} · ${cols[ci] || (cols.length === 24 ? HOURS24[ci] : "")}\n${fmt(n)}${totals?.[ri] ? `\n${pctText(n, totals[ri])} of the row` : ""}`} />
                  {showNumbers ? (
                    <Txt x={inner.x + labelW + ci * cw + cw / 2} y={ry + rh / 2 + fs * 0.35} size={fs} fill={heat > 0.55 ? "#ffffff" : t.text} weight={800} anchor="middle">
                      {n ? fmt(n) : "·"}
                    </Txt>
                  ) : null}
                </g>
              );
            })}
            {totals ? (
              <Txt x={inner.x + inner.w - totalW / 2} y={ry + rh / 2 + fs * 0.35} size={fs} fill={t.text} weight={800} anchor="middle">
                {fmt(totals[ri])}
              </Txt>
            ) : null}
          </g>
        );
      })}
    </g>
  );
}

/** Two counts side by side as a split bar (for a ratio). */
export function SplitBlock({ x, y, w, h, t, a, b, title }: { x: number; y: number; w: number; h: number; t: Tokens; a: BarRow; b: BarRow; title: string }) {
  const total = a.count + b.count || 1;
  const sw = w - 64;
  const aw = (a.count / total) * sw;
  return (
    <g>
      <Card x={x} y={y} w={w} h={h} t={t} />
      <Label x={x + 32} y={y + 44} t={t}>
        {title}
      </Label>
      <rect x={x + 32} y={y + 70} width={Math.max(0, aw - 2)} height={56} rx={6} fill={a.color ?? t.gray} />
      <rect x={x + 32 + aw} y={y + 70} width={Math.max(0, sw - aw)} height={56} rx={6} fill={b.color ?? t.gray} />
      {aw > 160 ? (
        <Txt x={x + 32 + aw / 2} y={y + 105} size={18} fill="#ffffff" weight={800} anchor="middle">
          {`${clip(a.label, 18, aw - 80, 800)} · ${fmt(a.count)}`}
        </Txt>
      ) : null}
      {sw - aw > 160 ? (
        <Txt x={x + 32 + aw + (sw - aw) / 2} y={y + 105} size={18} fill="#ffffff" weight={800} anchor="middle">
          {`${clip(b.label, 18, sw - aw - 80, 800)} · ${fmt(b.count)}`}
        </Txt>
      ) : null}
      <Txt x={x + 32} y={y + 160} size={17} fill={t.text2}>
        {`${a.label}: ${fmt(a.count)} (${pctText(a.count, total)})   ·   ${b.label}: ${fmt(b.count)} (${pctText(b.count, total)})`}
      </Txt>
    </g>
  );
}

/** SVG → PNG at 2× (sharp in Discord), as a Blob. */
export async function svgToPng(svg: SVGSVGElement, scale = 2): Promise<Blob> {
  const w = Number(svg.getAttribute("width"));
  const h = Number(svg.getAttribute("height"));
  const xml = new XMLSerializer().serializeToString(svg);
  const img = new Image();
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`;
  await img.decode();
  const canvas = document.createElement("canvas");
  canvas.width = w * scale;
  canvas.height = h * scale;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(scale, scale);
  ctx.drawImage(img, 0, 0, w, h);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't make the image."))), "image/png"));
}
