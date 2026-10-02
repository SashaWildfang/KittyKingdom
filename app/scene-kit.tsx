"use client";

import type { CSSProperties, ReactNode } from "react";

// Shared drawing kit for the banner scenes: colour mixing, gradients and shaded building blocks.
// Scenes are drawn on a 1000×220 canvas; everything important sits in x 260–740, y 60–215 (the 6:1 cover crops the top) so it
// shows in every placement (6:1 Social cover, 3:1 cards, 2.4:1 store tiles).

export const W = 1000;
export const H = 220;

/** Seeded 0..1 random. */
export const R = (i: number, s = 1) => {
  const x = Math.sin(i * 12.9898 + s * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

function rgb(c: string): [number, number, number] {
  let s = c.replace("#", "");
  if (s.length === 3) s = s.split("").map((x) => x + x).join("");
  const n = parseInt(s.slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Blend two hex colours (t = 0 → a, 1 → b). */
export function mix(a: string, b: string, t: number) {
  const A = rgb(a);
  const B = rgb(b);
  return `#${A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, "0")).join("")}`;
}
export const lt = (c: string, t: number) => mix(c, "#ffffff", t);
export const dk = (c: string, t: number) => mix(c, "#000000", t);
/** Perceived brightness 0..1. */
export function lum(c: string) {
  const [r, g, b] = rgb(c);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

/** Animation class + timing as props. */
export const anim = (name: string, dur: number, delay = 0, vars?: Record<string, string | number>): { className: string; style: CSSProperties } => ({
  className: name,
  style: { animationDuration: `${dur}s`, animationDelay: `${delay}s`, ...(vars ?? {}) } as CSSProperties,
});

type Stop = [number, string, number?];
const stops = (s: Stop[]) => s.map(([o, c, op], i) => <stop key={i} offset={o} stopColor={c} stopOpacity={op ?? 1} />);

export function LG({ id, s, x1 = 0, y1 = 0, x2 = 0, y2 = 1, user }: { id: string; s: Stop[]; x1?: number; y1?: number; x2?: number; y2?: number; user?: boolean }) {
  return (
    <linearGradient id={id} x1={x1} y1={y1} x2={x2} y2={y2} gradientUnits={user ? "userSpaceOnUse" : undefined}>
      {stops(s)}
    </linearGradient>
  );
}

export function RG({ id, s, cx = 0.5, cy = 0.5, r = 0.5, fx, fy }: { id: string; s: Stop[]; cx?: number; cy?: number; r?: number; fx?: number; fy?: number }) {
  return (
    <radialGradient id={id} cx={cx} cy={cy} r={r} fx={fx} fy={fy}>
      {stops(s)}
    </radialGradient>
  );
}

export const url = (id: string) => `url(#${id})`;

/** Sky: three-stop gradient with a soft glow along the horizon. */
export function Sky({ id, top, bottom, mid, horizon, glowY = 0.75 }: { id: string; top: string; bottom: string; mid?: string; horizon?: string; glowY?: number }) {
  return (
    <>
      <defs>
        <LG id={`${id}sky`} s={[[0, top], [0.55, mid ?? mix(top, bottom, 0.55)], [1, bottom]]} />
        {horizon ? <RG id={`${id}hz`} cx={0.5} cy={1} r={0.75} s={[[0, horizon, 0.55], [1, horizon, 0]]} /> : null}
      </defs>
      <rect width={W} height={H} fill={url(`${id}sky`)} />
      {horizon ? <rect y={H * glowY - 160} width={W} height="240" fill={url(`${id}hz`)} /> : null}
    </>
  );
}

/** Soft darkening at the edges, so the middle reads first. */
export function Vignette({ id, strength = 0.35 }: { id: string; strength?: number }) {
  return (
    <>
      <defs>
        <RG id={`${id}vig`} r={0.75} s={[[0.55, "#000", 0], [1, "#000", strength]]} />
      </defs>
      <rect width={W} height={H} fill={url(`${id}vig`)} />
    </>
  );
}

/** Twinkling stars; a few bigger ones get a cross flare. */
export function Stars({ n, top = 130, seed = 1, color = "#ffffff" }: { n: number; top?: number; seed?: number; color?: string }) {
  return (
    <g>
      {Array.from({ length: n }, (_, i) => {
        const x = R(i, seed) * W;
        const y = R(i, seed + 1) * top;
        const big = R(i, seed + 2) > 0.9;
        const a = anim("sc-tw", 2 + R(i, seed + 3) * 3, -R(i, seed + 4) * 4);
        return big ? (
          <g key={i} {...a}>
            <circle cx={x} cy={y} r="3.2" fill={color} opacity="0.18" />
            <path d={`M${x} ${y - 5} L${x + 0.7} ${y - 0.7} L${x + 5} ${y} L${x + 0.7} ${y + 0.7} L${x} ${y + 5} L${x - 0.7} ${y + 0.7} L${x - 5} ${y} L${x - 0.7} ${y - 0.7} Z`} fill={color} />
          </g>
        ) : (
          <circle key={i} cx={x} cy={y} r={0.5 + R(i, seed + 2) * 1.1} fill={color} {...a} />
        );
      })}
    </g>
  );
}

/** A shaded sun or moon with layered glow. */
export function Orb({ id, x, y, r, color, moon, rays }: { id: string; x: number; y: number; r: number; color: string; moon?: boolean; rays?: boolean }) {
  const k = `${id}orb${Math.round(x)}`;
  return (
    <g>
      <defs>
        <RG id={`${k}h`} s={[[0, color, 0.42], [0.35, color, 0.14], [1, color, 0]]} />
        <RG id={`${k}b`} cx={0.4} cy={0.38} r={0.62} s={moon ? [[0, lt(color, 0.6)], [0.7, color], [1, dk(color, 0.18)]] : [[0, lt(color, 0.85)], [0.6, lt(color, 0.25)], [1, color]]} />
      </defs>
      <circle cx={x} cy={y} r={r * 5} fill={url(`${k}h`)} {...anim("sc-breathe", 6)} />
      {rays ? (
        <g {...anim("sc-spin", 90)}>
          {Array.from({ length: 14 }, (_, i) => (
            <path key={i} d={`M${x} ${y} L${x - 9} ${y - r * 4.2} L${x + 9} ${y - r * 4.2} Z`} fill={color} opacity="0.07" transform={`rotate(${i * (360 / 14)} ${x} ${y})`} />
          ))}
        </g>
      ) : null}
      <circle cx={x} cy={y} r={r * 1.35} fill={color} opacity="0.22" />
      <circle cx={x} cy={y} r={r} fill={url(`${k}b`)} />
      {moon ? (
        <g fill={dk(color, 0.22)} opacity="0.45">
          <circle cx={x - r * 0.3} cy={y - r * 0.2} r={r * 0.2} />
          <circle cx={x + r * 0.28} cy={y + r * 0.3} r={r * 0.14} />
          <circle cx={x + r * 0.2} cy={y - r * 0.42} r={r * 0.09} />
          <circle cx={x - r * 0.15} cy={y + r * 0.45} r={r * 0.08} />
          <ellipse cx={x + r * 0.45} cy={y - r * 0.05} rx={r * 0.12} ry={r * 0.18} />
        </g>
      ) : null}
    </g>
  );
}

/** Gradients used by Cloud (each puff shaded on its own: lit top, shadowed base). */
export function CloudDefs({ id, color, shade, light }: { id: string; color: string; shade: string; light?: string }) {
  return (
    <defs>
      <LG id={`${id}cl`} s={[[0, light ?? lt(color, 0.5)], [0.5, color], [1, shade]]} />
      <LG id={`${id}clb`} s={[[0, color, 0], [1, shade, 0.9]]} />
    </defs>
  );
}

/** A fluffy cumulus cloud made of shaded puffs. */
export function Cloud({ id, x, y, s, seed = 1, opacity = 1 }: { id: string; x: number; y: number; s: number; seed?: number; opacity?: number }) {
  const puffs: [number, number, number][] = [
    [-34, 6, 16],
    [-14, -6, 22],
    [10, -14, 27],
    [34, -4, 21],
    [52, 6, 15],
    [-2, 6, 20],
    [24, 8, 18],
  ];
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} opacity={opacity}>
      {puffs.map(([px, py, pr], i) => (
        <circle key={i} cx={px + (R(i, seed) - 0.5) * 6} cy={py + (R(i, seed + 1) - 0.5) * 4} r={pr * (0.9 + R(i, seed + 2) * 0.2)} fill={url(`${id}cl`)} />
      ))}
      <ellipse cx="9" cy="16" rx="50" ry="9" fill={url(`${id}clb`)} />
    </g>
  );
}

/** A long thin cloud streak (sunset bands, mist past the moon). */
export function Streak({ x, y, w, h, color, opacity = 0.5 }: { x: number; y: number; w: number; h: number; color: string; opacity?: number }) {
  return <rect x={x} y={y} width={w} height={h} rx={h / 2} fill={color} opacity={opacity} />;
}

/** A rolling-hill path across the canvas. */
export function hillPath(y: number, amp: number, seed: number, waves = 3, bottom = H) {
  const pts: string[] = [];
  const n = 24;
  for (let i = 0; i <= n; i++) {
    const x = -20 + (i / n) * (W + 40);
    const v = Math.sin((i / n) * Math.PI * waves + seed) * 0.6 + Math.sin((i / n) * Math.PI * waves * 2.3 + seed * 2) * 0.4;
    pts.push(`${x.toFixed(1)} ${(y - v * amp).toFixed(1)}`);
  }
  // Smooth with a Catmull-Rom-ish pass using quadratic midpoints
  const P = pts.map((p) => p.split(" ").map(Number));
  let d = `M${P[0][0]} ${P[0][1]}`;
  for (let i = 1; i < P.length; i++) {
    const mx = (P[i - 1][0] + P[i][0]) / 2;
    const my = (P[i - 1][1] + P[i][1]) / 2;
    d += ` Q${P[i - 1][0]} ${P[i - 1][1]} ${mx} ${my}`;
  }
  d += ` L${W + 20} ${bottom} L-20 ${bottom} Z`;
  return d;
}

/** Height of hillPath at x (to sit things on top of a hill). */
export function hillY(x: number, y: number, amp: number, seed: number, waves = 3) {
  const t = (x + 20) / (W + 40);
  const v = Math.sin(t * Math.PI * waves + seed) * 0.6 + Math.sin(t * Math.PI * waves * 2.3 + seed * 2) * 0.4;
  return y - v * amp;
}

/** The top edge only of hillPath (for rim light strokes). */
export const hillEdge = (y: number, amp: number, seed: number, waves = 3) => hillPath(y, amp, seed, waves).split(" L")[0];

/** A shaded hill: gradient body plus a lit rim along the crest. */
export function Hill({ id, k, y, amp, seed, waves = 3, color, rim, rimOpacity = 0.45, shade = 0.3 }: { id: string; k: string; y: number; amp: number; seed: number; waves?: number; color: string; rim?: string; rimOpacity?: number; shade?: number }) {
  return (
    <g>
      <defs>
        <LG id={`${id}${k}`} s={[[0, lt(color, 0.06)], [0.5, color], [1, dk(color, shade)]]} />
      </defs>
      <path d={hillPath(y, amp, seed, waves)} fill={url(`${id}${k}`)} />
      {rim ? <path d={hillEdge(y, amp, seed, waves)} fill="none" stroke={rim} strokeWidth="1.6" opacity={rimOpacity} /> : null}
    </g>
  );
}

/** A band of mist drifting sideways. */
export function Mist({ id, k, y, h, color, opacity = 0.35, dur = 18 }: { id: string; k: string; y: number; h: number; color: string; opacity?: number; dur?: number }) {
  return (
    <g {...anim("sc-drift", dur)}>
      <defs>
        <LG id={`${id}${k}`} s={[[0, color, 0], [0.5, color, opacity], [1, color, 0]]} />
      </defs>
      <rect x="-60" y={y} width={W + 120} height={h} fill={url(`${id}${k}`)} />
    </g>
  );
}

/** A two-tone pine (lit left half, shaded right half), optionally snow-laden. */
export function Pine({ x, base, h, color, light, snow }: { x: number; base: number; h: number; color: string; light: string; snow?: string }) {
  const w = h * 0.5;
  const tiers = 4;
  const parts: ReactNode[] = [];
  parts.push(<rect key="t" x={x - w * 0.05} y={base - h * 0.14} width={w * 0.1} height={h * 0.14} fill={dk(color, 0.35)} />);
  for (let k = 0; k < tiers; k++) {
    const top = base - h + k * h * 0.2;
    const bot = top + h * 0.34;
    const half = (w * (0.34 + k * 0.2)) / 2;
    const droop = h * 0.04;
    parts.push(<path key={`d${k}`} d={`M${x} ${top} L${x + half} ${bot} Q${x + half * 0.5} ${bot - droop} ${x} ${bot + droop * 0.3} Q${x - half * 0.5} ${bot - droop} ${x - half} ${bot} Z`} fill={color} />);
    parts.push(<path key={`l${k}`} d={`M${x} ${top} L${x} ${bot + droop * 0.3} Q${x - half * 0.5} ${bot - droop} ${x - half} ${bot} Z`} fill={light} />);
    if (snow)
      parts.push(
        <path key={`s${k}`} d={`M${x} ${top} L${x - half * 0.55} ${top + (bot - top) * 0.55} Q${x - half * 0.2} ${top + (bot - top) * 0.45} ${x} ${top + (bot - top) * 0.55} Q${x + half * 0.25} ${top + (bot - top) * 0.45} ${x + half * 0.5} ${top + (bot - top) * 0.5} Z`} fill={snow} opacity="0.92" />,
      );
  }
  return <g>{parts}</g>;
}

/** A leafy round tree with a shaded canopy. */
export function RoundTree({ id, x, base, h, seed }: { id: string; x: number; base: number; h: number; seed: number }) {
  const r = h * 0.28;
  const blobs: [number, number, number][] = [
    [0, -h * 0.68, r],
    [-r * 0.8, -h * 0.52, r * 0.8],
    [r * 0.85, -h * 0.5, r * 0.85],
    [-r * 0.2, -h * 0.42, r * 0.85],
    [r * 0.3, -h * 0.82, r * 0.7],
  ];
  return (
    <g>
      <path d={`M${x - h * 0.035} ${base} L${x - h * 0.02} ${base - h * 0.45} L${x + h * 0.02} ${base - h * 0.45} L${x + h * 0.04} ${base} Z`} fill={url(`${id}trunk`)} />
      {blobs.map(([bx, by, br], i) => (
        <circle key={i} cx={x + bx + (R(i, seed) - 0.5) * r * 0.2} cy={base + by} r={br} fill={url(`${id}leaf`)} />
      ))}
    </g>
  );
}

/** Wave strip twice as wide as the canvas (scroll it by `period` multiples for an endless loop). */
export function wavePath(y: number, amp: number, period: number, bottom = H) {
  let d = `M-${period} ${y}`;
  for (let x = -period; x < W * 2; x += period) d += ` q${period / 4} ${-amp} ${period / 2} 0 t${period / 2} 0`;
  return `${d} L${W * 2} ${bottom} L-${period} ${bottom} Z`;
}
export const waveEdge = (y: number, amp: number, period: number) => wavePath(y, amp, period).split(" L")[0];

/** Flying bird (two flapping wing strokes). */
export function Bird({ x, y, s, color, k }: { x: number; y: number; s: number; color: string; k: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <g {...anim("sc-birds", 26 + k * 6, -k * 9)}>
        <path {...anim("sc-flap", 0.45 + k * 0.07)} d="M-8 0 Q-4 -5 0 0 Q4 -5 8 0" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      </g>
    </g>
  );
}
