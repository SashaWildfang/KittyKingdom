"use client";

import type { CSSProperties, ReactNode } from "react";
import type { Ornament } from "../lib/cosmetics";
import { dk, lt, mix, R } from "./scene-kit";

// Hand-shaded frame ornaments, drawn around an avatar of radius 50 (viewBox -72..72, centred on 0,0).
// Every shape gets its own gradient (lit top-left, shaded base) so nothing reads as flat clip art.
// Motion uses the .orn-* classes in globals.css.

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

function Mirror({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <g transform="scale(-1 1)">{children}</g>
    </>
  );
}

const STAR = "M0 -10 L2.9 -3.6 L9.5 -3.1 L4.5 1.4 L5.9 8.1 L0 4.6 L-5.9 8.1 L-4.5 1.4 L-9.5 -3.1 L-2.9 -3.6 Z";
const STAR_LIT = "M0 -10 L2.9 -3.6 L9.5 -3.1 L0 0 Z M-9.5 -3.1 L-2.9 -3.6 L0 -10 L0 0 Z M-5.9 8.1 L-4.5 1.4 L0 0 Z";
const HEART = "M0 6 C-3 3 -10 -1 -10 -6 A5 5 0 0 1 0 -8 A5 5 0 0 1 10 -6 C10 -1 3 3 0 6 Z";
const FLAME = "M0 0 C-7 -6 -6 -14 -2 -20 C-1 -14 2 -13 2 -18 C7 -12 8 -5 0 0 Z";

