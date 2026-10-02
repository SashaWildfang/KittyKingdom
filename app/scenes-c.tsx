"use client";

import type { ReactNode } from "react";
import { anim, Bird, Cloud, CloudDefs, dk, H, hillEdge, hillPath, hillY, LG, lt, Mist, mix, Orb, R, RG, Sky, Stars, url, Vignette, W, wavePath } from "./scene-kit";
import type { Opts } from "./scenes-a";

// Stand-alone banner scenes with their own composition (not palette swaps of another scene).

const f = (n: number) => n.toFixed(1);

/** An irregular blob outline around (cx, cy). */
function blob(cx: number, cy: number, rx: number, ry: number, seed: number, bumps = 9, rough = 0.18) {
  const pts: [number, number][] = [];
  const n = 36;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const k = 1 + Math.sin(a * bumps + seed) * rough * 0.6 + (R(i, seed) - 0.5) * rough;
    pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
  }
  let d = `M${f((pts[0][0] + pts[n - 1][0]) / 2)} ${f((pts[0][1] + pts[n - 1][1]) / 2)}`;
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    const q = pts[(i + 1) % n];
    d += ` Q${f(p[0])} ${f(p[1])} ${f((p[0] + q[0]) / 2)} ${f((p[1] + q[1]) / 2)}`;
  }
  return `${d} Z`;
}

/** A path of varying width around a centre line (lava flows, waterfalls, rivers). */
function ribbon(line: [number, number][], width: (t: number) => number) {
  const left: string[] = [];
  const right: string[] = [];
  line.forEach(([x, y], i) => {
    const p = line[Math.max(0, i - 1)];
    const q = line[Math.min(line.length - 1, i + 1)];
    const dx = q[0] - p[0];
    const dy = q[1] - p[1];
    const len = Math.hypot(dx, dy) || 1;
    const w = width(i / (line.length - 1)) / 2;
    left.push(`${f(x - (dy / len) * w)} ${f(y + (dx / len) * w)}`);
    right.unshift(`${f(x + (dy / len) * w)} ${f(y - (dx / len) * w)}`);
  });
  return `M${left.join(" L")} L${right.join(" L")} Z`;
}

/** A wandering line from a to b. */
function wander(a: [number, number], b: [number, number], n: number, amp: number, seed: number): [number, number][] {
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n;
    return [a[0] + (b[0] - a[0]) * t + Math.sin(t * 7 + seed) * amp * Math.sin(t * Math.PI) + (R(i, seed) - 0.5) * amp * 0.4, a[1] + (b[1] - a[1]) * t];
  });
}

// ============ Misty Highlands: rolling patchwork hills, stone walls, sheep and a cottage ============
export function Highlands({ p, id }: Opts) {
  const [sky1, sky2, sun, far, mid, near] = p;
  const sheep = (x: number, y: number, s: number, k: number, flip = false) => (
    <g key={k} transform={`translate(${x} ${y}) scale(${flip ? -s : s} ${s})`}>
      <g {...(k % 2 ? anim("sc-bob", 2.4 + k * 0.3, -k) : {})}>
        <ellipse cx="0" cy="3" rx="9" ry="2" fill="#000" opacity="0.18" />
        <rect x="-5" y="-1" width="1.6" height="4" fill="#2a2a2a" />
        <rect x="3" y="-1" width="1.6" height="4" fill="#2a2a2a" />
        {[[-4, -4, 4], [0, -6, 4.6], [4, -4, 4], [-1, -2, 4.4], [3, -1, 3.6]].map(([cx, cy, r], i) => (
          <circle key={i} cx={cx} cy={cy} r={r} fill={url(`${id}wool`)} />
        ))}
        <ellipse cx="8" cy="-5" rx="2.6" ry="3.2" fill="#2a2a2a" />
        <ellipse cx="6.4" cy="-7.2" rx="1.6" ry="0.8" fill="#2a2a2a" />
      </g>
    </g>
  );
  const wall = (y: number, amp: number, seed: number, waves: number, x0: number, x1: number, k: number) => {
    const pts = Array.from({ length: 30 }, (_, i) => {
      const x = x0 + ((x1 - x0) * i) / 29;
      return `${f(x)} ${f(hillY(x, y, amp, seed, waves) + 6)}`;
    });
    return <path key={k} d={`M${pts.join(" L")}`} fill="none" stroke={mix("#9a9a8a", near, 0.2)} strokeWidth="2.2" strokeDasharray="3 1.4" strokeLinecap="round" />;
  };
  return (
    <>
      <Sky id={id} top={sky1} bottom={sky2} horizon={lt(sun, 0.2)} />
      <defs>
        <RG id={`${id}wool`} cx={0.4} cy={0.35} r={0.7} s={[[0, "#ffffff"], [0.7, "#f1efe6"], [1, "#c9c4b4"]]} />
        <LG id={`${id}stone`} x2={1} y2={0} s={[[0, "#d8d2c2"], [1, "#9a9282"]]} />
        <LG id={`${id}thatch`} s={[[0, "#d9b46a"], [1, "#8a6a2e"]]} />
        <clipPath id={`${id}midclip`}>
          <path d={hillPath(150, 12, 1.4, 2.2)} />
        </clipPath>
        <clipPath id={`${id}nearclip`}>
          <path d={hillPath(178, 10, 3.1, 1.8)} />
        </clipPath>
      </defs>
      <Orb id={id} x={620} y={92} r={26} color={sun} rays />
      <CloudDefs id={id} color="#ffffff" shade={mix("#ffffff", sky1, 0.4)} />
      <g {...anim("sc-drift", 32)}>
        <Cloud id={id} x={300} y={74} s={0.75} seed={2} opacity={0.85} />
        <Cloud id={id} x={820} y={66} s={0.6} seed={5} opacity={0.8} />
      </g>
      {/* Soft far mountains */}
      <path d={hillPath(118, 16, 0.4, 1.6)} fill={mix(far, sky2, 0.45)} />
      <Mist id={id} k="m0" y={100} h={40} color="#ffffff" opacity={0.55} dur={26} />
      <path d={hillPath(132, 12, 2.2, 2.4)} fill={mix(far, sky2, 0.2)} />
      <Mist id={id} k="m1" y={120} h={34} color="#ffffff" opacity={0.5} dur={20} />
      {/* Patchwork fields on the mid hill */}
      <path d={hillPath(150, 12, 1.4, 2.2)} fill={mid} />
      <g clipPath={`url(#${id}midclip)`}>
        {Array.from({ length: 9 }, (_, i) => (
          <rect key={i} x={-40 + i * 125} y="120" width="128" height="80" fill={[lt(mid, 0.12), dk(mid, 0.08), mix(mid, "#c9c26a", 0.25), lt(mid, 0.05)][i % 4]} transform={`skewX(${(R(i, 3) - 0.5) * 30})`} />
        ))}
        {Array.from({ length: 9 }, (_, i) => (
          <line key={i} x1={-40 + i * 125} y1="120" x2={-40 + i * 125 + 30} y2="200" stroke={dk(mid, 0.35)} strokeWidth="1.6" strokeDasharray="2 1" />
        ))}
      </g>
      <path d={hillEdge(150, 12, 1.4, 2.2)} fill="none" stroke={lt(mid, 0.35)} strokeWidth="1.4" opacity="0.6" />
      {wall(150, 12, 1.4, 2.2, 100, 900, 1)}
      {/* Stone cottage */}
      <g transform={`translate(640 ${hillY(640, 150, 12, 1.4, 2.2) + 4})`}>
        <ellipse cx="4" cy="1" rx="30" ry="4" fill="#000" opacity="0.15" />
        <rect x="-20" y="-18" width="40" height="18" fill={url(`${id}stone`)} />
        {Array.from({ length: 10 }, (_, i) => (
          <rect key={i} x={-19 + (i % 5) * 8} y={-17 + Math.floor(i / 5) * 8} width="6" height="3" rx="1" fill="#000" opacity="0.07" />
        ))}
        <path d="M-24 -16 L0 -32 L24 -16 Z" fill={url(`${id}thatch`)} />
        <path d="M-24 -16 L24 -16 L22 -14 L-22 -14 Z" fill="#6a4e1e" />
        <rect x="-4" y="-10" width="7" height="10" fill="#5a3a20" />
        <rect x="8" y="-12" width="6" height="5" fill="#ffd27a" {...anim("sc-flicker", 4)} />
        <rect x="10" y="-36" width="5" height="10" fill="#9a9282" />
        {[0, 1, 2].map((s) => (
          <circle key={s} cx="12.5" cy="-38" r={2.5 + s} fill="#fff" opacity="0.4" {...anim("sc-smoke", 5, -s * 1.6)} />
        ))}
      </g>
      {sheep(380, hillY(380, 150, 12, 1.4, 2.2) + 10, 0.8, 1)}
      {sheep(430, hillY(430, 150, 12, 1.4, 2.2) + 12, 0.7, 2, true)}
      {sheep(520, hillY(520, 150, 12, 1.4, 2.2) + 9, 0.75, 3)}
      <Mist id={id} k="m2" y={150} h={36} color="#ffffff" opacity={0.38} dur={18} />
      {/* Near hill with heather and a lone tree */}
      <path d={hillPath(178, 10, 3.1, 1.8)} fill={near} />
      <g clipPath={`url(#${id}nearclip)`}>
        {Array.from({ length: 160 }, (_, i) => (
          <circle key={i} cx={R(i, 41) * W} cy={170 + R(i, 42) * 50} r={0.8 + R(i, 43) * 1.4} fill={i % 3 ? "#b06ab3" : "#d38fd6"} opacity={0.85} />
        ))}
      </g>
      <path d={hillEdge(178, 10, 3.1, 1.8)} fill="none" stroke={lt(near, 0.3)} strokeWidth="1.4" opacity="0.6" />
      {wall(178, 10, 3.1, 1.8, -20, 1020, 2)}
      <g transform={`translate(300 ${hillY(300, 178, 10, 3.1, 1.8) + 4})`}>
        <path d="M-2 0 C-1 -16 -6 -26 -14 -34 M-1 -14 C4 -22 12 -26 18 -34 M-3 -22 C-4 -30 0 -38 2 -44" fill="none" stroke="#3a2a1a" strokeWidth="3" strokeLinecap="round" />
        {[[-14, -38, 10], [16, -38, 11], [2, -48, 12], [-4, -36, 9]].map(([x, y, r], i) => (
          <circle key={i} cx={x} cy={y} r={r} fill={i % 2 ? dk(near, 0.15) : lt(near, 0.08)} />
        ))}
      </g>
      {sheep(760, hillY(760, 178, 10, 3.1, 1.8) + 12, 1, 4, true)}
      {sheep(220, hillY(220, 178, 10, 3.1, 1.8) + 14, 0.95, 5)}
      {[0, 1].map((i) => (
        <Bird key={i} x={460 + i * 30} y={80 + i * 8} s={1} color={dk(far, 0.4)} k={i} />
      ))}
      <Vignette id={id} strength={0.2} />
    </>
  );
}

