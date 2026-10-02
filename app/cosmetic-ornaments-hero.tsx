"use client";

import type { CSSProperties, ReactNode } from "react";
import type { Ornament } from "../lib/cosmetics";
import { R } from "./scene-kit";

// Signature frame ornaments (round 3): proper feathered wings, a real firebird, a comet, branching
// lightning, sunflowers, a light-splitting prism, silver swooshes, a sea scene, obsidian crystals and
// neon signs. Same canvas as the others: viewBox -72..72, avatar radius 50.

type Stop = [number, string, number?];
const st = (s: Stop[]) => s.map(([o, c, op], i) => <stop key={i} offset={o} stopColor={c} stopOpacity={op ?? 1} />);
const lg = (id: string, s: Stop[], x2 = 0, y2 = 1, x1 = 0, y1 = 0) => (
  <linearGradient id={id} x1={x1} y1={y1} x2={x2} y2={y2}>
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

/** Point on a cubic bezier. */
function bez(p: [number, number][], tt: number): [number, number] {
  const m = 1 - tt;
  const a = m * m * m;
  const b = 3 * m * m * tt;
  const c = 3 * m * tt * tt;
  const d = tt * tt * tt;
  return [a * p[0][0] + b * p[1][0] + c * p[2][0] + d * p[3][0], a * p[0][1] + b * p[1][1] + c * p[2][1] + d * p[3][1]];
}

/** A feather pointing down its own +y axis. `flame` gives it a flickering pointed tip. */
const feather = (len: number, w: number, flame = false) =>
  flame
    ? `M0 0 C${w} ${len * 0.25} ${w * 1.1} ${len * 0.6} ${w * 0.2} ${len * 0.85} L0 ${len} L${-w * 0.3} ${len * 0.8} C${-w * 1.1} ${len * 0.6} ${-w} ${len * 0.25} 0 0 Z`
    : `M0 0 C${w} ${len * 0.2} ${w} ${len * 0.75} 0 ${len} C${-w} ${len * 0.75} ${-w} ${len * 0.2} 0 0 Z`;

/**
 * A raised left wing: a curved arm (leading edge) from the shoulder up and out, with primaries hanging
 * from the outer half, secondaries from the inner half and a row of small coverts over the top.
 */
function Wing({ edge, fill, cover, stroke, bone, flame = false, scale = 1 }: { edge: [number, number][]; fill: string; cover: string; stroke: string; bone: string; flame?: boolean; scale?: number }) {
  const parts: ReactNode[] = [];
  const add = (tt: number, len: number, w: number, ang: number, paint: string, key: string) => {
    const [x, y] = bez(edge, tt);
    parts.push(
      <g key={key} transform={`translate(${f(x)} ${f(y)}) rotate(${ang})`}>
        <path d={feather(len * scale, w, flame)} fill={paint} stroke={stroke} strokeWidth="0.5" className={flame ? "orn-flick" : undefined} style={flame ? t(0.6 + R(tt * 10, 3) * 0.4, -R(tt * 10, 4)) : undefined} />
      </g>,
    );
  };
  // Primaries: longest at the tip, splaying outward
  for (let i = 0; i < 6; i++) add(1 - i * 0.085, 34 - i * 2.4, 4.2, 46 - i * 5, fill, `p${i}`);
  // Secondaries
  for (let i = 0; i < 6; i++) add(0.5 - i * 0.08, 22 - i * 1.2, 4, 16 - i * 2.5, fill, `s${i}`);
  // Coverts over the top
  for (let i = 0; i < 9; i++) add(0.08 + i * 0.105, 11 + i * 0.6, 3.4, 10 + i * 3.5, cover, `c${i}`);
  return (
    <g>
      {parts}
      <path d={`M${edge[0].join(" ")} C${edge[1].join(" ")} ${edge[2].join(" ")} ${edge[3].join(" ")}`} fill="none" stroke={bone} strokeWidth="3" strokeLinecap="round" />
    </g>
  );
}

function Sunflower({ k, x, y, s, i }: { k: string; x: number; y: number; s: number; i: number }) {
  // Seeds on a golden-angle spiral
  const seeds = Array.from({ length: 46 }, (_, j) => {
    const r = Math.sqrt(j / 46) * 7.2;
    const a = j * 137.5;
    const [sx, sy] = pol(r, a);
    return <circle key={j} cx={f(sx)} cy={f(sy)} r={0.55 + (j / 46) * 0.35} fill={j % 3 ? "#3a1f08" : "#6b3a12"} />;
  });
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <g className="orn-sway" style={t(3.4 + i, -i)}>
        <path d="M0 8 C2 20 0 30 -2 40" fill="none" stroke="#3f7a2a" strokeWidth="2.6" strokeLinecap="round" />
        <path d="M-1 24 C-10 18 -20 20 -24 28 C-14 30 -6 30 -1 24 Z" fill={u(`${k}lf`)} />
        <path d="M-1 24 C-10 22 -18 24 -24 28" fill="none" stroke="#2a5a1a" strokeWidth="0.6" />
        {Array.from({ length: 18 }, (_, j) => (
          <path key={`b${j}`} d="M0 -6 C-3.2 -10 -3 -17 0 -21 C3 -17 3.2 -10 0 -6 Z" fill={u(`${k}pd`)} transform={`rotate(${j * 20 + 10})`} />
        ))}
        {Array.from({ length: 18 }, (_, j) => (
          <g key={`p${j}`} transform={`rotate(${j * 20})`}>
            <path d="M0 -6 C-3.6 -10 -3.4 -18 0 -23 C3.4 -18 3.6 -10 0 -6 Z" fill={u(`${k}p`)} />
            <path d="M0 -8 L0 -20" stroke="#d98a00" strokeWidth="0.5" opacity="0.6" />
          </g>
        ))}
        <circle r="8.4" fill={u(`${k}c`)} />
        {seeds}
        <circle r="8.4" fill={u(`${k}cs`)} />
      </g>
    </g>
  );
}

