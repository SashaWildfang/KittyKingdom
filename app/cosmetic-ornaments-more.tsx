"use client";

import type { CSSProperties, ReactNode } from "react";
import type { Ornament } from "../lib/cosmetics";
import { R } from "./scene-kit";

// More frame ornaments (the second half of cosmetic-ornaments.tsx), so every frame has its own art.
// Same canvas: viewBox -72..72, avatar radius 50. Decorations stay near the top, bottom and sides or
// further out on the diagonals, so they also sit well around the rounded-square Social photo.

type Stop = [number, string, number?];
const st = (s: Stop[]) => s.map(([o, c, op], i) => <stop key={i} offset={o} stopColor={c} stopOpacity={op ?? 1} />);
const lg = (id: string, s: Stop[], x2 = 0, y2 = 1) => (
  <linearGradient id={id} x1="0" y1="0" x2={x2} y2={y2}>
    {st(s)}
  </linearGradient>
);
const rg = (id: string, s: Stop[], cx = 0.5, cy = 0.5, r = 0.5) => (
  <radialGradient id={id} cx={cx} cy={cy} r={r}>
    {st(s)}
  </radialGradient>
);
const u = (id: string) => `url(#${id})`;
const t = (dur: number, delay = 0): CSSProperties => ({ animationDuration: `${dur}s`, animationDelay: `${delay}s` });
const pol = (r: number, deg: number): [number, number] => [Math.cos((deg * Math.PI) / 180) * r, Math.sin((deg * Math.PI) / 180) * r];
const f = (n: number) => n.toFixed(1);

function Mirror({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <g transform="scale(-1 1)">{children}</g>
    </>
  );
}