// ============ Tropical Tide: a sunny beach ============
export function Tropical({ p, id }: Opts) {
  const [sky1, sky2, sun, s1, s2, s3] = p;
  const hz = 118;
  const palm = (x: number, base: number, h: number, lean: number, s: number, k: number) => {
    const tx = x + lean;
    const ty = base - h;
    const segs = Array.from({ length: 12 }, (_, i) => {
      const t = i / 11;
      return [x + lean * t * t, base - h * t] as [number, number];
    });
    return (
      <g key={k}>
        <ellipse cx={x + lean * 0.6 + 30} cy={base + 2} rx={h * 0.5} ry="5" fill="#000" opacity="0.14" />
        <path d={`M${segs.map(([a, b]) => `${f(a)} ${f(b)}`).join(" L")}`} fill="none" stroke={url(`${id}trunk`)} strokeWidth={9 * s} strokeLinecap="round" />
        {segs.slice(1, -1).map(([a, b], i) => (
          <path key={i} d={`M${f(a - 4.5 * s)} ${f(b)} q${4.5 * s} ${3 * s} ${9 * s} 0`} fill="none" stroke="#7a5a32" strokeWidth="1" opacity="0.7" />
        ))}
        <g transform={`translate(${tx} ${ty})`}>
          <g {...anim("sc-sway", 4 + k, -k)}>
            {[-160, -125, -90, -55, -20, 15, 200].map((a, i) => (
              <g key={i} transform={`rotate(${a}) scale(${s})`}>
                <path d="M0 0 C20 -10 46 -6 64 10 C46 2 22 2 0 0 Z" fill={url(`${id}frond`)} />
                {Array.from({ length: 9 }, (_, j) => (
                  <path key={j} d={`M${8 + j * 6} ${-2 + j * 0.7} l${4} ${8 - j * 0.3}`} stroke={dk(s3, 0.5)} strokeWidth="1.2" opacity="0.5" />
                ))}
              </g>
            ))}
            {[[-5, 6], [4, 7], [0, 10]].map(([cx, cy], i) => (
              <circle key={i} cx={cx * s} cy={cy * s} r={4 * s} fill="#6b4a22" />
            ))}
          </g>
        </g>
      </g>
    );
  };
  return (
    <>
      <Sky id={id} top={sky1} bottom={sky2} horizon={lt(sun, 0.3)} />
      <defs>
        <LG id={`${id}sea`} s={[[0, dk(s3, 0.1)], [0.35, s2], [0.75, s1], [1, lt(s1, 0.45)]]} />
        <LG id={`${id}sand`} s={[[0, "#f7e2b0"], [0.5, "#efcf8e"], [1, "#d9ac64"]]} />
        <LG id={`${id}wet`} s={[[0, "#c9a868"], [1, "#e3c180", 0]]} />
        <LG id={`${id}trunk`} x2={1} y2={0} s={[[0, "#8a6a3e"], [0.5, "#c49a5e"], [1, "#6b4e2a"]]} />
        <LG id={`${id}frond`} s={[[0, lt("#3f9b4a", 0.2)], [1, "#1f6b2e"]]} />
        <LG id={`${id}umb`} x2={1} y2={0} s={[[0, "#ff5a5a"], [0.25, "#ff5a5a"], [0.25, "#ffffff"], [0.5, "#ffffff"], [0.5, "#ff5a5a"], [0.75, "#ff5a5a"], [0.75, "#ffffff"], [1, "#ffffff"]]} />
      </defs>
      <Orb id={id} x={560} y={84} r={28} color={sun} rays />
      <CloudDefs id={id} color="#ffffff" shade={mix("#ffffff", sky1, 0.35)} />
      <g {...anim("sc-drift", 30)}>
        <Cloud id={id} x={330} y={78} s={0.8} seed={1} />
        <Cloud id={id} x={760} y={66} s={0.65} seed={3} />
      </g>
      {/* Sea: deep at the horizon, turquoise shallows near the shore */}
      <rect y={hz} width={W} height={H - hz} fill={url(`${id}sea`)} />
      <path d={`M140 ${hz + 1} Q180 ${hz - 14} 230 ${hz - 10} Q260 ${hz - 8} 290 ${hz + 1} Z`} fill={dk(s3, 0.35)} />
      {Array.from({ length: 10 }, (_, i) => (
        <rect key={i} x={560 - (20 + i * 9) / 2 + (R(i, 4) - 0.5) * 12} y={hz + 3 + i * 4} width={20 + i * 9} height="1.4" rx="0.7" fill="#fff" opacity={0.6 - i * 0.04} {...anim("sc-shimmer", 1.4 + R(i) * 1.4, -R(i, 2) * 2)} />
      ))}
      <g {...anim("sc-slide", 9, 0, { "--dx": "-80px" })}>
        <path d={wavePath(hz + 22, 2, 80, hz + 24).split(" L")[0]} fill="none" stroke="#fff" strokeWidth="1" opacity="0.4" />
        <path d={wavePath(hz + 36, 2.5, 80, hz + 38).split(" L")[0]} fill="none" stroke="#fff" strokeWidth="1.2" opacity="0.45" />
      </g>
      {/* Beach with lapping foam */}
      <path d={`M-20 168 C200 160 420 172 640 164 S900 160 ${W + 20} 166 V${H} H-20 Z`} fill={url(`${id}sand`)} />
      <path d={`M-20 168 C200 160 420 172 640 164 S900 160 ${W + 20} 166 V180 C800 178 600 184 400 180 S100 182 -20 182 Z`} fill={url(`${id}wet`)} />
      <g {...anim("sc-lap", 4.5)}>
        <path d={`M-20 166 C120 158 260 170 420 163 S700 158 860 164 S${W} 162 ${W + 20} 163`} fill="none" stroke="#ffffff" strokeWidth="3" opacity="0.9" strokeLinecap="round" />
        <path d={`M-20 163 C120 155 260 167 420 160 S700 155 860 161 S${W} 159 ${W + 20} 160 V170 H-20 Z`} fill={lt(s1, 0.5)} opacity="0.55" />
      </g>
      {/* Umbrella, towel, beach ball, sandcastle, shells */}
      <g transform="translate(600 196)">
        <ellipse cx="14" cy="4" rx="40" ry="5" fill="#000" opacity="0.15" />
        <rect x="-26" y="-2" width="46" height="12" rx="2" fill="#4dc3ff" transform="skewX(-20)" />
        <rect x="-26" y="2" width="46" height="3" fill="#ffffff" transform="skewX(-20)" />
        <line x1="0" y1="6" x2="4" y2="-44" stroke="#e9e1d0" strokeWidth="2" />
        <path d="M-30 -36 Q4 -66 38 -36 Q30 -40 21 -36 Q12 -40 4 -36 Q-4 -40 -13 -36 Q-22 -40 -30 -36 Z" fill={url(`${id}umb`)} />
        <path d="M-30 -36 Q4 -66 38 -36" fill="none" stroke="#c43d42" strokeWidth="0.8" />
      </g>
      <g transform="translate(470 202)">
        <circle r="7" fill="#ffffff" />
        <path d="M-7 0 A7 7 0 0 1 0 -7 L0 0 Z" fill="#ff5a5a" />
        <path d="M0 0 L7 0 A7 7 0 0 1 0 7 Z" fill="#4dc3ff" />
        <path d="M0 -7 A7 7 0 0 1 7 0 L0 0 Z" fill="#ffd23f" />
        <circle r="7" fill="none" stroke="#000" strokeOpacity="0.15" />
        <ellipse cx="-2" cy="-3" rx="2.4" ry="1.4" fill="#fff" opacity="0.7" />
      </g>
      <g transform="translate(380 204)" fill="#e7c47c" stroke="#b8904a" strokeWidth="0.6">
        <rect x="-14" y="-10" width="28" height="10" />
        <rect x="-10" y="-20" width="20" height="10" />
        <path d="M-14 -10 v-3 h4 v3 h4 v-3 h4 v3 h4 v-3 h4 v3 h4 v-3 h4 v3" />
        <path d="M-2 -20 L0 -30 L2 -20" fill="#ff5a5a" stroke="none" />
      </g>
      <path d="M720 208 l2 -5 l2 5 l5 1 l-4 3 l1 5 l-4 -3 l-4 3 l1 -5 l-4 -3 Z" fill="#ff8a65" />
      <g transform="translate(320 210)">
        <path d="M0 4 C-6 4 -7 -2 0 -5 C7 -2 6 4 0 4 Z" fill="#ffe1d0" stroke="#c49a8a" strokeWidth="0.5" />
      </g>
      {/* A crab scuttling along */}
      <g {...anim("sc-scuttle", 12, -4)}>
        <g transform="translate(0 194)">
          <ellipse rx="6" ry="4" fill="#e5484d" />
          <path d="M-6 0 l-4 -4 M6 0 l4 -4 M-5 2 l-4 3 M5 2 l4 3" stroke="#c43d42" strokeWidth="1.2" />
          <circle cx="-2" cy="-4" r="1" fill="#000" />
          <circle cx="2" cy="-4" r="1" fill="#000" />
        </g>
      </g>
      {palm(180, 214, 120, 70, 1.2, 1)}
      {palm(870, 214, 104, -60, 1.05, 2)}
      {[0, 1].map((i) => (
        <Bird key={i} x={400 + i * 34} y={70 + i * 10} s={1.2} color="#3a4a5a" k={i} />
      ))}
      <Vignette id={id} strength={0.15} />
    </>
  );
}

