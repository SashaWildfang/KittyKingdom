"use client";

import { useId, type ReactNode } from "react";
import type { ThemeSpec } from "../lib/cosmetics";
import { dk, lt, mix, R } from "./scene-kit";

// Illustrated backdrops for profile themes: a soft motif layer drawn behind the page.
// Canvas 400×240, cropped to fill; kept low-contrast so profile text always reads on top.

const VW = 400;
const VH = 240;

type Art = (t: ThemeSpec, id: string) => ReactNode;
const u = (id: string) => `url(#${id})`;

const star = (x: number, y: number, r: number, c: string, k: number) => <path key={k} d={`M${x} ${y - r} L${x + r * 0.25} ${y - r * 0.25} L${x + r} ${y} L${x + r * 0.25} ${y + r * 0.25} L${x} ${y + r} L${x - r * 0.25} ${y + r * 0.25} L${x - r} ${y} L${x - r * 0.25} ${y - r * 0.25} Z`} fill={c} />;
const dots = (n: number, seed: number, c: string, maxR = 1.2, top = VH) =>
  Array.from({ length: n }, (_, i) => <circle key={i} cx={R(i, seed) * VW} cy={R(i, seed + 1) * top} r={0.3 + R(i, seed + 2) * maxR} fill={c} opacity={0.3 + R(i, seed + 3) * 0.7} />);