export function HeroOrnament({ kind, k }: { kind: Ornament; k: string }): ReactNode {
  switch (kind) {
    // Angelic: real feathered wings raised from the shoulders
    case "wings":
      return (
        <g>
          <defs>
            {lg(`${k}f`, [[0, "#ffffff"], [0.6, "#f6efdc"], [1, "#d9c58b"]])}
            {lg(`${k}c`, [[0, "#ffffff"], [1, "#efe6cc"]])}
            {lg(`${k}b`, [[0, "#fffdf5"], [1, "#e0cf9a"]], 1, 0)}
          </defs>
          <Mirror>
            <g className="orn-flap" style={t(3)}>
              <Wing edge={[[-46, -6], [-52, -28], [-64, -42], [-82, -46]]} fill={u(`${k}f`)} cover={u(`${k}c`)} stroke="#c9b27a" bone={u(`${k}b`)} scale={0.86} />
            </g>
          </Mirror>
        </g>
      );
    // Phoenix: a firebird perched on top, wings of flame raised, tail streamers trailing down both sides
    case "phoenix":
      return (
        <g>
          <defs>
            {lg(`${k}w`, [[0, "#fff6a8"], [0.35, "#ffb300"], [0.75, "#ff4a00"], [1, "#c41a00", 0.85]])}
            {lg(`${k}c`, [[0, "#fff6a8"], [1, "#ff8a00"]])}
            {lg(`${k}b`, [[0, "#ffe680"], [1, "#ff6a00"]], 1, 0)}
            {rg(`${k}g`, [[0, "#ffd36b", 0.7], [1, "#ff6a00", 0]])}
            {rg(`${k}bd`, [[0, "#fff3b0"], [0.5, "#ff9a1f"], [1, "#c43a00"]], 0.4, 0.3, 0.75)}
          </defs>
          <circle cx="0" cy="-62" r="26" fill={u(`${k}g`)} className="orn-glint" style={t(1.6)} />
          {/* Tail streamers */}
          <Mirror>
            <path className="orn-flick" style={t(1.2)} d="M-4 -50 C-30 -60 -66 -40 -66 0 C-66 30 -52 48 -40 58" fill="none" stroke={u(`${k}w`)} strokeWidth="3" strokeLinecap="round" />
            <path d="M-8 -52 C-34 -58 -62 -34 -60 4 C-59 26 -50 40 -44 48" fill="none" stroke="#ffd36b" strokeWidth="1" strokeLinecap="round" opacity="0.7" />
            <g transform="translate(-40 58)">
              <path className="orn-flick" style={t(0.7)} d="M0 0 C-6 4 -6 12 0 16 C6 12 6 4 0 0 Z" fill={u(`${k}w`)} />
              <circle cy="7" r="2.2" fill="#3a8cff" stroke="#fff6a8" strokeWidth="0.8" />
            </g>
          </Mirror>
          {/* Wings */}
          <Mirror>
            <g className="orn-flap" style={t(1.8)}>
              <Wing edge={[[-6, -64], [-18, -84], [-44, -92], [-74, -84]]} fill={u(`${k}w`)} cover={u(`${k}c`)} stroke="#c43a00" bone={u(`${k}b`)} flame scale={0.78} />
            </g>
          </Mirror>
          {/* Body, head and crest */}
          <path d="M0 -50 C-8 -54 -9 -64 -4 -70 L4 -70 C9 -64 8 -54 0 -50 Z" fill={u(`${k}bd`)} />
          <circle cx="0" cy="-74" r="5.2" fill={u(`${k}bd`)} />
          <path d="M-1.6 -71.5 L0 -67.5 L1.6 -71.5 Z" fill="#ffe680" stroke="#8a3a00" strokeWidth="0.4" />
          <circle cx="-2" cy="-75" r="0.9" fill="#2a0a00" />
          <circle cx="2" cy="-75" r="0.9" fill="#2a0a00" />
          {[-24, 0, 24].map((a, i) => (
            <g key={a} transform={`translate(0 -78) rotate(${a})`}>
              <path className="orn-flick" style={t(0.6 + i * 0.15, -i * 0.2)} d="M0 0 C-3 -5 -2.6 -11 0 -15 C2.6 -11 3 -5 0 0 Z" fill={u(`${k}c`)} />
            </g>
          ))}
          {Array.from({ length: 6 }, (_, i) => {
            const [x, y] = pol(60, 200 + i * 28);
            return <circle key={i} cx={x} cy={y} r="1" fill="#ffd36b" className="orn-rise" style={t(1.8 + R(i, 3), -R(i, 4) * 2)} />;
          })}
        </g>
      );
    // Starfall: a comet sweeping around the ring, and a constellation
    case "starfall": {
      const trail = Array.from({ length: 13 }, (_, i) => pol(62, 270 - i * 7));
      return (
        <g>
          <defs>
            {rg(`${k}h`, [[0, "#ffffff"], [0.3, "#fff3c4"], [1, "#ffb21e", 0]])}
          </defs>
          <g className="orn-orbit" style={t(7)}>
            {trail.slice(1).map(([x, y], i) => {
              const [px, py] = trail[i];
              return <line key={i} x1={f(px)} y1={f(py)} x2={f(x)} y2={f(y)} stroke={i < 4 ? "#fff6d6" : "#ffd36b"} strokeWidth={3.4 - i * 0.26} strokeLinecap="round" opacity={1 - i * 0.075} />;
            })}
            <circle cx="0" cy="-62" r="9" fill={u(`${k}h`)} />
            <path d="M0 -68 L1.4 -63.4 L6 -62 L1.4 -60.6 L0 -56 L-1.4 -60.6 L-6 -62 L-1.4 -63.4 Z" fill="#fff" />
          </g>
          <g stroke="#ffe9a8" strokeWidth="0.6" opacity="0.6">
            <polyline points="40,44 50,52 62,48 66,36 58,30" fill="none" />
          </g>
          {[[40, 44], [50, 52], [62, 48], [66, 36], [58, 30], [-60, -30], [-66, 20], [-48, 52]].map(([x, y], i) => (
            <g key={i} transform={`translate(${x} ${y}) scale(${i < 5 ? 0.38 : 0.28})`}>
              <path className="orn-twinkle" style={t(1.8 + i * 0.3, -i * 0.4)} d="M0 -6 L1.6 -1.6 L6 0 L1.6 1.6 L0 6 L-1.6 1.6 L-6 0 L-1.6 -1.6 Z" fill="#fff6d6" />
            </g>
          ))}
        </g>
      );
    }
    // Electric: branching lightning leaping out from the ring, and sparks racing round it
    case "bolts": {
      const bolt = (a: number, seed: number) => {
        const pts: [number, number][] = [];
        const branches: string[] = [];
        let r = 52;
        let ang = a;
        pts.push(pol(r, ang));
        for (let i = 0; i < 6; i++) {
          r += 3.4 + R(i, seed) * 2;
          ang += (R(i, seed + 1) - 0.5) * 14;
          const p = pol(r, ang);
          pts.push(p);
          if (i === 2 || i === 4) {
            const b1 = pol(r + 5, ang + (R(i, seed + 2) > 0.5 ? 12 : -12));
            const b2 = pol(r + 9, ang + (R(i, seed + 3) > 0.5 ? 18 : -18));
            branches.push(`M${f(p[0])} ${f(p[1])} L${f(b1[0])} ${f(b1[1])} L${f(b2[0])} ${f(b2[1])}`);
          }
        }
        return { main: `M${pts.map(([x, y]) => `${f(x)} ${f(y)}`).join(" L")}`, branches };
      };
      return (
        <g>
          <defs>
            <filter id={`${k}gl`} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2.2" />
            </filter>
          </defs>
          {[-150, -95, -30, 20, 80, 140, 200].map((a, i) => {
            const b = bolt(a, i * 7 + 1);
            return (
              <g key={a} className="orn-zap" style={t(1.1 + i * 0.23, -i * 0.31)}>
                <path d={b.main} fill="none" stroke="#fff35a" strokeWidth="4.5" filter={u(`${k}gl`)} />
                <path d={b.main} fill="none" stroke="#ffffff" strokeWidth="1.4" strokeLinejoin="round" />
                {b.branches.map((d, j) => (
                  <path key={j} d={d} fill="none" stroke="#fffbd0" strokeWidth="0.8" strokeLinejoin="round" />
                ))}
              </g>
            );
          })}
          {[0, 1, 2].map((i) => (
            <g key={i} className="orn-orbit" style={t(1.4 + i * 0.35, -i * 0.5)}>
              <path d={`M${f(pol(55, -90)[0])} ${f(pol(55, -90)[1])} A55 55 0 0 0 ${f(pol(55, -130)[0])} ${f(pol(55, -130)[1])}`} fill="none" stroke="#fff35a" strokeWidth="1.6" opacity="0.5" strokeLinecap="round" transform={`rotate(${i * 120})`} />
              <circle cx={f(pol(55, -90 + i * 120)[0])} cy={f(pol(55, -90 + i * 120)[1])} r="2.2" fill="#ffffff" filter={u(`${k}gl`)} />
              <circle cx={f(pol(55, -90 + i * 120)[0])} cy={f(pol(55, -90 + i * 120)[1])} r="1.3" fill="#ffffff" />
            </g>
          ))}
        </g>
      );
    }
    // Sunflower: two real sunflowers with leaves
    case "sunflowers":
      return (
        <g>
          <defs>
            {lg(`${k}p`, [[0, "#ffe680"], [0.6, "#ffcc1a"], [1, "#f29a00"]], 0, 0, 0, 1)}
            {lg(`${k}pd`, [[0, "#e8a800"], [1, "#b86e00"]], 0, 0, 0, 1)}
            {rg(`${k}c`, [[0, "#8a5a20"], [1, "#2a1606"]])}
            {rg(`${k}cs`, [[0, "#fff", 0.18], [0.5, "#fff", 0], [1, "#000", 0.3]], 0.35, 0.3, 0.7)}
            {lg(`${k}lf`, [[0, "#8fd36a"], [1, "#2f6b1f"]])}
          </defs>
          <Sunflower k={k} x={-50} y={46} s={1.05} i={0} />
          <Sunflower k={k} x={52} y={-48} s={0.72} i={1} />
        </g>
      );
    // Prism: a glass prism splits a beam of light into a rainbow that wraps the top of the ring
    case "crystals": {
      const colors = ["#ff4d4d", "#ff9a3c", "#ffe14d", "#4dff88", "#4dc3ff", "#8a6bff"];
      return (
        <g>
          <defs>
            {lg(`${k}g`, [[0, "#ffffff", 0.9], [0.5, "#dff4ff", 0.45], [1, "#b8d8ff", 0.7]], 1, 1)}
            {lg(`${k}beam`, [[0, "#ffffff", 0], [1, "#ffffff", 0.95]], 1, 0)}
          </defs>
          <line x1="-96" y1="-70" x2="-62" y2="-52" stroke={u(`${k}beam`)} strokeWidth="2.4" strokeLinecap="round" />
          <g className="orn-shimmer" style={t(2.6)}>
            {colors.map((c, i) => {
              const r = 57 + i * 2.2;
              const [x1, y1] = pol(r, 222);
              const [x2, y2] = pol(r, 336);
              return <path key={c} d={`M${f(x1)} ${f(y1)} A${r} ${r} 0 0 1 ${f(x2)} ${f(y2)}`} fill="none" stroke={c} strokeWidth="2.3" opacity="0.85" strokeLinecap="round" />;
            })}
          </g>
          <g transform="translate(-50 -50) rotate(-20)">
            <path d="M0 -13 L12 9 L-12 9 Z" fill={u(`${k}g`)} stroke="#ffffff" strokeWidth="1" strokeLinejoin="round" />
            <path d="M0 -13 L4 9 L-12 9 Z" fill="#ffffff" opacity="0.35" />
            <path d="M0 -13 L12 9" stroke="#ffffff" strokeWidth="1.6" opacity="0.9" />
          </g>
          {[[56, -24], [40, -44], [62, -6]].map(([x, y], i) => (
            <path key={i} className="orn-sparkle" style={t(1.8 + i * 0.4, -i * 0.6)} d={`M${x} ${y - 3} L${x + 0.8} ${y - 0.8} L${x + 3} ${y} L${x + 0.8} ${y + 0.8} L${x} ${y + 3} L${x - 0.8} ${y + 0.8} L${x - 3} ${y} L${x - 0.8} ${y - 0.8} Z`} fill="#ffffff" />
          ))}
        </g>
      );
    }
    // Silver Sweep: polished silver blades sweeping round the ring with a travelling glint
    case "swoosh": {
      const blade = (start: number, span: number) => {
        const outer: string[] = [];
        const inner: string[] = [];
        for (let i = 0; i <= 20; i++) {
          const tt = i / 20;
          const a = start + tt * span;
          const w = Math.sin(tt * Math.PI) ** 0.8 * 8;
          const [ox, oy] = pol(60 + w, a);
          const [ix, iy] = pol(60, a);
          outer.push(`${f(ox)},${f(oy)}`);
          inner.unshift(`${f(ix)},${f(iy)}`);
        }
        return [...outer, ...inner].join(" ");
      };
      return (
        <g>
          <defs>
            {lg(`${k}s`, [[0, "#ffffff"], [0.4, "#d6dbe3"], [0.7, "#8a94a3"], [1, "#e9edf2"]], 1, 1)}
          </defs>
          <g className="orn-orbit" style={t(16)}>
            {[200, 20].map((a) => (
              <g key={a}>
                <polygon points={blade(a, 110)} fill={u(`${k}s`)} stroke="#5c6b7a" strokeWidth="0.5" />
                <path d={`M${f(pol(62, a + 20)[0])} ${f(pol(62, a + 20)[1])} A62 62 0 0 1 ${f(pol(62, a + 90)[0])} ${f(pol(62, a + 90)[1])}`} fill="none" stroke="#ffffff" strokeWidth="0.9" opacity="0.8" />
                <g transform={`translate(${f(pol(66, a + 55)[0])} ${f(pol(66, a + 55)[1])})`}>
                  <path className="orn-sparkle" style={t(2.2)} d="M0 -5 L1 -1 L5 0 L1 1 L0 5 L-1 1 L-5 0 L-1 -1 Z" fill="#ffffff" />
                </g>
              </g>
            ))}
          </g>
        </g>
      );
    }
    // Ocean Tide: waves breaking along the bottom, a leaping dolphin, a shell and a starfish
    case "wave":
      return (
        <g>
          <defs>
            {lg(`${k}a`, [[0, "#5ad1ff"], [1, "#0b3d91"]])}
            {lg(`${k}b`, [[0, "#a6f0ff"], [0.5, "#1fa2ff"], [1, "#0b4fa8"]])}
            {lg(`${k}d`, [[0, "#9fb8d6"], [0.6, "#5a7aa8"], [1, "#2a3f66"]])}
            {rg(`${k}bb`, [[0, "#ffffff", 0.9], [0.5, "#bfefff", 0.2], [1, "#bfefff", 0.7]], 0.35, 0.3, 0.7)}
          </defs>
          <path d="M-58 36 C-50 50 -30 62 0 64 C30 62 50 50 58 36 C54 46 44 50 38 46 C30 54 14 58 0 58 C-16 58 -32 52 -40 46 C-46 50 -56 46 -58 36 Z" fill={u(`${k}a`)} />
          <g className="orn-drift" style={t(3)}>
            <path d="M-54 44 C-44 58 -20 70 4 70 C28 70 46 58 54 46 C50 54 40 56 34 52 C34 60 22 64 12 62 C4 66 -10 66 -18 62 C-26 64 -40 58 -44 52 C-48 54 -52 50 -54 44 Z" fill={u(`${k}b`)} />
            <path d="M-54 44 C-44 58 -20 70 4 70 C28 70 46 58 54 46" fill="none" stroke="#ffffff" strokeWidth="1.6" strokeLinecap="round" opacity="0.9" strokeDasharray="6 3" />
          </g>
          {[[-44, 50], [44, 50], [-20, 64], [24, 64]].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r={1.6} fill="#ffffff" opacity="0.85" />
          ))}
          {/* Dolphin leaping in an arc at the top right */}
          <g transform="translate(46 -30)">
            <g className="orn-leap" style={t(3.6)}>
              <g transform="translate(0 -30)">
                <path d="M-12 2 C-6 -6 6 -8 12 -2 C10 0 8 1 6 1 L10 6 L4 3 C0 4 -6 4 -12 2 Z" fill={u(`${k}d`)} />
                <path d="M-1 -5 L2 -11 L4 -5 Z" fill="#5a7aa8" />
                <path d="M-12 2 L-17 -2 L-16 4 Z" fill="#5a7aa8" />
                <circle cx="8" cy="-2.6" r="0.7" fill="#0b1a33" />
              </g>
            </g>
          </g>
          {/* Starfish and a shell */}
          <path d="M-58 56 l2 -5 l2 5 l5 1 l-4 3 l1 5 l-4 -3 l-4 3 l1 -5 l-4 -3 Z" fill="#ff8a65" stroke="#c4501b" strokeWidth="0.5" />
          <g transform="translate(58 60)">
            <path d="M0 4 C-7 4 -8 -3 0 -6 C8 -3 7 4 0 4 Z" fill="#ffe1d0" stroke="#c49a8a" strokeWidth="0.6" />
            <path d="M0 4 L-4 -3 M0 4 L-1 -5 M0 4 L2 -5 M0 4 L5 -2" stroke="#c49a8a" strokeWidth="0.5" />
          </g>
          {Array.from({ length: 5 }, (_, i) => (
            <circle key={i} cx={-24 + i * 12} cy="56" r={1.2 + R(i, 3) * 1.6} fill={u(`${k}bb`)} className="orn-rise" style={t(2.4 + R(i, 4) * 1.4, -R(i, 5) * 3)} />
          ))}
        </g>
      );
    // Obsidian: clusters of black volcanic glass crystals, lit violet from within
    case "shards": {
      const crystal = (len: number, w: number, ang: number, key: string) => (
        <g key={key} transform={`rotate(${ang})`}>
          <path d={`M${-w} 0 L${-w} ${-len * 0.75} L0 ${-len} L0 0 Z`} fill={u(`${k}l`)} />
          <path d={`M${w} 0 L${w} ${-len * 0.75} L0 ${-len} L0 0 Z`} fill={u(`${k}r`)} />
          <path d={`M0 0 L0 ${-len}`} stroke="#c9a7ff" strokeWidth="0.7" opacity="0.85" />
          <path d={`M${-w} ${-len * 0.75} L0 ${-len} L${w} ${-len * 0.75}`} fill="none" stroke="#e9d8ff" strokeWidth="0.6" opacity="0.7" />
        </g>
      );
      const cluster = (x: number, y: number, rot: number, s: number, i: number) => (
        <g key={i} transform={`translate(${x} ${y}) rotate(${rot}) scale(${s})`}>
          <ellipse cx="0" cy="0" rx="12" ry="5" fill={u(`${k}g`)} className="orn-glint" style={t(2.4 + i * 0.4)} />
          {crystal(22, 4.6, -30, "a")}
          {crystal(32, 6, -6, "b")}
          {crystal(24, 5, 20, "c")}
          {crystal(14, 3.8, 42, "d")}
          {crystal(13, 3.4, -52, "e")}
          <path className="orn-sparkle" style={t(2.2 + i * 0.5, -i)} d="M2 -26 l0.8 2 l2 0.8 l-2 0.8 l-0.8 2 l-0.8 -2 l-2 -0.8 l2 -0.8 Z" fill="#ffffff" />
        </g>
      );
      return (
        <g>
          <defs>
            {lg(`${k}l`, [[0, "#3a2a4a"], [0.5, "#6a5a8a"], [1, "#1a1424"]], 1, 0)}
            {lg(`${k}r`, [[0, "#000000"], [1, "#1a1424"]], 1, 0)}
            {rg(`${k}g`, [[0, "#b46cff", 0.75], [1, "#b46cff", 0]])}
          </defs>
          {cluster(-42, 48, -138, 1.2, 0)}
          {cluster(46, -44, 42, 1.1, 1)}
          {cluster(-60, -16, -100, 0.8, 2)}
          {cluster(58, 28, 112, 0.72, 3)}
        </g>
      );
    }
    // Neon Pulse: neon signs (a heart and a star) mounted beside the tube ring
    case "neontube": {
      const sign = (x: number, y: number, s: number, d: string, color: string, core: string, delay: number, key: string) => (
        <g key={key} transform={`translate(${x} ${y}) scale(${s})`}>
          <g className="orn-neon" style={t(4.5, delay)}>
            <path d={d} fill="none" stroke={color} strokeWidth="5" filter={u(`${k}gl`)} strokeLinejoin="round" strokeLinecap="round" />
            <path d={d} fill="none" stroke={color} strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />
            <path d={d} fill="none" stroke={core} strokeWidth="1" strokeLinejoin="round" strokeLinecap="round" />
          </g>
        </g>
      );
      return (
        <g>
          <defs>
            <filter id={`${k}gl`} x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="2.4" />
            </filter>
            {lg(`${k}m`, [[0, "#d9dde5"], [0.5, "#7a808c"], [1, "#3a3f48"]], 1, 0)}
          </defs>
          {[-90, 0, 90, 180].map((a) => {
            const [x, y] = pol(55, a);
            return <rect key={a} x={x - 2.6} y={y - 4.5} width="5.2" height="9" rx="1.2" fill={u(`${k}m`)} transform={`rotate(${a} ${x} ${y})`} />;
          })}
          {sign(54, 50, 1.6, "M0 6 C-2 4 -8 1 -8 -3 A3.6 3.6 0 0 1 0 -5 A3.6 3.6 0 0 1 8 -3 C8 1 2 4 0 6 Z", "#ff2bd6", "#ffe1f8", 0, "h")}
          {sign(-56, -50, 1.4, "M0 -8 L2.4 -2.6 L8 -2.4 L3.6 1.2 L5 7 L0 3.8 L-5 7 L-3.6 1.2 L-8 -2.4 L-2.4 -2.6 Z", "#00e5ff", "#e0fdff", -1.7, "s")}
          {sign(-58, 46, 1, "M-5 -6 L1 -1 L-2 0 L4 6", "#b6ff3a", "#f2ffd6", -3, "z")}
        </g>
      );
    }
    default:
      return null;
  }
}