// ============ Autumn Canopy: a cozy cabin under real leafy autumn trees ============
function Canopy({ cx, cy, rx, ry, seed, colors }: { cx: number; cy: number; rx: number; ry: number; seed: number; colors: string[] }) {
  // A dark leafy mass, then hundreds of little leaves on top, lighter towards the sun (upper left)
  const leaves: ReactNode[] = [];
  const n = Math.round((rx * ry) / 12);
  for (let i = 0; i < n; i++) {
    const a = R(i, seed) * Math.PI * 2;
    const d = Math.sqrt(R(i, seed + 1));
    const x = cx + Math.cos(a) * rx * d;
    const y = cy + Math.sin(a) * ry * d;
    const lit = (cx - x) / rx + (cy - y) / ry > 0.2;
    const c = colors[Math.floor(R(i, seed + 2) * colors.length)];
    leaves.push(<ellipse key={i} cx={f(x)} cy={f(y)} rx="3.2" ry="1.9" fill={lit ? lt(c, 0.18) : c} transform={`rotate(${Math.round(R(i, seed + 3) * 180)} ${f(x)} ${f(y)})`} />);
  }
  return (
    <g>
      <path d={blob(cx, cy + 3, rx * 1.02, ry, seed, 7, 0.22)} fill={dk(colors[0], 0.45)} />
      {leaves}
    </g>
  );
}