const ARTS: Record<string, Art> = {
  stars: (t, id) => (
    <>
      <defs>
        <radialGradient id={`${id}m`} cx="0.4" cy="0.35" r="0.7">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor={lt(t.accent, 0.4)} />
        </radialGradient>
        <linearGradient id={`${id}w`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={t.accent} stopOpacity="0" />
          <stop offset="0.5" stopColor={t.accent} stopOpacity="0.22" />
          <stop offset="1" stopColor={t.accent} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d="M-20 200 C100 120 240 140 420 20 L420 70 C260 170 120 170 -20 250 Z" fill={u(`${id}w`)} />
      {dots(140, 3, "#fff")}
      {Array.from({ length: 10 }, (_, i) => star(R(i, 9) * VW, R(i, 10) * VH, 2 + R(i, 11) * 2.5, "#fff", i))}
      <circle cx="330" cy="50" r="40" fill={t.accent} opacity="0.12" />
      <circle cx="330" cy="50" r="18" fill={u(`${id}m`)} />
      <circle cx="338" cy="44" r="15" fill={t.bg[0]} opacity="0.92" />
    </>
  ),
  crystals: (t, id) => {
    const gem = (x: number, y: number, s: number, rot: number, k: number) => (
      <g key={k} transform={`translate(${x} ${y}) rotate(${rot}) scale(${s})`}>
        <path d="M0 -40 L14 -14 L10 30 L0 40 L-10 30 L-14 -14 Z" fill={t.accent} opacity="0.32" />
        <path d="M0 -40 L14 -14 L0 -6 Z" fill="#fff" opacity="0.4" />
        <path d="M0 -40 L0 -6 L-14 -14 Z" fill="#fff" opacity="0.18" />
        <path d="M14 -14 L10 30 L0 40 L0 -6 Z" fill={dk(t.bg[2], 0.3)} opacity="0.5" />
        <path d="M0 -40 L14 -14 L10 30 L0 40 L-10 30 L-14 -14 Z" fill="none" stroke={lt(t.accent, 0.5)} strokeWidth="0.8" opacity="0.6" />
      </g>
    );
    return (
      <>
        {[[30, 220, 1.1, -20], [70, 230, 0.8, 10], [6, 190, 0.6, -40], [370, 30, 0.9, 160], [340, 10, 0.6, 200], [395, 70, 0.55, 130]].map(([x, y, s, r], i) => gem(x, y, s, r, i))}
        {Array.from({ length: 16 }, (_, i) => star(R(i, 5) * VW, R(i, 6) * VH, 1.5 + R(i, 7) * 2, lt(t.accent, 0.6), i))}
      </>
    );
  },
  leaves: (t, id) => {
    const leaf = (x: number, y: number, s: number, r: number, k: number) => (
      <g key={k} transform={`translate(${x} ${y}) rotate(${r}) scale(${s})`}>
        <path d="M0 0 C10 -16 34 -18 48 -4 C34 10 12 12 0 0 Z" fill={mix(t.bg[2], "#000", 0.25)} />
        <path d="M0 0 C10 -16 34 -18 48 -4 C30 -6 14 -4 0 0 Z" fill={lt(t.bg[2], 0.15)} />
        <path d="M0 0 L46 -4" stroke={dk(t.bg[2], 0.4)} strokeWidth="0.8" />
      </g>
    );
    return (
      <>
        <defs>
          <linearGradient id={`${id}r`} x1="0" y1="0" x2="0.3" y2="1">
            <stop offset="0" stopColor={t.accent} stopOpacity="0.25" />
            <stop offset="1" stopColor={t.accent} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[60, 120, 180].map((x, i) => (
          <path key={x} d={`M${x} -10 L${x + 30} -10 L${x + 120} ${VH} L${x + 50} ${VH} Z`} fill={u(`${id}r`)} opacity={0.6 - i * 0.12} />
        ))}
        {[[-10, 20, 1.3, 20], [0, 50, 1, 50], [-14, 90, 0.9, 10], [410, 200, 1.3, 200], [400, 170, 1, 230], [414, 230, 0.9, 170], [10, 230, 0.8, -30]].map(([x, y, s, r], i) => leaf(x, y, s, r, i))}
        {Array.from({ length: 22 }, (_, i) => (
          <circle key={i} cx={R(i, 3) * VW} cy={R(i, 4) * VH} r={1 + R(i, 5) * 1.6} fill={t.accent} opacity={0.35 + R(i, 6) * 0.5} />
        ))}
      </>
    );
  },
  deepsea: (t, id) => (
    <>
      <defs>
        <linearGradient id={`${id}r`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={t.accent} stopOpacity="0.3" />
          <stop offset="1" stopColor={t.accent} stopOpacity="0" />
        </linearGradient>
      </defs>
      {[90, 160, 230, 300].map((x, i) => (
        <path key={x} d={`M${x} -10 L${x + 22} -10 L${x + 70 + i * 6} ${VH} L${x + 20} ${VH} Z`} fill={u(`${id}r`)} />
      ))}
      {Array.from({ length: 6 }, (_, i) => {
        const x = i < 3 ? 10 + i * 18 : 340 + (i - 3) * 20;
        const h = 60 + R(i, 3) * 70;
        return <path key={i} d={`M${x} ${VH} C${x - 12} ${VH - h * 0.3} ${x + 12} ${VH - h * 0.6} ${x} ${VH - h}`} fill="none" stroke={dk(t.bg[2], 0.2)} strokeWidth="6" strokeLinecap="round" opacity="0.7" />;
      })}
      {Array.from({ length: 24 }, (_, i) => (
        <g key={i}>
          <circle cx={R(i, 7) * VW} cy={R(i, 8) * VH} r={1.5 + R(i, 9) * 3.5} fill="none" stroke={lt(t.accent, 0.4)} strokeWidth="0.8" opacity="0.6" />
          <circle cx={R(i, 7) * VW - 1} cy={R(i, 8) * VH - 1} r="0.7" fill="#fff" opacity="0.6" />
        </g>
      ))}
    </>
  ),
  sunset: (t, id) => (
    <>
      <defs>
        <linearGradient id={`${id}s`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffe08a" />
          <stop offset="1" stopColor={t.accent} />
        </linearGradient>
        <mask id={`${id}c`}>
          <rect width={VW} height={VH} fill="#fff" />
          {[0, 1, 2, 3, 4].map((i) => (
            <rect key={i} y={190 + i * 9} width={VW} height={2 + i * 1.2} fill="#000" />
          ))}
        </mask>
      </defs>
      <circle cx="200" cy="215" r="120" fill={t.accent} opacity="0.12" />
      <circle cx="200" cy="215" r="60" fill={u(`${id}s`)} mask={u(`${id}c`)} opacity="0.7" />
      {[[40, 120, 140], [250, 90, 170], [100, 60, 120], [300, 150, 100]].map(([x, y, w], i) => (
        <rect key={i} x={x} y={y} width={w} height={5 + (i % 2) * 3} rx="4" fill={lt(t.accent, 0.3)} opacity="0.18" />
      ))}
      {dots(40, 11, "#fff", 0.9, 120)}
    </>
  ),
  lavender: (t) => {
    const sprig = (x: number, y: number, s: number, r: number, k: number) => (
      <g key={k} transform={`translate(${x} ${y}) rotate(${r}) scale(${s})`}>
        <path d="M0 0 Q2 -30 0 -60" stroke={mix(t.bg[2], "#5f8f4e", 0.6)} strokeWidth="1.6" fill="none" />
        {Array.from({ length: 9 }, (_, i) => (
          <ellipse key={i} cx={i % 2 ? 2.5 : -2.5} cy={-30 - i * 4} rx="3" ry="4.2" fill={i % 3 ? t.accent : lt(t.accent, 0.35)} opacity="0.85" />
        ))}
      </g>
    );
    return (
      <>
        {[[20, 250, 1.4, -14], [40, 250, 1.1, -4], [6, 250, 1, -24], [380, 250, 1.4, 14], [360, 250, 1.1, 4], [396, 250, 1, 22]].map(([x, y, s, r], i) => sprig(x, y, s, r, i))}
        {Array.from({ length: 18 }, (_, i) => star(R(i, 5) * VW, R(i, 6) * VH * 0.8, 1.4 + R(i, 7) * 2, lt(t.accent, 0.5), i))}
      </>
    );
  },
  ribbons: (t, id) => (
    <>
      <defs>
        <linearGradient id={`${id}a`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={t.accent} stopOpacity="0" />
          <stop offset="0.5" stopColor={t.accent} stopOpacity="0.4" />
          <stop offset="1" stopColor={t.accent} stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${id}b`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={lt(t.bg[2], 0.3)} stopOpacity="0" />
          <stop offset="0.5" stopColor={lt(t.bg[2], 0.3)} stopOpacity="0.45" />
          <stop offset="1" stopColor={lt(t.bg[2], 0.3)} stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0, 1, 2, 3].map((i) => (
        <path key={i} d={`M-20 ${150 + i * 18} C80 ${90 + i * 22} 200 ${220 - i * 10} 420 ${110 + i * 20}`} fill="none" stroke={u(i % 2 ? `${id}b` : `${id}a`)} strokeWidth={14 - i * 2.5} strokeLinecap="round" />
      ))}
      {[0, 1].map((i) => (
        <path key={i} d={`M-20 ${60 + i * 16} C120 ${10 + i * 20} 260 ${120 - i * 10} 420 ${40 + i * 12}`} fill="none" stroke={u(`${id}b`)} strokeWidth={6 - i * 2} />
      ))}
    </>
  ),
  filigree: (t, id) => {
    const corner = (tr: string, k: number) => (
      <g key={k} transform={tr} fill="none" stroke={u(`${id}g`)} strokeWidth="1.6" strokeLinecap="round">
        <path d="M0 0 C30 4 50 20 56 50 M0 0 C4 30 20 50 50 56" />
        <path d="M14 4 C30 14 34 30 30 40 C24 32 18 30 10 30 M4 14 C14 30 30 34 40 30" />
        <circle cx="48" cy="48" r="4" />
        <path d="M24 24 l6 -10 l6 10 l-6 10 Z" fill={u(`${id}g`)} />
      </g>
    );
    return (
      <>
        <defs>
          <linearGradient id={`${id}g`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#fff6c9" />
            <stop offset="0.5" stopColor={t.accent} />
            <stop offset="1" stopColor={dk(t.accent, 0.4)} />
          </linearGradient>
          <pattern id={`${id}p`} width="24" height="24" patternUnits="userSpaceOnUse">
            <path d="M12 0 L24 12 L12 24 L0 12 Z" fill="none" stroke={t.accent} strokeWidth="0.4" opacity="0.3" />
          </pattern>
        </defs>
        <rect width={VW} height={VH} fill={u(`${id}p`)} />
        {corner("translate(8 8)", 0)}
        {corner(`translate(${VW - 8} 8) scale(-1 1)`, 1)}
        {corner(`translate(8 ${VH - 8}) scale(1 -1)`, 2)}
        {corner(`translate(${VW - 8} ${VH - 8}) scale(-1 -1)`, 3)}
      </>
    );
  },
  cyber: (t, id) => (
    <>
      <defs>
        <linearGradient id={`${id}g`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={t.accent} stopOpacity="0" />
          <stop offset="1" stopColor={t.accent} stopOpacity="0.55" />
        </linearGradient>
        <pattern id={`${id}s`} width="4" height="4" patternUnits="userSpaceOnUse">
          <rect width="4" height="1" fill="#000" opacity="0.18" />
        </pattern>
      </defs>
      <g stroke={u(`${id}g`)} strokeWidth="0.8">
        {Array.from({ length: 21 }, (_, i) => (
          <line key={i} x1="200" y1="150" x2={-400 + i * 40} y2={VH} />
        ))}
        {Array.from({ length: 8 }, (_, i) => (
          <line key={i} x1="0" x2={VW} y1={152 + Math.pow(i + 1, 1.8) * 1.6} y2={152 + Math.pow(i + 1, 1.8) * 1.6} />
        ))}
      </g>
      <line x1="0" x2={VW} y1="150" y2="150" stroke={t.accent} strokeWidth="1" opacity="0.6" />
      <circle cx="200" cy="150" r="70" fill={t.accent} opacity="0.08" />
      {Array.from({ length: 12 }, (_, i) => (
        <rect key={i} x={R(i, 3) * VW} y={R(i, 4) * 120} width={10 + R(i, 5) * 30} height="1.2" fill={i % 2 ? t.accent : "#00e5ff"} opacity="0.35" />
      ))}
      <rect width={VW} height={VH} fill={u(`${id}s`)} />
    </>
  ),
  clouds: (t, id) => {
    const cloud = (x: number, y: number, s: number, k: number) => (
      <g key={k} transform={`translate(${x} ${y}) scale(${s})`}>
        {[[-20, 4, 14], [0, -6, 20], [22, 0, 16], [8, 6, 16]].map(([cx, cy, r], i) => (
          <circle key={i} cx={cx} cy={cy} r={r} fill={u(`${id}c`)} />
        ))}
      </g>
    );
    return (
      <>
        <defs>
          <linearGradient id={`${id}c`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ffffff" stopOpacity="0.4" />
            <stop offset="1" stopColor={t.accent} stopOpacity="0.15" />
          </linearGradient>
        </defs>
        {[[40, 50, 1.2], [340, 40, 1], [300, 200, 1.4], [60, 210, 1.1], [200, 120, 0.7]].map(([x, y, s], i) => cloud(x, y, s, i))}
        {Array.from({ length: 20 }, (_, i) => star(R(i, 5) * VW, R(i, 6) * VH, 1.4 + R(i, 7) * 2.4, "#fff", i))}
      </>
    );
  },
  noir: (t, id) => (
    <>
      <defs>
        <pattern id={`${id}p`} width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
          <rect width="1" height="10" fill="#fff" opacity="0.05" />
        </pattern>
        <radialGradient id={`${id}l`} cx="0.5" cy="0" r="0.8">
          <stop offset="0" stopColor="#fff" stopOpacity="0.22" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width={VW} height={VH} fill={u(`${id}p`)} />
      <path d="M170 -10 L230 -10 L330 260 L70 260 Z" fill={u(`${id}l`)} />
      {dots(30, 21, t.accent, 0.8)}
    </>
  ),
  harvest: (t) => {
    const maple = (x: number, y: number, s: number, r: number, c: string, k: number) => (
      <g key={k} transform={`translate(${x} ${y}) rotate(${r}) scale(${s})`}>
        <path d="M0 -12 L3 -5 L9 -8 L6 -1 L12 1 L5 4 L6 10 L0 6 L-6 10 L-5 4 L-12 1 L-6 -1 L-9 -8 L-3 -5 Z" fill={c} opacity="0.7" />
        <path d="M0 -12 L0 12" stroke={dk(c, 0.4)} strokeWidth="0.7" opacity="0.7" />
      </g>
    );
    return <>{Array.from({ length: 22 }, (_, i) => maple(R(i, 3) * VW, R(i, 4) * VH, 0.6 + R(i, 5) * 0.9, R(i, 6) * 360, [t.accent, "#e85d04", "#c84b14", "#ffcf6a"][i % 4], i))}</>;
  },
  frost: (t, id) => {
    const flake = (x: number, y: number, s: number, k: number) => (
      <g key={k} transform={`translate(${x} ${y}) scale(${s})`} stroke={lt(t.accent, 0.3)} strokeWidth="1.2" strokeLinecap="round" opacity="0.6">
        {[0, 60, 120, 180, 240, 300].map((a) => (
          <g key={a} transform={`rotate(${a})`}>
            <line x1="0" y1="0" x2="0" y2="-14" />
            <path d="M0 -7 l-4 -4 M0 -7 l4 -4 M0 -11 l-2.5 -2.5 M0 -11 l2.5 -2.5" />
          </g>
        ))}
      </g>
    );
    return (
      <>
        <defs>
          <linearGradient id={`${id}e`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fff" stopOpacity="0.25" />
            <stop offset="0.25" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
        </defs>
        <rect width={VW} height={VH} fill={u(`${id}e`)} />
        {[[30, 30, 1.6], [370, 40, 1.2], [340, 200, 1.8], [50, 200, 1.1], [200, 20, 0.8], [210, 220, 0.9]].map(([x, y, s], i) => flake(x, y, s, i))}
        {dots(50, 31, "#fff", 1)}
      </>
    );
  },
  haunted: (t, id) => (
    <>
      <defs>
        <linearGradient id={`${id}f`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={t.accent} stopOpacity="0" />
          <stop offset="1" stopColor={t.accent} stopOpacity="0.2" />
        </linearGradient>
      </defs>
      <circle cx="320" cy="56" r="44" fill={t.accent} opacity="0.1" />
      <circle cx="320" cy="56" r="22" fill={lt(t.accent, 0.6)} opacity="0.7" />
      <path d="M0 240 C10 200 6 170 20 140 M14 170 C30 160 36 150 50 150 M18 150 C10 140 8 130 0 124 M40 152 C46 140 44 130 54 122" stroke={dk(t.bg[0], 0.2)} strokeWidth="4" fill="none" strokeLinecap="round" />
      <rect y="170" width={VW} height="70" fill={u(`${id}f`)} />
      {[[250, 90], [280, 76], [150, 60]].map(([x, y], i) => (
        <path key={i} d={`M${x} ${y} c-2 -3 -5 -3 -7 -1 c-1 -3 -3 -3 -6 -1 c2 1 2 4 4 5 c2 -1 4 0 6 2 l1 -2 l1 2 c2 -2 4 -3 6 -2 c2 -1 2 -4 4 -5 c-3 -2 -5 -2 -6 1 c-2 -2 -5 -2 -7 1 z`} fill={dk(t.bg[0], 0.3)} />
      ))}
      {dots(26, 41, t.accent, 0.9)}
    </>
  ),
};

/** Theme key → motif. */
const MOTIF: Record<string, string> = {
  midnight: "stars",
  rosequartz: "crystals",
  forest: "leaves",
  deepsea: "deepsea",
  sunset: "sunset",
  lavender: "lavender",
  mint: "ribbons",
  crimson: "ribbons",
  royal: "filigree",
  cyber: "cyber",
  cottoncandy: "clouds",
  noir: "noir",
  harvest: "harvest",
  frost: "frost",
  haunted: "haunted",
};

/** The illustrated layer for a theme (fills its positioned parent). */
export function ThemeArt({ themeKey, t, className }: { themeKey: string; t: ThemeSpec; className?: string }) {
  const id = `t${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const art = ARTS[MOTIF[themeKey] ?? "stars"];
  return (
    <svg className={`cos-theme-art${className ? ` ${className}` : ""}`} viewBox={`0 0 ${VW} ${VH}`} preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      {art(t, id)}
    </svg>
  );
}