/** One ornament layer. `uid` keeps gradient ids unique per frame on the page. */
export function OrnamentArt({ kind, color, glow, uid }: { kind: Ornament; color?: string; glow: string; uid: string }) {
  const k = `${uid}${kind}`;
  switch (kind) {
    case "crown":
      return (
        <g transform="translate(0 -62)">
          <defs>
            {lg(`${k}g`, [[0, "#fff6c9"], [0.35, "#ffd24a"], [0.75, "#d99a12"], [1, "#8a5a00"]])}
            {lg(`${k}b`, [[0, "#f7c548"], [1, "#9a6400"]])}
            {rg(`${k}r`, [[0, "#ffd1e3"], [0.45, "#ff3d7f"], [1, "#8a0034"]], 0.35, 0.3, 0.7)}
            {rg(`${k}s`, [[0, "#d6f4ff"], [0.45, "#3fa9ff"], [1, "#0b3d91"]], 0.35, 0.3, 0.7)}
          </defs>
          <g className="orn-bob">
            <ellipse cx="0" cy="13" rx="26" ry="3" fill="#000" opacity="0.25" />
            <path d="M-25 10 L-29 -13 L-14 -2 L0 -22 L14 -2 L29 -13 L25 10 Z" fill={u(`${k}g`)} stroke="#7a4e00" strokeWidth="1.6" strokeLinejoin="round" />
            <path d="M-25 10 L-29 -13 L-14 -2 L-12 6 Z M0 -22 L14 -2 L10 4 L0 -14 Z" fill="#fff" opacity="0.18" />
            <rect x="-25" y="7" width="50" height="7" rx="2" fill={u(`${k}b`)} stroke="#7a4e00" strokeWidth="1.2" />
            <rect x="-23" y="8" width="46" height="1.6" rx="0.8" fill="#fff6c9" opacity="0.7" />
            {[-16, 0, 16].map((x, i) => (
              <circle key={x} cx={x} cy="10.5" r={i === 1 ? 3 : 2.3} fill={u(i === 1 ? `${k}r` : `${k}s`)} />
            ))}
            <circle cx="0" cy="-22" r="3.8" fill={u(`${k}r`)} stroke="#7a4e00" strokeWidth="0.8" />
            <circle cx="-29" cy="-13" r="3" fill={u(`${k}s`)} stroke="#7a4e00" strokeWidth="0.8" />
            <circle cx="29" cy="-13" r="3" fill={u(`${k}s`)} stroke="#7a4e00" strokeWidth="0.8" />
            <path className="orn-sparkle" style={t(2.2)} d="M-8 -14 l1.2 3.2 l3.2 1.2 l-3.2 1.2 l-1.2 3.2 l-1.2 -3.2 l-3.2 -1.2 l3.2 -1.2 Z" fill="#fff" />
            <path className="orn-sparkle" style={t(2.6, -1.2)} d="M18 2 l1 2.6 l2.6 1 l-2.6 1 l-1 2.6 l-1 -2.6 l-2.6 -1 l2.6 -1 Z" fill="#fff" />
          </g>
        </g>
      );
    case "halo":
      return (
        <g className="orn-bob">
          <defs>{lg(`${k}g`, [[0, "#fffbe6"], [0.5, "#ffe58a"], [1, "#d4a017"]], 1, 0)}</defs>
          <ellipse cx="0" cy="-64" rx="30" ry="8" fill="none" stroke={glow} strokeWidth="10" opacity="0.45" />
          <ellipse cx="0" cy="-64" rx="30" ry="8" fill="none" stroke={u(`${k}g`)} strokeWidth="4.5" />
          <ellipse cx="0" cy="-65.2" rx="28" ry="6.6" fill="none" stroke="#fff" strokeWidth="1" opacity="0.8" />
        </g>
      );
    case "wings":
      return (
        <g>
          <defs>{lg(`${k}f`, [[0, "#ffffff"], [0.7, "#f4ecd6"], [1, "#d9c58b"]], 1, 1)}</defs>
          <Mirror>
            <g className="orn-flap" style={t(2.8)}>
              {[
                [-50, -30, 34, -38],
                [-50, -22, 36, -24],
                [-50, -14, 34, -10],
                [-50, -6, 30, 4],
                [-50, 2, 24, 16],
              ].map(([x, y, len, ang], i) => (
                <path key={i} d={`M0 0 C${-len * 0.3} -5 ${-len * 0.8} -5 ${-len} 0 C${-len * 0.8} 4 ${-len * 0.3} 4 0 0 Z`} fill={u(`${k}f`)} stroke="#cdb57a" strokeWidth="0.7" transform={`translate(${x} ${y}) rotate(${ang})`} />
              ))}
              {[[-52, -26, 22, -30], [-52, -16, 22, -14], [-52, -6, 20, 0]].map(([x, y, len, ang], i) => (
                <path key={i} d={`M0 0 C${-len * 0.3} -4 ${-len * 0.8} -4 ${-len} 0 C${-len * 0.8} 3 ${-len * 0.3} 3 0 0 Z`} fill="#fff" stroke="#e2d2a3" strokeWidth="0.5" transform={`translate(${x} ${y}) rotate(${ang})`} />
              ))}
            </g>
          </Mirror>
        </g>
      );
    case "batwings":
      return (
        <g>
          <defs>{lg(`${k}m`, [[0, "#5a1a3a"], [0.6, "#2a0a1c"], [1, "#12040c"]], 1, 1)}</defs>
          <Mirror>
            <g className="orn-flap" style={t(1.6)}>
              <path d="M-47 -12 C-54 -28 -66 -36 -82 -32 C-78 -26 -79 -20 -84 -14 C-77 -14 -73 -9 -76 -3 C-69 -5 -64 -1 -64 6 C-58 2 -53 2 -48 4 Z" fill={u(`${k}m`)} stroke="#8a2a3a" strokeWidth="1.2" strokeLinejoin="round" />
              <path d="M-48 -10 L-82 -32 M-49 -7 L-84 -14 M-49 -3 L-76 -3 M-48 0 L-64 6" fill="none" stroke="#a8455a" strokeWidth="1.1" strokeLinecap="round" opacity="0.9" />
              <path d="M-52 -18 C-60 -24 -68 -27 -76 -27" fill="none" stroke="#fff" strokeWidth="0.8" opacity="0.25" />
              <path d="M-82 -32 l-3 -3 l1 4 Z" fill="#d8b0b8" />
            </g>
          </Mirror>
        </g>
      );
    case "horns":
      return (
        <g>
          <defs>{lg(`${k}h`, [[0, "#ff7a7a"], [0.35, "#b3121f"], [1, "#2b0000"]], 1, 0)}</defs>
          <Mirror>
            <g className="orn-glint" style={t(3)}>
              <path d="M-26 -42 C-40 -56 -38 -76 -22 -88 C-28 -74 -24 -62 -12 -49 Z" fill={u(`${k}h`)} stroke="#1a0000" strokeWidth="1.2" strokeLinejoin="round" />
              {[0.25, 0.45, 0.65].map((p, i) => (
                <path key={i} d={`M${-26 + p * 4} ${-42 - p * 34} q6 2 ${10 - p * 6} ${4 - p * 2}`} fill="none" stroke="#1a0000" strokeWidth="1" opacity="0.6" />
              ))}
              <path d="M-30 -52 C-33 -64 -30 -74 -24 -82" fill="none" stroke="#fff" strokeWidth="1.2" opacity="0.4" strokeLinecap="round" />
            </g>
          </Mirror>
        </g>
      );
    case "ears": {
      const c = color ?? "#ffb3c6";
      return (
        <g>
          <defs>
            {lg(`${k}o`, [[0, lt(c, 0.3)], [0.6, c], [1, dk(c, 0.3)]], 0.6, 1)}
            {lg(`${k}i`, [[0, "#ffe3ec"], [1, "#ff8fab"]])}
          </defs>
          <Mirror>
            <g className="orn-twitch" style={t(6)}>
              <path d="M-44 -26 C-48 -46 -46 -66 -40 -76 C-36 -78 -32 -74 -28 -68 C-22 -60 -16 -52 -12 -46 C-22 -40 -34 -32 -44 -26 Z" fill={u(`${k}o`)} stroke={dk(c, 0.4)} strokeWidth="1.2" strokeLinejoin="round" />
              <path d="M-39 -34 C-41 -48 -40 -62 -37 -68 C-31 -60 -25 -52 -20 -46 C-26 -42 -32 -38 -39 -34 Z" fill={u(`${k}i`)} />
              <path d="M-37 -40 q-1 -8 2 -14 M-33 -42 q0 -6 3 -10 M-29 -44 q1 -4 3 -6" fill="none" stroke="#fff" strokeWidth="1.1" strokeLinecap="round" opacity="0.85" />
              <path d="M-42 -66 C-40 -72 -36 -74 -33 -70" fill="none" stroke="#fff" strokeWidth="1.2" opacity="0.5" strokeLinecap="round" />
            </g>
          </Mirror>
        </g>
      );
    }
    case "foxears": {
      const c = color ?? "#ff8a3d";
      return (
        <g>
          <defs>
            {lg(`${k}o`, [[0, lt(c, 0.25)], [0.55, c], [1, dk(c, 0.35)]], 0.6, 1)}
            {lg(`${k}i`, [[0, "#fff8ee"], [1, "#f2d2b0"]])}
            {lg(`${k}t`, [[0, "#3a2418"], [1, "#1a0e08"]])}
          </defs>
          <Mirror>
            <g className="orn-twitch" style={t(5)}>
              <path d="M-46 -24 C-50 -44 -48 -70 -40 -88 C-30 -74 -20 -60 -10 -46 C-22 -38 -34 -30 -46 -24 Z" fill={u(`${k}o`)} stroke={dk(c, 0.45)} strokeWidth="1.2" strokeLinejoin="round" />
              <path d="M-43.5 -76 C-42 -82 -41 -86 -40 -88 C-36 -82 -32 -77 -29 -72 C-33 -72 -39 -74 -43.5 -76 Z" fill={u(`${k}t`)} />
              <path d="M-40 -32 C-42 -48 -41 -64 -38 -74 C-31 -64 -24 -54 -18 -46 C-25 -41 -32 -36 -40 -32 Z" fill={u(`${k}i`)} />
              <path d="M-38 -38 q-2 -8 1 -16 M-34 -40 q-1 -6 2 -12 M-30 -42 q0 -5 2 -8 M-26 -44 q1 -3 2 -5" fill="none" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" />
              <path d="M-45 -40 C-46 -56 -44 -70 -41 -80" fill="none" stroke="#fff" strokeWidth="1.2" opacity="0.4" strokeLinecap="round" />
            </g>
          </Mirror>
        </g>
      );
    }
    case "wreath":
      return (
        <g>
          <defs>
            {lg(`${k}l`, [[0, "#9be08f"], [0.5, "#4f9f4f"], [1, "#245a2c"]], 1, 1)}
            {rg(`${k}b`, [[0, "#ffb3b3"], [0.4, "#e5484d"], [1, "#7a0e12"]], 0.35, 0.3, 0.7)}
            {lg(`${k}r`, [[0, "#ff6b6b"], [1, "#a8141c"]])}
          </defs>
          {Array.from({ length: 17 }, (_, i) => {
            const a = ((20 + i * 8.75) * Math.PI) / 180;
            const r = 54 + (i % 2) * 3;
            const x = Math.cos(a) * r;
            const y = Math.sin(a) * r;
            const rot = 20 + i * 8.75 + 90 + (i % 2 ? 35 : -35);
            return (
              <g key={i} transform={`translate(${x} ${y}) rotate(${rot})`}>
                <path d="M-9 0 C-5 -5 5 -5 9 0 C5 5 -5 5 -9 0 Z" fill={u(`${k}l`)} />
                <path d="M-9 0 L9 0" stroke="#1d4a24" strokeWidth="0.7" opacity="0.7" />
              </g>
            );
          })}
          {[[-34, 44], [-22, 51], [26, 49], [38, 40], [-46, 30]].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r="3.2" fill={u(`${k}b`)} />
          ))}
          <g transform="translate(0 58)">
            <path d="M0 0 C-10 -8 -18 -4 -14 4 C-10 8 -4 4 0 0 Z M0 0 C10 -8 18 -4 14 4 C10 8 4 4 0 0 Z" fill={u(`${k}r`)} />
            <path d="M-2 1 L-8 12 L-4 11 L-3 14 Z M2 1 L8 12 L4 11 L3 14 Z" fill="#a8141c" />
            <circle r="3" fill="#ff6b6b" stroke="#a8141c" strokeWidth="0.8" />
          </g>
        </g>
      );
    case "snow":
      return (
        <g>
          <defs>
            <filter id={`${k}gl`} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="1.4" />
            </filter>
          </defs>
          {[[-50, -38, 1.1], [54, -24, 0.85], [44, 44, 0.95], [-48, 40, 0.7], [0, -62, 0.6]].map(([x, y, s], i) => (
            <g key={i} transform={`translate(${x} ${y}) scale(${s})`}>
              <g className="orn-spin" style={t(14 + i * 3)}>
                {[0, 60, 120].map((a) => (
                  <g key={a} transform={`rotate(${a})`} stroke="#7fd3ff" strokeWidth="3.4" strokeLinecap="round" filter={u(`${k}gl`)} opacity="0.6">
                    <line x1="-10" y1="0" x2="10" y2="0" />
                  </g>
                ))}
                {[0, 60, 120, 180, 240, 300].map((a) => (
                  <g key={a} transform={`rotate(${a})`} stroke="#ffffff" strokeWidth="1.6" strokeLinecap="round" fill="none">
                    <line x1="0" y1="0" x2="10" y2="0" />
                    <path d="M5 0 l3 -3 M5 0 l3 3 M8 0 l2 -2 M8 0 l2 2" strokeWidth="1.1" />
                  </g>
                ))}
                <circle r="1.8" fill="#e8f8ff" />
              </g>
            </g>
          ))}
          {Array.from({ length: 6 }, (_, i) => (
            <circle key={i} className="orn-sparkle" style={t(1.8 + i * 0.3, -i * 0.4)} cx={Math.cos(i * 1.1) * 60} cy={Math.sin(i * 1.1) * 60} r="1.3" fill="#fff" />
          ))}
        </g>
      );
    case "flames":
      return (
        <g>
          <defs>
            {lg(`${k}o`, [[0, "#ffe680", 0.9], [0.4, "#ff9a1f"], [1, "#ff2a00", 0.2]], 0, 1)}
            {lg(`${k}i`, [[0, "#ffffff"], [1, "#ffd23f", 0.4]], 0, 1)}
          </defs>
          {Array.from({ length: 14 }, (_, i) => {
            const deg = -180 + i * (180 / 13) + (R(i, 3) - 0.5) * 6;
            const a = (deg * Math.PI) / 180;
            const s = 0.8 + Math.sin((i / 13) * Math.PI) * 0.7 + R(i, 4) * 0.2;
            return (
              <g key={i} transform={`translate(${Math.cos(a) * 49} ${Math.sin(a) * 49}) rotate(${deg + 90}) scale(${s})`}>
                <g className="orn-flick" style={t(0.5 + R(i, 5) * 0.4, -R(i, 6))}>
                  <path d={FLAME} fill={u(`${k}o`)} />
                  <path d={FLAME} fill={u(`${k}i`)} transform="translate(0 -1) scale(0.5)" />
                </g>
              </g>
            );
          })}
        </g>
      );
    case "phoenix":
      return (
        <g>
          <defs>
            {lg(`${k}w`, [[0, "#fff176"], [0.35, "#ffb300"], [0.75, "#ff3d00"], [1, "#b71c00", 0.6]], 1, 0.4)}
            {lg(`${k}c`, [[0, "#fff8c4"], [1, "#ff6a00"]])}
          </defs>
          {/* Burning wings sweep up from behind the ring */}
          <Mirror>
            <g className="orn-flap" style={t(2.2)}>
              {[
                [-44, -24, 40, -62],
                [-46, -18, 46, -46],
                [-48, -10, 48, -30],
                [-48, -2, 42, -14],
                [-46, 6, 32, 2],
              ].map(([x, y, len, ang], i) => (
                <g key={i} transform={`translate(${x} ${y}) rotate(${ang})`}>
                  <path className="orn-flick" style={t(0.7 + i * 0.12, -i * 0.2)} d={`M0 0 C${-len * 0.4} -7 ${-len * 0.8} -6 ${-len} -1 C${-len * 0.86} 0 ${-len * 0.9} 3 ${-len * 0.98} 6 C${-len * 0.7} 6 ${-len * 0.3} 5 0 0 Z`} fill={u(`${k}w`)} />
                </g>
              ))}
            </g>
          </Mirror>
          {/* Crest */}
          <g transform="translate(0 -52)">
            {[-14, 0, 14].map((a, i) => (
              <g key={a} transform={`rotate(${a})`}>
                <path className="orn-flick" style={t(0.6 + i * 0.15, -i * 0.3)} d="M0 0 C-4 -6 -3 -14 0 -20 C3 -14 4 -6 0 0 Z" fill={u(`${k}c`)} />
              </g>
            ))}
          </g>
          {/* Tail feathers curl under the ring */}
          {[-1, 1].map((f) => (
            <path key={f} className="orn-flick" style={t(0.9, f * 0.2)} d={`M${f * 6} 50 C${f * 16} 62 ${f * 30} 64 ${f * 40} 58 C${f * 32} 60 ${f * 22} 58 ${f * 18} 52 Z`} fill={u(`${k}w`)} />
          ))}
          <path className="orn-flick" style={t(0.8)} d="M0 50 C-5 58 -4 66 0 72 C4 66 5 58 0 50 Z" fill={u(`${k}c`)} />
        </g>
      );
    case "hearts":
      return (
        <g className="orn-orbit">
          <defs>{rg(`${k}h`, [[0, "#ffd1e1"], [0.45, "#ff4d8d"], [1, "#a8104a"]], 0.35, 0.3, 0.75)}</defs>
          {[0, 90, 180, 270].map((d, i) => (
            <g key={d} transform={`rotate(${d}) translate(0 -60) rotate(${-d})`}>
              <g className="orn-beat" style={t(1.1, -i * 0.25)}>
                <path d={HEART} fill={u(`${k}h`)} transform="scale(0.85)" />
                <ellipse cx="-4" cy="-5" rx="2.2" ry="1.4" fill="#fff" opacity="0.8" transform="rotate(-30 -4 -5)" />
              </g>
            </g>
          ))}
        </g>
      );
    case "stars":
      return (
        <g className="orn-orbit">
          <defs>{lg(`${k}s`, [[0, "#fff6c9"], [1, "#e0a526"]])}</defs>
          {[0, 72, 144, 216, 288].map((d, i) => (
            <g key={d} transform={`rotate(${d}) translate(0 -60) scale(${i % 2 ? 0.6 : 0.85})`}>
              <g className="orn-twinkle" style={t(2 + i * 0.3, -i * 0.5)}>
                <path d={STAR} fill={u(`${k}s`)} stroke="#a8740a" strokeWidth="0.8" strokeLinejoin="round" />
                <path d={STAR_LIT} fill="#fff" opacity="0.4" />
              </g>
            </g>
          ))}
        </g>
      );
    case "starfall":
      return (
        <g>
          <defs>
            {lg(`${k}tr`, [[0, "#fff6d6", 0], [1, "#ffe08a", 0.95]], 1, 1)}
            {lg(`${k}s`, [[0, "#ffffff"], [1, "#ffb21e"]])}
          </defs>
          {[[-62, -70, 0], [-26, -78, 1], [8, -74, 2], [-74, -36, 3]].map(([x, y, i]) => (
            <g key={i} transform={`translate(${x} ${y})`}>
              <g className="orn-fall" style={t(3.2 + i * 0.5, -i * 0.9)}>
                <path d="M-26 -16 L0 0" stroke={u(`${k}tr`)} strokeWidth="2.4" strokeLinecap="round" />
                <path d={STAR} transform="scale(0.45)" fill={u(`${k}s`)} />
              </g>
            </g>
          ))}
          {Array.from({ length: 8 }, (_, i) => {
            const a = i * 0.8 + 0.3;
            return (
              <g key={i} transform={`translate(${Math.cos(a) * (58 + (i % 3) * 4)} ${Math.sin(a) * (58 + (i % 3) * 4)}) scale(${0.25 + (i % 3) * 0.12})`}>
                <g className="orn-twinkle" style={t(1.6 + (i % 4) * 0.4, -i * 0.3)}>
                  <path d={STAR} fill={u(`${k}s`)} />
                </g>
              </g>
            );
          })}
        </g>
      );
    case "blossoms":
      return (
        <g>
          <defs>
            {rg(`${k}p`, [[0, "#ffffff"], [0.5, "#ffd1e3"], [1, "#ff86b6"]], 0.5, 1, 1)}
            {lg(`${k}l`, [[0, "#9be08f"], [1, "#3f8f4f"]])}
          </defs>
          {[[-46, -40, 1.2, 0], [48, 40, 1, 1], [57, 20, 0.65, 2], [-30, -56, 0.7, 3], [-56, -18, 0.55, 4]].map(([x, y, s, i]) => (
            <g key={i} transform={`translate(${x} ${y}) scale(${s})`}>
              <g className="orn-sway" style={t(3 + i * 0.5, -i)}>
                <path d="M0 0 C6 -2 12 2 14 8 C8 8 3 5 0 0 Z" fill={u(`${k}l`)} transform="rotate(30)" />
                {[0, 72, 144, 216, 288].map((a) => (
                  <path key={a} d="M0 0 C-5 -3 -6 -9 -3 -11 L0 -9.5 L3 -11 C6 -9 5 -3 0 0 Z" fill={u(`${k}p`)} stroke="#f48fb1" strokeWidth="0.4" transform={`rotate(${a})`} />
                ))}
                <circle r="2" fill="#ffcf4d" />
                {[0, 72, 144, 216, 288].map((a) => (
                  <circle key={a} cx="0" cy="-3.6" r="0.6" fill="#c2185b" transform={`rotate(${a + 36})`} />
                ))}
              </g>
            </g>
          ))}
        </g>
      );
    case "moon":
      return (
        <g>
          <defs>
            {rg(`${k}m`, [[0, "#ffffff"], [0.6, "#e6e9ff"], [1, "#9aa6d8"]], 0.35, 0.35, 0.75)}
            <mask id={`${k}cut`}>
              <rect x="-72" y="-72" width="144" height="144" fill="#fff" />
              <circle cx="62" cy="-62" r="13" fill="#000" />
            </mask>
          </defs>
          <g className="orn-bob">
            <circle cx="54" cy="-58" r="22" fill={glow} opacity="0.35" />
            <circle cx="54" cy="-56" r="16" fill={u(`${k}m`)} mask={`url(#${k}cut)`} />
            <circle cx="47" cy="-52" r="2.2" fill="#9aa6d8" opacity="0.6" />
            <circle cx="50" cy="-44" r="1.4" fill="#9aa6d8" opacity="0.6" />
          </g>
          {[[36, -66, 0.3], [70, -40, 0.25], [32, -48, 0.18]].map(([x, y, s], i) => (
            <g key={i} transform={`translate(${x} ${y}) scale(${s})`}>
              <path className="orn-twinkle" style={t(2 + i * 0.5, -i)} d={STAR} fill="#fff" />
            </g>
          ))}
        </g>
      );
    case "wisps":
      return (
        <g className="orn-orbit orn-orbit--slow">
          <defs>{lg(`${k}g`, [[0, "#ffffff"], [0.7, "#e6fff2"], [1, "#9de8c0"]])}</defs>
          {[0, 120, 240].map((d, i) => (
            <g key={d} transform={`rotate(${d}) translate(0 -62) rotate(${-d}) scale(1.15)`}>
              <g className="orn-float" style={t(2 + i * 0.4, -i * 0.6)}>
                <circle r="13" fill={glow} opacity="0.35" />
                <path d="M-9 10 V-2 A9 9 0 0 1 9 -2 V10 L6 7 L3 10 L0 7 L-3 10 L-6 7 Z" fill={u(`${k}g`)} />
                <ellipse cx="-3.2" cy="-1.5" rx="1.4" ry="2" fill="#123" />
                <ellipse cx="3.2" cy="-1.5" rx="1.4" ry="2" fill="#123" />
                <ellipse cx="-5.6" cy="2.4" rx="1.6" ry="0.9" fill="#ff9ec7" opacity="0.7" />
                <ellipse cx="5.6" cy="2.4" rx="1.6" ry="0.9" fill="#ff9ec7" opacity="0.7" />
                <path d="M-1.4 2.6 q1.4 1.4 2.8 0" stroke="#123" strokeWidth="0.8" fill="none" strokeLinecap="round" />
              </g>
            </g>
          ))}
        </g>
      );
    case "bolts": {
      const arc = (start: number, span: number, seed: number) => {
        const pts: string[] = [];
        const n = 9;
        for (let i = 0; i <= n; i++) {
          const a = ((start + (span * i) / n) * Math.PI) / 180;
          const r = 55 + (i === 0 || i === n ? 0 : (R(i, seed) - 0.5) * 12);
          pts.push(`${(Math.cos(a) * r).toFixed(1)},${(Math.sin(a) * r).toFixed(1)}`);
        }
        return pts.join(" ");
      };
      return (
        <g>
          <defs>
            <filter id={`${k}gl`} x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="2" />
            </filter>
            {lg(`${k}b`, [[0, "#ffffff"], [0.4, "#fff200"], [1, "#e0a800"]])}
          </defs>
          {[[-150, 60, 1], [-40, 50, 2], [60, 70, 3], [170, 55, 4], [250, 45, 5]].map(([s, span, seed], i) => (
            <g key={i} className="orn-zap" style={t(1.3 + i * 0.27, -i * 0.37)}>
              <polyline points={arc(s, span, seed)} fill="none" stroke="#fff200" strokeWidth="4" filter={u(`${k}gl`)} />
              <polyline points={arc(s, span, seed)} fill="none" stroke="#ffffff" strokeWidth="1.3" strokeLinejoin="round" />
            </g>
          ))}
          <Mirror>
            <g className="orn-jolt" style={t(2.4)}>
              <path d="M-60 -24 L-71 -2 L-62 -2 L-69 20 L-51 -6 L-60 -6 L-53 -24 Z" fill={u(`${k}b`)} stroke="#a37a00" strokeWidth="1" strokeLinejoin="round" />
              <path d="M-60 -24 L-71 -2 L-66 -2 Z" fill="#fff" opacity="0.6" />
            </g>
          </Mirror>
          {Array.from({ length: 6 }, (_, i) => (
            <circle key={i} className="orn-sparkle" style={t(0.9 + i * 0.2, -i * 0.3)} cx={Math.cos(i * 1.05 + 0.4) * 62} cy={Math.sin(i * 1.05 + 0.4) * 62} r="1.4" fill="#fff9b0" />
          ))}
        </g>
      );
    }
    case "petals": {
      const c = color ?? "#ffd23f";
      return (
        <g>
          <defs>{lg(`${k}p`, [[0, lt(c, 0.5)], [0.5, c], [1, dk(mix(c, "#f4a259", 0.5), 0.15)]])}</defs>
          <g className="orn-spin" style={t(60)}>
            {Array.from({ length: 20 }, (_, i) => (
              <g key={i} transform={`rotate(${i * 18 + 9}) translate(0 -58)`}>
                <path d="M0 6 C-5 2 -5 -8 0 -13 C5 -8 5 2 0 6 Z" fill={dk(c, 0.2)} />
              </g>
            ))}
            {Array.from({ length: 20 }, (_, i) => (
              <g key={i} transform={`rotate(${i * 18}) translate(0 -58)`}>
                <path d="M0 6 C-5.5 2 -5.5 -9 0 -14 C5.5 -9 5.5 2 0 6 Z" fill={u(`${k}p`)} stroke={dk(c, 0.3)} strokeWidth="0.5" />
                <path d="M0 4 L0 -10" stroke={dk(c, 0.25)} strokeWidth="0.6" opacity="0.6" />
              </g>
            ))}
          </g>
        </g>
      );
    }
    default:
      return null;
  }
}