export function Autumn({ p, id }: Opts) {
  const [sky1, sky2, sun, t1, t2, t3, glow] = p;
  const reds = ["#c8341c", "#e0782a", "#f2a23a", "#b84a14", "#ffc04d", "#9a2a12"];
  const tree = (x: number, base: number, h: number, seed: number, k: number) => (
    <g key={k}>
      <path d={`M${x - 5} ${base} C${x - 3} ${base - h * 0.3} ${x - 4} ${base - h * 0.45} ${x - 10} ${base - h * 0.6} M${x + 4} ${base} C${x + 3} ${base - h * 0.3} ${x + 4} ${base - h * 0.45} ${x + 12} ${base - h * 0.62} M${x} ${base - h * 0.4} L${x} ${base - h * 0.7}`} fill="none" stroke="#3a2416" strokeWidth={h * 0.06} strokeLinecap="round" />
      <path d={`M${x - 6} ${base} L${x - 3} ${base - h * 0.42} L${x + 3} ${base - h * 0.42} L${x + 6} ${base} Z`} fill={url(`${id}bark`)} />
      <Canopy cx={x} cy={base - h * 0.72} rx={h * 0.36} ry={h * 0.28} seed={seed} colors={reds} />
    </g>
  );
  const maple = (k: number) => (
    <g key={k} transform={`translate(${R(k, 61) * W} -12)`}>
      <g {...anim("sc-leaffall", 8 + R(k, 62) * 6, -R(k, 63) * 14)}>
        <path d="M0 -6 L1.4 -2.4 L4.6 -3.8 L3.2 -0.6 L6 0.6 L2.4 1.8 L3 5 L0 3 L-3 5 L-2.4 1.8 L-6 0.6 L-3.2 -0.6 L-4.6 -3.8 L-1.4 -2.4 Z" fill={reds[k % reds.length]} transform={`scale(${1 + R(k, 64) * 0.7})`} />
      </g>
    </g>
  );
  return (
    <>
      <Sky id={id} top={sky1} bottom={sky2} horizon={lt(sun, 0.2)} />
      <defs>
        <LG id={`${id}bark`} x2={1} y2={0} s={[[0, "#2a1a10"], [0.5, "#5a3a24"], [1, "#2a1a10"]]} />
        <LG id={`${id}log`} s={[[0, "#9a6a3e"], [1, "#5a3a20"]]} />
        <LG id={`${id}path`} s={[[0, "#c99a62"], [1, "#9a6e3e"]]} />
        <RG id={`${id}win`} s={[[0, "#fff1c1", 0.9], [1, "#ffb347", 0]]} />
        <LG id={`${id}ray`} s={[[0, sun, 0.4], [1, sun, 0]]} />
      </defs>
      <Orb id={id} x={560} y={100} r={30} color={sun} />
      {/* Distant hills with a soft tree line */}
      <path d={hillPath(138, 10, 0.8, 2)} fill={mix(t1, sky2, 0.55)} />
      {Array.from({ length: 34 }, (_, i) => {
        const x = i * 31 + R(i, 7) * 10;
        return <path key={i} d={blob(x, hillY(x, 138, 10, 0.8, 2) - 6, 14, 10, i + 3, 5, 0.25)} fill={mix(reds[i % reds.length], sky2, 0.5)} />;
      })}
      <path d={hillPath(158, 8, 2.2, 2.4)} fill={mix(t2, "#6b8a3a", 0.35)} />
      {/* Light shafts through the trees */}
      <g {...anim("sc-ray", 6)}>
        {[0, 1, 2].map((i) => (
          <path key={i} d={`M${500 + i * 40} 90 L${430 + i * 60} 230 L${470 + i * 70} 230 Z`} fill={url(`${id}ray`)} opacity="0.5" />
        ))}
      </g>
      {/* Winding dirt path to the cabin */}
      <path d="M470 220 C480 200 540 196 530 184 C522 176 556 170 570 166 L586 166 C574 172 546 178 556 188 C568 202 520 210 540 220 Z" fill={url(`${id}path`)} />
      {/* Log cabin */}
      <g transform="translate(600 166)">
        <ellipse cx="0" cy="2" rx="56" ry="6" fill="#000" opacity="0.2" />
        <rect x="-36" y="-30" width="72" height="30" fill={url(`${id}log`)} />
        {Array.from({ length: 6 }, (_, i) => (
          <line key={i} x1="-36" x2="36" y1={-26 + i * 5} y2={-26 + i * 5} stroke="#3a2416" strokeWidth="0.8" opacity="0.6" />
        ))}
        <path d="M-44 -28 L0 -56 L44 -28 Z" fill="#6b2e1a" />
        <path d="M-44 -28 L0 -56 L0 -52 L-38 -27 Z" fill="#8a3e22" />
        {[-22, 22].map((x) => (
          <g key={x}>
            <circle cx={x} cy="-16" r="16" fill={url(`${id}win`)} {...anim("sc-flicker", 3.4)} />
            <rect x={x - 6} y="-22" width="12" height="11" fill="#ffd27a" />
            <path d={`M${x} -22 v11 M${x - 6} -16.5 h12`} stroke="#3a2416" strokeWidth="1" />
          </g>
        ))}
        <rect x="-6" y="-18" width="12" height="18" fill="#4a2a16" />
        <rect x="18" y="-66" width="8" height="16" fill="#5a4a40" />
        {[0, 1, 2].map((s) => (
          <circle key={s} cx="22" cy="-68" r={3 + s} fill="#fff" opacity="0.4" {...anim("sc-smoke", 5, -s * 1.6)} />
        ))}
        {/* Porch pumpkins and a lantern */}
        {[[-30, 0, 5], [-22, 1, 3.6], [30, 0, 4.4]].map(([x, y, r], i) => (
          <g key={i}>
            <ellipse cx={x} cy={y - r * 0.6} rx={r * 1.2} ry={r} fill="#ff8a1f" />
            <path d={`M${x} ${y - r * 1.5} v${-2}`} stroke="#4f7a2e" strokeWidth="1.2" />
          </g>
        ))}
        <circle cx="10" cy="-6" r="8" fill={url(`${id}win`)} {...anim("sc-flicker", 2.4)} />
        <rect x="8" y="-9" width="4" height="6" rx="1" fill="#ffd27a" stroke="#3a2416" strokeWidth="0.6" />
      </g>
      {/* Autumn trees framing the scene */}
      {tree(330, 214, 150, 11, 1)}
      {tree(420, 196, 96, 23, 2)}
      {tree(770, 214, 160, 37, 3)}
      {tree(880, 204, 110, 51, 4)}
      {tree(220, 204, 112, 67, 5)}
      {/* Ground with leaf litter and leaf piles */}
      <path d={`M-20 206 C200 198 400 210 620 202 S880 198 ${W + 20} 204 V${H} H-20 Z`} fill={dk(t3, 0.1)} />
      {Array.from({ length: 220 }, (_, i) => (
        <ellipse key={i} cx={R(i, 81) * W} cy={202 + R(i, 82) * 20} rx="2.6" ry="1.4" fill={reds[i % reds.length]} transform={`rotate(${R(i, 83) * 180} ${R(i, 81) * W} ${202 + R(i, 82) * 20})`} />
      ))}
      {[[260, 210, 26], [700, 212, 30]].map(([x, y, w], i) => (
        <g key={i}>
          <path d={blob(x, y, w, w * 0.35, i + 90, 6, 0.3)} fill={dk(t1, 0.2)} />
          {Array.from({ length: 30 }, (_, j) => (
            <ellipse key={j} cx={x + (R(j, i + 91) - 0.5) * w * 1.6} cy={y - R(j, i + 92) * w * 0.3} rx="2.6" ry="1.5" fill={reds[j % reds.length]} transform={`rotate(${R(j, i + 93) * 180} ${x} ${y})`} />
          ))}
        </g>
      ))}
      {Array.from({ length: 18 }, (_, i) => maple(i))}
      <Mist id={id} k="warm" y={150} h={60} color={glow} opacity={0.18} dur={20} />
      <Vignette id={id} strength={0.32} />
    </>
  );
}