function Blossom({ x, y, s, k, rot = 0 }: { x: number; y: number; s: number; k: string; rot?: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot}) scale(${s})`}>
      {[0, 72, 144, 216, 288].map((a) => (
        <path key={a} d="M0 0 C-5 -3 -6 -9 -3 -11 L0 -9.5 L3 -11 C6 -9 5 -3 0 0 Z" fill={u(`${k}p`)} stroke="#f48fb1" strokeWidth="0.4" transform={`rotate(${a})`} />
      ))}
      <circle r="2" fill="#ffcf4d" />
    </g>
  );
}

export function MoreOrnament({ kind, k, color }: { kind: Ornament; k: string; color?: string }): ReactNode {
  switch (kind) {
    // Glowing coals banked along the bottom, sparks drifting up
    case "coals":
      return (
        <g>
          <defs>
            {lg(`${k}c`, [[0, "#5a3020"], [1, "#160804"]])}
            {rg(`${k}g`, [[0, "#ffb347", 0.75], [1, "#ff4d00", 0]])}
          </defs>
          {Array.from({ length: 10 }, (_, i) => {
            const [x, y] = pol(55 + R(i, 2) * 4, 50 + i * 8.9);
            const r = 4.5 + R(i, 3) * 3;
            const pts = Array.from({ length: 6 }, (_, j) => pol(r * (0.75 + R(i * 7 + j, 4) * 0.4), j * 60 + R(i, 5) * 30))
              .map(([px, py]) => `${f(x + px)},${f(y + py)}`)
              .join(" ");
            return (
              <g key={i}>
                <circle cx={x} cy={y} r={r * 2} fill={u(`${k}g`)} className="orn-glint" style={t(1.2 + R(i, 6), -R(i, 7))} />
                <polygon points={pts} fill={u(`${k}c`)} stroke="#2a1006" strokeWidth="0.6" />
                <path d={`M${f(x - r * 0.5)} ${f(y - r * 0.1)} l${f(r * 0.4)} ${f(r * 0.3)} l${f(r * 0.5)} ${f(-r * 0.4)}`} fill="none" stroke="#ffb347" strokeWidth="0.9" strokeLinecap="round" className="orn-glint" style={t(0.8 + R(i, 8) * 0.6, -R(i, 9))} />
                <path d={`M${f(x - r * 0.6)} ${f(y - r * 0.55)} q${f(r * 0.5)} ${f(-r * 0.3)} ${f(r)} 0`} fill="none" stroke="#fff" strokeWidth="0.6" opacity="0.25" />
              </g>
            );
          })}
          {Array.from({ length: 9 }, (_, i) => {
            const [x, y] = pol(58, 40 + i * 12.5);
            return <circle key={i} cx={x} cy={y} r={0.8 + R(i, 11) * 0.9} fill={i % 2 ? "#ffd27a" : "#ff8a1f"} className="orn-rise" style={t(2.2 + R(i, 12) * 1.6, -R(i, 13) * 3)} />;
          })}
        </g>
      );
    // A blossoming branch reaching over the top-left, petals drifting down
    case "branch":
      return (
        <g>
          <defs>
            {lg(`${k}b`, [[0, "#7a4b3a"], [1, "#3a2018"]])}
            {rg(`${k}p`, [[0, "#ffffff"], [0.5, "#ffd1e3"], [1, "#ff86b6"]], 0.5, 1, 1)}
          </defs>
          <path d="M-84 -6 C-74 -34 -54 -58 -24 -68 C-6 -74 10 -72 22 -66" fill="none" stroke={u(`${k}b`)} strokeWidth="4.5" strokeLinecap="round" />
          <path d="M-84 -6 C-74 -34 -54 -58 -24 -68" fill="none" stroke="#a8745e" strokeWidth="1.2" strokeLinecap="round" opacity="0.6" transform="translate(0.8 -1)" />
          <path d="M-56 -50 C-62 -60 -60 -68 -56 -74 M-30 -66 C-28 -76 -22 -80 -16 -82" fill="none" stroke={u(`${k}b`)} strokeWidth="2.2" strokeLinecap="round" />
          {[[-70, -30, 1.15, 10], [-56, -54, 1, 40], [-36, -66, 1.2, 70], [-56, -74, 0.75, 20], [-14, -80, 0.8, 50], [8, -70, 0.9, 30], [-80, -12, 0.7, 0]].map(([x, y, s, r], i) => (
            <g key={i} className="orn-sway" style={t(3 + (i % 3), -i * 0.5)}>
              <Blossom x={x} y={y} s={s} k={k} rot={r} />
            </g>
          ))}
          {[[-40, -60], [-20, -66], [-64, -40]].map(([x, y], i) => (
            <g key={i} transform={`translate(${x} ${y})`}>
              <path className="orn-petalfall" style={t(4 + i, -i * 1.4)} d="M0 0 C-3 -2 -4 -6 -2 -8 L0 -7 L2 -8 C4 -6 3 -2 0 0 Z" fill="#ffc2dc" />
            </g>
          ))}
        </g>
      );
    // Neon tube clips and a flickering neon heart sign
    case "ribbon": {
      const top: string[] = [];
      const bot: string[] = [];
      for (let a = 195; a <= 345; a += 5) {
        const w = Math.sin(((a - 195) / 150) * Math.PI);
        const [x1, y1] = pol(56 + w * 14 + Math.sin(a / 9) * 2, a);
        const [x2, y2] = pol(55, a);
        top.push(`${f(x1)},${f(y1)}`);
        bot.unshift(`${f(x2)},${f(y2)}`);
      }
      return (
        <g>
          <defs>
            {lg(`${k}a`, [[0, "#3dffb4", 0.1], [0.3, "#3dffb4", 0.75], [0.6, "#2bb8ff", 0.75], [1, "#b46cff", 0.1]], 1, 0)}
            <filter id={`${k}bl`} x="-20%" y="-50%" width="140%" height="200%">
              <feGaussianBlur stdDeviation="1.2" />
            </filter>
          </defs>
          <g className="orn-shimmer" style={t(3.5)}>
            <polygon points={[...top, ...bot].join(" ")} fill={u(`${k}a`)} filter={u(`${k}bl`)} />
            {Array.from({ length: 16 }, (_, i) => {
              const a = 205 + i * 8.5;
              const [x1, y1] = pol(57, a);
              const [x2, y2] = pol(57 + Math.sin(((a - 195) / 150) * Math.PI) * 13, a);
              return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#eafff7" strokeWidth="0.5" opacity="0.5" />;
            })}
          </g>
          {[[-50, 50], [56, 40], [0, 66], [-64, 14]].map(([x, y], i) => (
            <path key={i} className="orn-twinkle" style={t(2 + i * 0.4, -i)} d={`M${x} ${y - 3} L${x + 0.8} ${y - 0.8} L${x + 3} ${y} L${x + 0.8} ${y + 0.8} L${x} ${y + 3} L${x - 0.8} ${y + 0.8} L${x - 3} ${y} L${x - 0.8} ${y - 0.8} Z`} fill="#dffcff" />
          ))}
        </g>
      );
    }
    // Gold scrollwork at the top and bottom with a cut gem
    case "filigree": {
      const scroll = (
        <Mirror>
          <path d="M0 0 C-8 -1 -16 -6 -18 -13 C-19 -18 -14 -21 -10 -18 C-7 -16 -9 -12 -12 -13" fill="none" stroke={u(`${k}g`)} strokeWidth="2.2" strokeLinecap="round" />
          <path d="M-4 1 C-12 3 -22 2 -30 -3 C-34 -6 -32 -11 -28 -10 C-25 -9 -26 -6 -28 -6" fill="none" stroke={u(`${k}g`)} strokeWidth="1.8" strokeLinecap="round" />
          <path d="M-16 -5 C-19 -9 -24 -9 -26 -6 C-22 -4 -19 -3 -16 -5 Z" fill={u(`${k}g`)} />
          <circle cx="-34" cy="-1" r="1.4" fill="#fff6c9" />
        </Mirror>
      );
      return (
        <g>
          <defs>
            {lg(`${k}g`, [[0, "#fff6c9"], [0.45, "#ffd24a"], [1, "#8a5a00"]], 0.3, 1)}
            {lg(`${k}j`, [[0, "#9fd8ff"], [0.5, "#2b7fff"], [1, "#0b2a6b"]], 1, 1)}
          </defs>
          <g transform="translate(0 -56)">
            {scroll}
            <path d="M0 -9 L6 -2 L0 6 L-6 -2 Z" fill={u(`${k}j`)} stroke="#8a5a00" strokeWidth="1" />
            <path d="M0 -9 L6 -2 L0 -1 Z" fill="#fff" opacity="0.5" />
            <path className="orn-sparkle" style={t(2.4)} d="M3 -8 l0.8 2 l2 0.8 l-2 0.8 l-0.8 2 l-0.8 -2 l-2 -0.8 l2 -0.8 Z" fill="#fff" />
          </g>
          <g transform="translate(0 57) scale(0.85 -0.85)">
            {scroll}
            <circle r="4" fill={u(`${k}j`)} stroke="#8a5a00" strokeWidth="1" />
          </g>
        </g>
      );
    }
    // Little planets in orbit
    case "planets":
      return (
        <g>
          <defs>
            {rg(`${k}a`, [[0, "#ffd6f5"], [0.5, "#ff4dd8"], [1, "#5a0d6b"]], 0.35, 0.3, 0.75)}
            {rg(`${k}b`, [[0, "#d6f4ff"], [0.5, "#4fc3ff"], [1, "#0b2a6b"]], 0.35, 0.3, 0.75)}
            {rg(`${k}c`, [[0, "#fff3d6"], [0.5, "#ffb86b"], [1, "#6b3a0b"]], 0.35, 0.3, 0.75)}
          </defs>
          <g className="orn-orbit" style={t(18)}>
            <g transform="translate(0 -64) scale(1.4)">
              <ellipse rx="11" ry="3" fill="none" stroke="#ffe9c4" strokeWidth="1.2" opacity="0.6" transform="rotate(-18)" />
              <circle r="6" fill={u(`${k}a`)} />
              <path d="M-11 0 A11 3 0 0 0 11 0" fill="none" stroke="#ffe9c4" strokeWidth="1.2" transform="rotate(-18)" />
            </g>
            <circle cx="57" cy="30" r="6.2" fill={u(`${k}b`)} />
            <circle cx="-53" cy="37" r="4.6" fill={u(`${k}c`)} />
          </g>
          <g className="orn-orbit" style={t(9)}>
            <circle cx="-44" cy="-46" r="2" fill="#fff" opacity="0.9" />
          </g>
        </g>
      );
    // Pale mist pooling under the ring
    case "mist":
      return (
        <g>
          <defs>{rg(`${k}m`, [[0, "#d8ffe9", 0.55], [1, "#d8ffe9", 0]])}</defs>
          {[[-30, 60, 30], [14, 64, 34], [44, 56, 22]].map(([x, y, r], i) => (
            <ellipse key={i} cx={x} cy={y} rx={r} ry={r * 0.35} fill={u(`${k}m`)} className="orn-drift" style={t(5 + i, -i * 1.5)} />
          ))}
        </g>
      );
    // A cobweb in the top-right corner with a dangling spider
    case "cobweb": {
      const cx = 74;
      const cy = -74;
      const spokes = [180, 202, 225, 248, 270];
      return (
        <g stroke="#e8e0f0" strokeWidth="0.6" fill="none" opacity="0.85">
          {spokes.map((a) => {
            const [x, y] = pol(34, a);
            return <line key={a} x1={cx} y1={cy} x2={cx + x} y2={cy + y} />;
          })}
          {[10, 18, 26, 33].map((r) => (
            <path key={r} d={spokes.map((a, i) => { const [x, y] = pol(r, a); return `${i ? "Q" + f(cx + pol(r * 0.8, a - 11)[0]) + " " + f(cy + pol(r * 0.8, a - 11)[1]) + " " : "M"}${f(cx + x)} ${f(cy + y)}`; }).join(" ")} />
          ))}
          <g className="orn-dangle" style={t(3)}>
            <line x1="52" y1="-58" x2="52" y2="-42" />
            <g transform="translate(52 -40)" stroke="#1a0a14" strokeWidth="0.8">
              <path d="M-4 -2 l-3 -2 M-4 0 l-4 0 M-4 2 l-3 2 M4 -2 l3 -2 M4 0 l4 0 M4 2 l3 2" />
              <ellipse rx="3" ry="3.6" fill="#2a1020" />
              <circle cx="-1" cy="-1" r="0.6" fill="#ff4d4d" stroke="none" />
              <circle cx="1" cy="-1" r="0.6" fill="#ff4d4d" stroke="none" />
            </g>
          </g>
        </g>
      );
    }
    // Gold laurel branches along the lower sides
    case "laurel":
      return (
        <g>
          <defs>{lg(`${k}l`, [[0, "#fff3b0"], [0.5, "#e0b23a"], [1, "#7a5200"]], 1, 1)}</defs>
          <Mirror>
            <path d={`M-4 62 ${Array.from({ length: 6 }, (_, i) => { const [x, y] = pol(58, 105 + i * 14); return `L${f(x)} ${f(y)}`; }).join(" ")}`} fill="none" stroke="#a8740a" strokeWidth="1.4" />
            {Array.from({ length: 6 }, (_, i) => {
              const a = 108 + i * 14;
              const [x, y] = pol(58, a);
              return (
                <g key={i} transform={`translate(${f(x)} ${f(y)}) rotate(${a})`}>
                  <path d="M0 0 C3 -3 9 -3 12 -1 C9 1 3 2 0 0 Z" fill={u(`${k}l`)} transform="rotate(-50)" />
                  <path d="M0 0 C3 -3 9 -3 12 -1 C9 1 3 2 0 0 Z" fill={u(`${k}l`)} transform="rotate(50) scale(1 -1)" />
                </g>
              );
            })}
          </Mirror>
        </g>
      );
    // A silver chain draped under the ring with a swinging star charm
    case "chain": {
      const links: ReactNode[] = [];
      const n = 15;
      for (let i = 0; i <= n; i++) {
        const tt = i / n;
        const x = -44 + tt * 88;
        const y = 54 + Math.sin(tt * Math.PI) * 13;
        const ang = Math.atan2(Math.cos(tt * Math.PI) * 13 * Math.PI, 88) * (180 / Math.PI);
        links.push(<ellipse key={i} cx={f(x)} cy={f(y)} rx="3.4" ry={i % 2 ? 0.9 : 2.1} fill="none" stroke={u(`${k}s`)} strokeWidth="1.3" transform={`rotate(${f(ang)} ${f(x)} ${f(y)})`} />);
      }
      return (
        <g>
          <defs>
            {lg(`${k}s`, [[0, "#ffffff"], [0.5, "#b8c0cc"], [1, "#5c6b7a"]])}
            {lg(`${k}st`, [[0, "#ffffff"], [1, "#9aa4b2"]])}
          </defs>
          {links}
          <g className="orn-dangle" style={t(2.6)}>
            <line x1="0" y1="67" x2="0" y2="72" stroke="#9aa4b2" strokeWidth="1" />
            <path d="M0 70 L2.6 76 L9 76.6 L4.2 80.8 L5.6 87 L0 83.6 L-5.6 87 L-4.2 80.8 L-9 76.6 L-2.6 76 Z" fill={u(`${k}st`)} stroke="#5c6b7a" strokeWidth="0.7" />
            <path d="M0 70 L2.6 76 L9 76.6 L0 79 Z" fill="#fff" opacity="0.6" />
          </g>
        </g>
      );
    }
    // Two rose-gold roses with leaves and pearls
    case "roses": {
      const rose = (x: number, y: number, s: number, i: number) => (
        <g key={i} transform={`translate(${x} ${y}) scale(${s})`}>
          <path d="M-6 6 C-14 8 -18 2 -16 -2 C-12 0 -8 2 -6 6 Z" fill={u(`${k}lf`)} />
          <path d="M6 6 C12 12 18 8 18 3 C13 4 9 4 6 6 Z" fill={u(`${k}lf`)} />
          <circle r="9" fill={u(`${k}r`)} />
          <path d="M-6 2 C-6 -5 0 -8 5 -5 M-3 4 C-4 -1 0 -4 3 -2 M-8 -2 C-6 -8 2 -10 7 -6 M4 6 C8 3 8 -2 6 -4" fill="none" stroke="#8a3a3a" strokeWidth="0.9" strokeLinecap="round" />
          <path d="M-1 0 C-1 -2 1 -3 2 -1" fill="none" stroke="#6b2424" strokeWidth="1" />
          <ellipse cx="-3" cy="-5" rx="2.4" ry="1.2" fill="#fff" opacity="0.45" />
        </g>
      );
      return (
        <g>
          <defs>
            {rg(`${k}r`, [[0, "#ffe1d8"], [0.5, "#f4a89a"], [1, "#9e5a4f"]], 0.4, 0.35, 0.7)}
            {lg(`${k}lf`, [[0, "#9be08f"], [1, "#2f6b3a"]])}
            {rg(`${k}pl`, [[0, "#ffffff"], [0.7, "#f3e6e1"], [1, "#b8a39c"]], 0.35, 0.3, 0.7)}
          </defs>
          {[[-60, 26], [-52, 36], [-40, 46], [52, -30], [58, -18]].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r="2.2" fill={u(`${k}pl`)} />
          ))}
          {rose(-50, 48, 1.5, 0)}
          {rose(53, -45, 1.1, 1)}
        </g>
      );
    }
    // Black glass shards jutting out, lit violet from inside
    case "slime":
      return (
        <g>
          <defs>{lg(`${k}s`, [[0, "#e6ff8a"], [0.5, "#7dff3a"], [1, "#2fa81a"]], 1, 1)}</defs>
          <path d="M-34 -42 C-28 -52 -12 -56 0 -56 C14 -56 28 -52 34 -42 C30 -44 28 -38 28 -32 C28 -28 24 -28 24 -32 C24 -38 20 -42 16 -42 C12 -42 12 -36 12 -28 C12 -22 7 -22 7 -28 C7 -36 4 -42 -2 -42 C-8 -42 -10 -38 -12 -34 C-14 -30 -18 -30 -18 -34 C-18 -40 -24 -44 -28 -42 C-30 -41 -32 -40 -34 -42 Z" fill={u(`${k}s`)} transform="translate(0 -6)" />
          <path d="M-24 -56 C-14 -60 4 -62 16 -58" fill="none" stroke="#fff" strokeWidth="1.4" opacity="0.55" strokeLinecap="round" />
          {[[9.5, -30], [26, -34], [-15, -36]].map(([x, y], i) => (
            <g key={i} transform={`translate(${x} ${y})`}>
              <path className="orn-drip" style={t(2.2 + i * 0.5, -i * 0.8)} d="M0 0 C-2 3 -2 5 0 6 C2 5 2 3 0 0 Z" fill={u(`${k}s`)} />
            </g>
          ))}
          {[[-20, 62], [8, 66], [30, 60]].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r={2.5 + i * 0.6} fill="none" stroke="#9dff6a" strokeWidth="1" className="orn-pop" style={t(1.8 + i * 0.4, -i * 0.6)} />
          ))}
        </g>
      );
    // A wrapped sweet, a lollipop and sprinkles
    case "sweets":
      return (
        <g>
          <defs>
            {rg(`${k}c`, [[0, "#ffd1e8"], [0.5, "#ff6fb1"], [1, "#a8104a"]], 0.35, 0.3, 0.75)}
            {rg(`${k}l`, [[0, "#ffffff", 0.35], [0.5, "#ffffff", 0], [1, "#000", 0.3]], 0.35, 0.3, 0.8)}
          </defs>
          <g transform="translate(-58 -40) rotate(-30)">
            <path d="M-8 0 L-15 -6 L-14 6 Z M8 0 L15 -6 L14 6 Z" fill="#8fd3ff" stroke="#3e8ecf" strokeWidth="0.6" />
            <ellipse rx="9" ry="6.5" fill={u(`${k}c`)} />
            <path d="M-4 -6 L-1 6 M2 -6 L5 6" stroke="#fff" strokeWidth="1.6" opacity="0.8" />
            <ellipse cx="-3" cy="-3" rx="3" ry="1.4" fill="#fff" opacity="0.6" />
          </g>
          <g transform="translate(58 30)">
          <g className="orn-sway" style={t(3)}>
            <rect x="-1" y="0" width="2" height="22" fill="#f4f4f4" />
            <circle r="10" fill="#ffe066" />
            <path d="M0 0 m-7 0 a7 7 0 1 1 7 7 a4.5 4.5 0 1 1 -4.5 -4.5 a2 2 0 1 1 2 2" fill="none" stroke="#ff8fc7" strokeWidth="2" strokeLinecap="round" />
            <circle r="10" fill={u(`${k}l`)} />
          </g>
          </g>
          {Array.from({ length: 12 }, (_, i) => {
            const [x, y] = pol(60 + R(i, 3) * 6, -170 + i * 28);
            return <rect key={i} x={x - 2.5} y={y - 0.9} width="5" height="1.8" rx="0.9" fill={["#ff8fc7", "#8fd3ff", "#ffe066", "#9dff9a"][i % 4]} transform={`rotate(${R(i, 4) * 180} ${x} ${y})`} />;
          })}
        </g>
      );
    // A heartbeat line tracing across the bottom
    case "ecg":
      return (
        <g>
          <defs>
            <filter id={`${k}gl`} x="-20%" y="-50%" width="140%" height="200%">
              <feGaussianBlur stdDeviation="1.4" />
            </filter>
          </defs>
          <path d="M-46 62 H-18 L-14 56 L-10 66 L-4 46 L2 72 L6 58 L10 62 H46" fill="none" stroke="#ff4d8d" strokeWidth="1.2" opacity="0.35" strokeLinejoin="round" />
          <path className="orn-trace" pathLength="100" d="M-46 62 H-18 L-14 56 L-10 66 L-4 46 L2 72 L6 58 L10 62 H46" fill="none" stroke="#ff4d8d" strokeWidth="3" filter={u(`${k}gl`)} strokeLinejoin="round" strokeLinecap="round" strokeDasharray="22 78" />
          <path className="orn-trace" pathLength="100" d="M-46 62 H-18 L-14 56 L-10 66 L-4 46 L2 72 L6 58 L10 62 H46" fill="none" stroke="#ffd6e6" strokeWidth="1.2" strokeLinejoin="round" strokeLinecap="round" strokeDasharray="22 78" />
        </g>
      );
    // A thorny vine wrapped round the bottom
    case "thorns": {
      const pts = Array.from({ length: 21 }, (_, i) => {
        const a = 25 + i * 6.5;
        return pol(55 + Math.sin(i * 1.3) * 2.5, a);
      });
      return (
        <g>
          <path d={`M${pts.map(([x, y]) => `${f(x)} ${f(y)}`).join(" L")}`} fill="none" stroke="#2b0006" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
          <path d={`M${pts.map(([x, y]) => `${f(x)} ${f(y)}`).join(" L")}`} fill="none" stroke="#8a1020" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" transform="translate(0 -0.8)" />
          {pts.filter((_, i) => i % 2).map(([x, y], i) => {
            const a = 31.5 + i * 13;
            const [ox, oy] = pol(5, a + (i % 2 ? 40 : -40));
            return <path key={i} d={`M${f(x - 1.4)} ${f(y)} L${f(x + ox)} ${f(y + oy)} L${f(x + 1.4)} ${f(y)} Z`} fill="#1a0004" />;
          })}
        </g>
      );
    }
    // A pointed devil tail flicking at the bottom right
    case "tail":
      return (
        <g>
          <defs>{lg(`${k}t`, [[0, "#ff5a5a"], [1, "#5a0008"]], 1, 1)}</defs>
          <g className="orn-flicktail" style={t(1.8)}>
            <path d="M30 50 C44 62 62 66 68 54 C72 46 66 40 62 44" fill="none" stroke={u(`${k}t`)} strokeWidth="3" strokeLinecap="round" />
            <path d="M62 44 L58 34 L68 40 Z M62 44 L70 50 L66 40 Z" fill="#c1121f" stroke="#3a0006" strokeWidth="0.6" />
          </g>
        </g>
      );
    // Whiskers on both cheeks
    case "whiskers":
      return (
        <g className="orn-twitch" style={t(4)}>
          <Mirror>
            {[[-4, -6], [0, 0], [4, 6]].map(([dy, dy2], i) => (
              <path key={i} d={`M-50 ${8 + dy} Q-62 ${6 + dy} -74 ${4 + dy2}`} fill="none" stroke="#ffffff" strokeWidth="1.3" strokeLinecap="round" opacity="0.95" />
            ))}
          </Mirror>
        </g>
      );
    // A satin bow
    case "bow": {
      const c = color ?? "#ff8fab";
      return (
        <g transform="translate(36 -50) rotate(18)">
          <defs>
            {lg(`${k}b`, [[0, "#ffd1e1"], [0.5, c], [1, "#c2185b"]], 0.3, 1)}
          </defs>
          <path d="M0 0 L-6 12 L-2 11 L-1 15 Z M0 0 L6 12 L2 11 L1 15 Z" fill="#c2185b" />
          <path d="M0 0 C-6 -10 -16 -8 -15 0 C-14 7 -6 6 0 0 Z M0 0 C6 -10 16 -8 15 0 C14 7 6 6 0 0 Z" fill={u(`${k}b`)} stroke="#a8104a" strokeWidth="0.6" />
          <path d="M-12 -3 C-9 -6 -6 -6 -4 -3" fill="none" stroke="#fff" strokeWidth="1" opacity="0.6" />
          <circle r="3" fill={u(`${k}b`)} stroke="#a8104a" strokeWidth="0.6" />
        </g>
      );
    }
    // A fluffy fox tail curling round the bottom-left
    case "foxtail":
      return (
        <g>
          <defs>{lg(`${k}t`, [[0, "#ffb27a"], [0.5, "#ff7a2a"], [1, "#a8400f"]], 1, 1)}</defs>
          <g className="orn-wag" style={t(2.6)}>
            <path d="M-22 58 C-44 70 -72 60 -76 36 C-78 22 -70 8 -60 2 C-64 16 -62 30 -52 40 C-44 48 -32 52 -22 52 Z" fill={u(`${k}t`)} stroke="#7a2e0a" strokeWidth="0.8" />
            <path d="M-60 2 C-70 8 -78 22 -76 36 C-72 30 -68 22 -62 18 C-62 12 -61 6 -60 2 Z" fill="#fff8ee" />
            <path d="M-34 60 q-6 -4 -12 -2 M-50 56 q-6 -6 -12 -4 M-62 46 q-5 -6 -9 -6 M-66 30 q-3 -5 -6 -6" fill="none" stroke="#7a2e0a" strokeWidth="0.8" opacity="0.6" strokeLinecap="round" />
          </g>
        </g>
      );
    // Icicles hanging from the bottom of the ring
    case "icicles":
      return (
        <g>
          <defs>{lg(`${k}i`, [[0, "#ffffff"], [0.5, "#bfefff", 0.9], [1, "#5ac8fa", 0.2]])}</defs>
          {Array.from({ length: 11 }, (_, i) => {
            const a = 40 + i * 10;
            const [x, y] = pol(54, a);
            const len = 6 + R(i, 3) * 12 * Math.sin(((a - 30) / 120) * Math.PI);
            return (
              <g key={i}>
                <path d={`M${f(x - 2.4)} ${f(y)} L${f(x)} ${f(y + len)} L${f(x + 2.4)} ${f(y)} Z`} fill={u(`${k}i`)} />
                <path d={`M${f(x - 0.8)} ${f(y + 1)} L${f(x - 0.2)} ${f(y + len * 0.7)}`} stroke="#fff" strokeWidth="0.6" opacity="0.9" />
                {i % 4 === 1 ? <circle cx={x} cy={y + len + 2} r="0.9" fill="#bfefff" className="orn-drip" style={t(2.6 + i * 0.3, -i * 0.4)} /> : null}
              </g>
            );
          })}
        </g>
      );
    // Floating prisms throwing little rainbows
    case "vortex":
      return (
        <g>
          <defs>{lg(`${k}v`, [[0, "#9d4edd", 0], [0.6, "#9d4edd", 0.8], [1, "#e0aaff"]], 1, 0)}</defs>
          <g className="orn-spin" style={t(12)}>
            {[0, 90, 180, 270].map((a) => (
              <g key={a} transform={`rotate(${a})`}>
                <path d="M76 -6 C74 -30 56 -50 30 -56" fill="none" stroke={u(`${k}v`)} strokeWidth="3" strokeLinecap="round" />
                <path d="M74 4 C72 -20 58 -40 40 -50" fill="none" stroke="#3c096c" strokeWidth="1.4" strokeLinecap="round" opacity="0.8" />
                <circle cx="66" cy="-30" r="1.2" fill="#e0aaff" />
              </g>
            ))}
          </g>
        </g>
      );
    // Fluffy night clouds
    case "clouds": {
      const cloud = (x: number, y: number, s: number, i: number) => (
        <g key={i} transform={`translate(${x} ${y}) scale(${s})`}>
          <g className="orn-drift" style={t(6 + i, -i * 2)}>
            {[[-8, 2, 7], [0, -3, 9], [9, 0, 7], [3, 4, 7]].map(([cx, cy, r], j) => (
              <circle key={j} cx={cx} cy={cy} r={r} fill={u(`${k}c`)} />
            ))}
          </g>
        </g>
      );
      return (
        <g>
          <defs>{lg(`${k}c`, [[0, "#ffffff"], [0.6, "#d6def5"], [1, "#7f8fd8"]])}</defs>
          {cloud(-54, 48, 1, 0)}
          {cloud(-30, 60, 0.7, 1)}
        </g>
      );
    }
    // A bumblebee buzzing round
    case "bee":
      return (
        <g className="orn-orbit" style={t(9)}>
          <g transform="translate(0 -66)">
            <g className="orn-float" style={t(0.6)}>
              <ellipse cx="0" cy="-3" rx="3" ry="4" fill="#ffffff" opacity="0.75" className="orn-buzz" style={t(0.08)} />
              <ellipse cx="4" cy="-3" rx="3" ry="4" fill="#ffffff" opacity="0.75" className="orn-buzz" style={t(0.08, -0.04)} />
              <ellipse cx="2" cy="1" rx="6" ry="4.2" fill="#ffd23f" />
              <path d="M0 -3 V5 M3 -3 V5" stroke="#2a1a0e" strokeWidth="1.4" />
              <circle cx="7" cy="0" r="2.2" fill="#2a1a0e" />
              <ellipse cx="0" cy="-1" rx="2.4" ry="1" fill="#fff" opacity="0.5" />
            </g>
          </g>
        </g>
      );
    default:
      return null;
  }
}