// ============ Lavender Fields: Provence rows running to the horizon ============
export function Lavender({ p, id }: Opts) {
  const [sky1, sky2, sun, h1, h2, f1, f2] = p;
  const vx = 560;
  const vy = 132;
  const rows = 16;
  const rowBands: ReactNode[] = [];
  const bushes: ReactNode[] = [];
  for (let i = 0; i < rows; i++) {
    const b0 = -1400 + i * ((W + 2800) / rows);
    const b1 = b0 + ((W + 2800) / rows) * 0.66;
    rowBands.push(<path key={i} d={`M${vx - 1} ${vy} L${b0} ${H + 60} L${b1} ${H + 60} L${vx + 1} ${vy} Z`} fill={url(`${id}row`)} />);
    // Rounded bushes along each row, bigger as they come closer
    for (let j = 0; j < 12; j++) {
      const t = Math.pow((j + 1) / 12, 1.7);
      const y = vy + (H + 60 - vy) * t;
      if (y > H + 10) continue;
      const cxx = vx + ((b0 + b1) / 2 - vx) * t;
      const w = ((b1 - b0) / 2) * t * 0.9;
      bushes.push(
        <g key={`${i}-${j}`}>
          <ellipse cx={f(cxx)} cy={f(y)} rx={f(w)} ry={f(Math.max(1, w * 0.42))} fill={dk(f1, 0.25)} />
          <ellipse cx={f(cxx - w * 0.15)} cy={f(y - w * 0.12)} rx={f(w * 0.75)} ry={f(Math.max(0.6, w * 0.28))} fill={f1} />
          {t > 0.35 ? <ellipse cx={f(cxx - w * 0.3)} cy={f(y - w * 0.22)} rx={f(w * 0.35)} ry={f(w * 0.12)} fill={f2} opacity="0.75" /> : null}
        </g>,
      );
    }
  }
  return (
    <>
      <Sky id={id} top={sky1} bottom={sky2} horizon={lt(sun, 0.25)} glowY={0.6} />
      <defs>
        <LG id={`${id}row`} s={[[0, mix(f1, sky2, 0.5)], [0.4, h1], [1, h2]]} />
        <LG id={`${id}soil`} s={[[0, mix("#8a7a4a", sky2, 0.5)], [1, "#4a3a22"]]} />
        <LG id={`${id}wall`} x2={1} y2={0} s={[[0, "#f1dcc0"], [1, "#c9a882"]]} />
      </defs>
      <Orb id={id} x={vx} y={vy - 4} r={26} color={sun} />
      <path d={`M-20 ${vy} Q200 ${vy - 22} 420 ${vy - 6} T${W + 20} ${vy - 10} V${vy + 2} H-20 Z`} fill={mix(h1, sky2, 0.6)} />
      {/* Farmhouse and cypress trees on the horizon */}
      <g transform={`translate(700 ${vy + 1})`}>
        <rect x="-26" y="-16" width="40" height="16" fill={url(`${id}wall`)} />
        <rect x="14" y="-12" width="18" height="12" fill={url(`${id}wall`)} />
        <path d="M-29 -16 L-6 -26 L17 -16 Z M12 -12 L23 -18 L34 -12 Z" fill="#c4502b" />
        <rect x="-18" y="-10" width="5" height="5" fill="#6b4a2a" />
        <rect x="-4" y="-10" width="5" height="5" fill="#6b4a2a" />
        {[-40, -48, 44].map((x, i) => (
          <path key={i} d={`M${x} 0 C${x - 4} -12 ${x - 3} -26 ${x} ${-34 - i * 4} C${x + 3} -26 ${x + 4} -12 ${x} 0 Z`} fill="#24402a" />
        ))}
      </g>
      <g transform={`translate(300 ${vy})`}>
        <path d="M0 0 L0 -14" stroke="#3a2a1a" strokeWidth="2" />
        <circle cx="0" cy="-20" r="10" fill="#4a6a3a" />
        <circle cx="-5" cy="-16" r="7" fill="#3a5a2e" />
      </g>
      <rect y={vy} width={W} height={H - vy} fill={url(`${id}soil`)} />
      {rowBands}
      {bushes}
      {/* Foreground sprigs swaying */}
      {Array.from({ length: 22 }, (_, i) => {
        const x = R(i, 131) * W;
        const y = 196 + R(i, 132) * 14;
        return (
          <g key={i} {...anim("sc-sway", 3 + R(i, 133) * 2, -R(i, 134) * 3)}>
            <path d={`M${x} ${y + 30} Q${x + 2} ${y + 10} ${x} ${y}`} stroke="#5f7a3e" strokeWidth="1.2" fill="none" />
            {Array.from({ length: 7 }, (_, k) => (
              <ellipse key={k} cx={x + (k % 2 ? 1.8 : -1.8)} cy={y - k * 3.6} rx="2.2" ry="3" fill={k % 2 ? f1 : lt(f1, 0.3)} />
            ))}
          </g>
        );
      })}
      {[0, 1].map((i) => (
        <g key={i} {...anim("sc-flutter", 8 + i * 3, -i * 3)}>
          <g transform={`translate(${400 + i * 220} ${150 + i * 10})`}>
            <g {...anim("sc-flap", 0.25)}>
              <path d="M0 0 C-7 -9 -11 -2 -7 2 C-10 5 -4 8 0 2 Z M0 0 C7 -9 11 -2 7 2 C10 5 4 8 0 2 Z" fill={i ? "#fff3b0" : "#ffffff"} />
            </g>
          </g>
        </g>
      ))}
      <Mist id={id} k="warm" y={vy - 10} h={40} color={lt(sun, 0.2)} opacity={0.35} dur={22} />
      <Vignette id={id} strength={0.22} />
    </>
  );
}

// ============ Volcano: a natural cone, lava rivers, glowing fissures in the rock ============
export function Volcano({ p, id }: Opts) {
  const [bg1, bg2, rock1, rock2, l1, l2, ember] = p;
  const cx = 500;
  const top = 96;
  // The cone's outline: rough slopes and a broken summit
  const slope = (side: -1 | 1) =>
    Array.from({ length: 16 }, (_, i) => {
      const t = i / 15;
      const x = cx + side * (34 + t * t * 340 + t * 40);
      const y = top + 4 + t * (H - top) + (R(i, side + 5) - 0.5) * 6 * Math.sin(t * Math.PI);
      return `${f(x)} ${f(y)}`;
    });
  const left = slope(-1);
  const right = slope(1);
  const cone = `M${left.reverse().join(" L")} L${cx - 34} ${top + 4} L${cx - 22} ${top - 4} L${cx - 10} ${top + 2} L${cx + 6} ${top - 6} L${cx + 20} ${top + 1} L${cx + 34} ${top + 4} L${right.join(" L")} Z`;
  const flow = (pts: [number, number][], k: number, w0: number) => {
    const d = ribbon(pts, (t) => w0 * (0.5 + t * 0.9) * (1 + Math.sin(t * 12 + k) * 0.15));
    const core = ribbon(pts, (t) => w0 * 0.35 * (0.5 + t * 0.7));
    return (
      <g key={k}>
        <path d={d} fill={l1} opacity="0.45" filter={url(`${id}bl`)} />
        <path d={d} fill={url(`${id}flow`)} />
        <path d={core} fill={lt(l2, 0.3)} opacity="0.9" {...anim("sc-flicker", 1.6 + k * 0.4)} />
        {pts.filter((_, i) => i % 3 === 1).map(([x, y], i) => (
          <path key={i} d={blob(x + (i % 2 ? 2 : -2), y, w0 * 0.3, w0 * 0.16, k * 10 + i, 5, 0.4)} fill={dk(rock1, 0.2)} opacity="0.85" />
        ))}
      </g>
    );
  };
  const plume = Array.from({ length: 18 }, (_, i) => {
    const t = i / 17;
    return { x: cx + Math.sin(t * 3) * 18 + t * 130 + (R(i, 41) - 0.5) * 40 * t, y: top - 14 - t * 120, r: 18 + t * 56 + R(i, 42) * 10, i };
  });
  return (
    <>
      <Sky id={id} top={bg1} bottom={bg2} horizon={mix(bg2, l1, 0.6)} glowY={0.72} />
      <defs>
        <LG id={`${id}cone`} x2={1} y2={0.25} s={[[0, mix(rock1, l1, 0.25)], [0.3, lt(rock1, 0.04)], [0.6, rock1], [1, dk(rock1, 0.55)]]} />
        <LG id={`${id}coneV`} s={[[0, l1, 0.3], [0.12, "#000", 0], [1, "#000", 0.35]]} />
        <RG id={`${id}vent`} s={[[0, lt(l2, 0.5), 1], [0.3, l2, 0.8], [0.6, l1, 0.35], [1, l1, 0]]} />
        <RG id={`${id}ash`} cx={0.42} cy={0.3} r={0.75} s={[[0, mix(rock2, "#b0a0a6", 0.3)], [0.55, rock2], [1, mix(dk(rock2, 0.2), l1, 0.5)]]} />
        <LG id={`${id}flow`} s={[[0, l2], [0.5, l1], [1, dk(l1, 0.2)]]} />
        <LG id={`${id}rock`} s={[[0, mix(rock2, l1, 0.35)], [0.12, rock2], [1, dk(rock2, 0.6)]]} />
        <RG id={`${id}bomb`} s={[[0, "#fff"], [0.4, l2], [1, l1, 0]]} />
        <filter id={`${id}bl`} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="4" />
        </filter>
      </defs>
      <Stars n={24} top={70} seed={61} color={lt(l2, 0.6)} />
      <path d={`M-20 180 L50 150 L110 164 L180 136 L260 170 L-20 190 Z`} fill={mix(rock2, bg2, 0.5)} />
      <path d={`M740 190 L790 146 L850 160 L910 128 L980 154 L${W + 20} 144 L${W + 20} 190 Z`} fill={mix(rock2, bg2, 0.5)} />
      <ellipse cx={cx} cy={top} rx="200" ry="110" fill={url(`${id}vent`)} opacity="0.5" {...anim("sc-breathe", 2.6)} />
      {/* Ash column, lit from below */}
      <g {...anim("sc-sway", 10)}>
        {plume
          .slice()
          .reverse()
          .map(({ x, y, r, i }) => (
            <circle key={i} cx={x} cy={y} r={r} fill={url(`${id}ash`)} />
          ))}
      </g>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <g key={i} transform={`translate(${cx + (i - 2.5) * 5} ${top - 6})`}>
          <circle r={12 + (i % 3) * 3} fill={url(`${id}ash`)} {...anim("sc-plume", 5, -i * 0.85, { "--sx": `${30 + (i - 2.5) * 10}px` })} />
        </g>
      ))}
      <g {...anim("sc-flash", 7, -2)}>
        <path d={`M${cx + 80} 34 L${cx + 66} 54 L${cx + 78} 54 L${cx + 62} 80`} fill="none" stroke="#b9c8ff" strokeWidth="6" opacity="0.4" filter={url(`${id}bl`)} />
        <path d={`M${cx + 80} 34 L${cx + 66} 54 L${cx + 78} 54 L${cx + 62} 80`} fill="none" stroke="#f1f5ff" strokeWidth="1.6" />
      </g>
      {/* Cone with gullies, lit by its own fire */}
      <path d={cone} fill={url(`${id}cone`)} />
      <path d={cone} fill={url(`${id}coneV`)} />
      <clipPath id={`${id}conec`}>
        <path d={cone} />
      </clipPath>
      <g clipPath={`url(#${id}conec)`}>
      {Array.from({ length: 16 }, (_, i) => {
        const t = (i + 0.5) / 16;
        const sx = cx - 30 + t * 60;
        const ex = cx - 300 + t * 600;
        return <path key={i} d={`M${f(sx)} ${top + 14 + R(i, 4) * 20} Q${f((sx + ex) / 2 + (R(i, 3) - 0.5) * 40)} ${f((top + H) / 2)} ${f(ex)} ${H}`} fill="none" stroke={t < 0.45 ? lt(rock1, 0.1) : dk(rock1, 0.35)} strokeWidth={t < 0.45 ? 1 : 1.6} opacity="0.35" strokeDasharray={`${20 + R(i, 5) * 30} ${6 + R(i, 6) * 10}`} />;
      })}
      </g>
      {/* Fire spilling over the broken summit (no hole) */}
      <path d={`M${cx - 30} ${top + 4} L${cx - 22} ${top - 4} L${cx - 10} ${top + 2} L${cx + 6} ${top - 6} L${cx + 20} ${top + 1} L${cx + 30} ${top + 4} Q${cx} ${top + 12} ${cx - 30} ${top + 4} Z`} fill={l1} />
      <path d={`M${cx - 22} ${top - 1} L${cx - 10} ${top + 4} L${cx + 6} ${top - 2} L${cx + 20} ${top + 3}`} fill="none" stroke={lt(l2, 0.4)} strokeWidth="2" {...anim("sc-flicker", 1.2)} />
      {/* Lava fountain */}
      {Array.from({ length: 12 }, (_, i) => (
        <g key={i} transform={`translate(${cx + (i - 5.5) * 3} ${top - 2})`}>
          <g {...anim("sc-bx", 1.8 + R(i, 7) * 1.2, -R(i, 8) * 3, { "--sx": `${(R(i, 9) - 0.5) * 200}px` })}>
            <circle r={1.8 + R(i, 10) * 2.6} fill={url(`${id}bomb`)} {...anim("sc-by", 1.8 + R(i, 7) * 1.2, -R(i, 8) * 3, { "--sy": `${-40 - R(i, 11) * 50}px`, "--dy": `${60 + R(i, 12) * 40}px` })} />
          </g>
        </g>
      ))}
      {/* Organic lava rivers with cooling crust */}
      {flow(wander([cx - 14, top + 6], [cx - 150, H + 8], 14, 22, 3), 0, 14)}
      {flow(wander([cx + 16, top + 6], [cx + 120, H + 8], 14, 18, 7), 1, 12)}
      {flow(wander([cx - 2, top + 30], [cx + 10, H + 8], 10, 12, 11), 2, 8)}
      {/* Foreground basalt with glowing fissures */}
      <path d={`M-20 ${H} L-20 186 L40 172 L96 182 L150 166 L210 190 L250 ${H} Z`} fill={url(`${id}rock`)} />
      <path d={`M740 ${H} L770 186 L830 172 L880 184 L940 164 L${W + 20} 176 L${W + 20} ${H} Z`} fill={url(`${id}rock`)} />
      {[
        "M10 210 L30 200 L46 206 L70 194 L90 200",
        "M120 214 L140 204 L160 210",
        "M780 208 L800 198 L824 204 L850 192",
        "M900 212 L930 200 L960 206",
      ].map((d, i) => (
        <g key={i}>
          <path d={d} fill="none" stroke={l1} strokeWidth="5" opacity="0.35" filter={url(`${id}bl`)} />
          <path d={d} fill="none" stroke={l2} strokeWidth="1.4" strokeLinejoin="round" {...anim("sc-flicker", 2 + i * 0.4)} />
        </g>
      ))}
      <path d="M-20 186 L40 172 L96 182 L150 166 L210 190" fill="none" stroke={l1} strokeWidth="1.6" opacity="0.7" />
      <path d={`M770 186 L830 172 L880 184 L940 164 L${W + 20} 176`} fill="none" stroke={l1} strokeWidth="1.6" opacity="0.7" />
      {Array.from({ length: 34 }, (_, i) => (
        <circle key={i} cx={200 + R(i, 151) * 600} cy={H + 4} r={0.8 + R(i, 152) * 1.6} fill={i % 3 ? ember : l2} {...anim("sc-ember", 3.5 + R(i, 153) * 4, -R(i, 154) * 6)} />
      ))}
      <Mist id={id} k="heat" y={160} h={60} color={l1} opacity={0.12} dur={8} />
      <Vignette id={id} strength={0.5} />
    </>
  );
}

// ============ Ember Forge: a molten-gold waterfall between basalt columns ============
export function Forge({ p, id }: Opts) {
  const [bg1, bg2, rock1, rock2, l1, l2, ember] = p;
  const column = (x: number, top: number, w: number, k: number) => (
    <g key={k}>
      <rect x={x} y={top} width={w} height={H - top} fill={url(`${id}col`)} />
      <path d={`M${x} ${top} L${x + w * 0.25} ${top - 5} L${x + w * 0.75} ${top - 5} L${x + w} ${top} Z`} fill={lt(rock1, 0.18)} />
      <line x1={x + w * 0.5} y1={top} x2={x + w * 0.5} y2={H} stroke={dk(rock1, 0.45)} strokeWidth="1" opacity="0.6" />
      <line x1={x + w} y1={top} x2={x + w} y2={H} stroke={l1} strokeWidth="1" opacity={x > 500 ? 0.1 : 0.55} />
      <line x1={x} y1={top} x2={x} y2={H} stroke={l1} strokeWidth="1" opacity={x > 500 ? 0.55 : 0.1} />
    </g>
  );
  const fallX = 470;
  const fallW = 64;
  return (
    <>
      <Sky id={id} top={bg1} bottom={bg2} horizon={mix(bg2, l1, 0.4)} />
      <defs>
        <LG id={`${id}col`} x2={1} y2={0} s={[[0, dk(rock1, 0.2)], [0.5, rock1], [1, dk(rock1, 0.5)]]} />
        <LG id={`${id}fall`} x2={1} y2={0} s={[[0, l1], [0.3, l2], [0.55, lt(l2, 0.5)], [0.8, l2], [1, l1]]} />
        <LG id={`${id}fallV`} s={[[0, "#000", 0.25], [0.2, "#000", 0], [1, "#fff", 0.15]]} />
        <RG id={`${id}pool`} s={[[0, lt(l2, 0.5)], [0.4, l2], [0.8, l1], [1, l1, 0]]} />
        <RG id={`${id}glow`} s={[[0, l2, 0.6], [1, l1, 0]]} />
        <RG id={`${id}smoke`} cx={0.45} cy={0.35} r={0.7} s={[[0, mix(rock2, "#9a8aa8", 0.4)], [1, mix(rock2, l1, 0.25)]]} />
        <filter id={`${id}bl`} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="5" />
        </filter>
        <filter id={`${id}soft`} x="-30%" y="-100%" width="160%" height="300%">
          <feGaussianBlur stdDeviation="8" />
        </filter>
        <LG id={`${id}cliff`} x2={1} y2={0} s={[[0, mix(rock1, l1, 0.25)], [0.3, rock1], [0.7, dk(rock1, 0.3)], [1, mix(rock1, l1, 0.2)]]} />
      </defs>
      <Stars n={40} top={80} seed={71} />
      {/* Smoky violet sky */}
      <g {...anim("sc-drift", 30)} filter={url(`${id}soft`)}>
        {[[200, 56, 120, 18], [420, 40, 140, 14], [700, 50, 160, 20], [880, 64, 110, 14], [560, 74, 90, 10]].map(([x, y, rx, ry], i) => (
          <ellipse key={i} cx={x} cy={y} rx={rx} ry={ry} fill={mix(rock2, "#9a7ab8", 0.45)} opacity="0.55" />
        ))}
      </g>
      <ellipse cx={fallX + fallW / 2} cy="190" rx="300" ry="90" fill={url(`${id}glow`)} {...anim("sc-breathe", 3)} />
      {/* Cliff the gold pours from */}
      <path d={`M280 ${H} L290 96 L312 84 L330 90 L352 70 L380 76 L400 66 L430 72 L${fallX} 62 L${fallX + fallW} 62 L560 70 L590 64 L612 74 L640 62 L668 80 L690 76 L712 98 L720 ${H} Z`} fill={url(`${id}cliff`)} />
      {[96, 120, 146, 170].map((y, i) => (
        <path key={i} d={`M${292 + i * 4} ${y} Q${380} ${y - 6 + (i % 2) * 8} ${fallX - 10} ${y + 4} M${fallX + fallW + 10} ${y + 2} Q${620} ${y - 4} ${708 - i * 3} ${y + 6}`} fill="none" stroke={dk(rock1, 0.45)} strokeWidth="1.4" opacity="0.6" />
      ))}
      {[[330, 110], [380, 150], [620, 120], [660, 160]].map(([x, y], i) => (
        <path key={i} d={`M${x} ${y} l8 -6 l5 4 l10 -8`} fill="none" stroke={l1} strokeWidth="1" opacity="0.7" {...anim("sc-flicker", 2 + i * 0.4)} />
      ))}
      <path d={`M290 96 L312 84 L330 90 L352 70 L380 76 L400 66 L430 72 L${fallX} 62 M${fallX + fallW} 62 L560 70 L590 64 L612 74 L640 62 L668 80 L690 76 L712 98`} fill="none" stroke={l1} strokeWidth="1.4" opacity="0.6" />
      {/* Basalt columns stepping down on both sides */}
      {[[10, 120, 34], [44, 104, 32], [76, 92, 36], [112, 110, 30], [142, 84, 34], [176, 98, 32], [208, 116, 30], [238, 130, 34], [272, 150, 30]].map(([x, top, w], i) => column(x, top, w, i))}
      {[[700, 140, 32], [732, 118, 34], [766, 96, 32], [798, 108, 36], [834, 86, 30], [864, 100, 34], [898, 122, 32], [930, 104, 36], [966, 128, 40]].map(([x, top, w], i) => column(x, top, w, i + 20))}
      {/* The molten waterfall: flowing streaks */}
      <path d={`M${fallX} 62 C${fallX - 6} 110 ${fallX - 14} 150 ${fallX - 24} 186 L${fallX + fallW + 24} 186 C${fallX + fallW + 14} 150 ${fallX + fallW + 6} 110 ${fallX + fallW} 62 Z`} fill={l1} opacity="0.5" filter={url(`${id}bl`)} />
      <path d={`M${fallX} 62 C${fallX - 6} 110 ${fallX - 14} 150 ${fallX - 24} 186 L${fallX + fallW + 24} 186 C${fallX + fallW + 14} 150 ${fallX + fallW + 6} 110 ${fallX + fallW} 62 Z`} fill={url(`${id}fall`)} />
      <path d={`M${fallX} 62 C${fallX - 6} 110 ${fallX - 14} 150 ${fallX - 24} 186 L${fallX + fallW + 24} 186 C${fallX + fallW + 14} 150 ${fallX + fallW + 6} 110 ${fallX + fallW} 62 Z`} fill={url(`${id}fallV`)} />
      {Array.from({ length: 9 }, (_, i) => {
        const x0 = fallX + 4 + i * 7;
        const spread = (i - 4) * 5;
        return <path key={i} d={`M${x0} 62 C${x0} 110 ${x0 + spread * 0.6} 150 ${x0 + spread} 186`} fill="none" stroke={i % 2 ? lt(l2, 0.6) : dk(l1, 0.15)} strokeWidth={i % 2 ? 1.4 : 1} strokeDasharray="10 14" opacity="0.8" {...anim("sc-pour", 0.9 + R(i, 3) * 0.5)} />;
      })}
      {/* Glowing pool with ripples and rising steam */}
      <ellipse cx={fallX + fallW / 2} cy="200" rx="200" ry="26" fill={url(`${id}pool`)} />
      {[0, 1, 2].map((i) => (
        <ellipse key={i} cx={fallX + fallW / 2} cy="196" rx="50" ry="7" fill="none" stroke={lt(l2, 0.5)} strokeWidth="1.2" {...anim("sc-ripple", 2.4, -i * 0.8)} />
      ))}
      {[0, 1, 2, 3, 4].map((i) => (
        <g key={i} transform={`translate(${fallX + 8 + i * 12} 186)`}>
          <circle r={8 + (i % 2) * 3} fill={lt(l2, 0.6)} opacity="0.35" filter={url(`${id}soft`)} {...anim("sc-plume", 4, -i * 0.8, { "--sx": `${(i - 2) * 10}px` })} />
        </g>
      ))}
      <path d={`M-20 ${H} L-20 196 L120 190 L260 198 L330 192 L380 ${H} Z`} fill={dk(rock2, 0.3)} />
      <path d={`M640 ${H} L680 194 L820 190 L940 198 L${W + 20} 192 L${W + 20} ${H} Z`} fill={dk(rock2, 0.3)} />
      {Array.from({ length: 36 }, (_, i) => (
        <circle key={i} cx={260 + R(i, 151) * 480} cy={H + 4} r={0.8 + R(i, 152) * 1.6} fill={i % 3 ? ember : l2} {...anim("sc-ember", 3.5 + R(i, 153) * 4, -R(i, 154) * 6)} />
      ))}
      <Vignette id={id} strength={0.5} />
    </>
  );
}
