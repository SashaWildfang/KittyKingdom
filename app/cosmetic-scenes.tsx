"use client";

import { useId, type CSSProperties, type ReactNode } from "react";
import type { BannerSpec } from "../lib/cosmetics";

// Illustrated banner scenes (600×200, cropped to fit). Each scene takes a palette, so one drawing
// makes several banners. Movement uses the .sc-* animation classes in globals.css.

const R = (i: number, s = 1) => {
  const x = Math.sin(i * 12.9898 + s * 78.233) * 43758.5453;
  return x - Math.floor(x);
};
const anim = (name: string, dur: number, delay = 0): { className: string; style: CSSProperties } => ({ className: name, style: { animationDuration: `${dur}s`, animationDelay: `${delay}s` } });

function Sky({ id, a, b }: { id: string; a: string; b: string }) {
  return (
    <>
      <defs>
        <linearGradient id={`${id}sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={a} />
          <stop offset="1" stopColor={b} />
        </linearGradient>
      </defs>
      <rect width="600" height="200" fill={`url(#${id}sky)`} />
    </>
  );
}

function Glow({ id, x, y, r, color, core }: { id: string; x: number; y: number; r: number; color: string; core?: number }) {
  return (
    <>
      <defs>
        <radialGradient id={`${id}g${x}${y}`}>
          <stop offset="0" stopColor={color} stopOpacity="0.55" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx={x} cy={y} r={r * 2.6} fill={`url(#${id}g${x}${y})`} />
      {core ? <circle cx={x} cy={y} r={core} fill={color} /> : null}
    </>
  );
}

function Stars({ n, color = "#fff", top = 110, seed = 1 }: { n: number; color?: string; top?: number; seed?: number }) {
  return (
    <g>
      {Array.from({ length: n }, (_, i) => {
        const a = anim("sc-tw", 2 + R(i, seed + 3) * 3, -R(i, seed + 4) * 4);
        return <circle key={i} cx={R(i, seed) * 600} cy={R(i, seed + 1) * top} r={0.6 + R(i, seed + 2) * 1.3} fill={color} {...a} />;
      })}
    </g>
  );
}

/** A wave strip twice as wide as the banner, scrolled sideways for an endless loop. */
function wavePath(y: number, amp: number, period = 60) {
  let d = `M0 ${y}`;
  for (let x = 0; x < 1260; x += period) d += ` Q${x + period / 2} ${y - amp} ${x + period} ${y} T${x + period * 2} ${y}`;
  return `${d} L1260 200 L0 200 Z`;
}

function pine(x: number, base: number, h: number, w: number) {
  const pts: string[] = [];
  for (let k = 0; k < 3; k++) {
    const top = base - h + k * h * 0.27;
    const bot = top + h * 0.46;
    const half = (w * (0.42 + k * 0.22)) / 2;
    pts.push(`M${x} ${top} L${x + half} ${bot} L${x - half} ${bot} Z`);
  }
  pts.push(`M${x - w * 0.06} ${base - h * 0.2} h${w * 0.12} V${base} h${-w * 0.12} Z`);
  return pts.join(" ");
}

function Flower({ x, y, r, color, center = "#ffe066" }: { x: number; y: number; r: number; color: string; center?: string }) {
  return (
    <g>
      {[0, 72, 144, 216, 288].map((a) => (
        <circle key={a} cx={x + Math.cos((a * Math.PI) / 180) * r} cy={y + Math.sin((a * Math.PI) / 180) * r} r={r * 0.85} fill={color} />
      ))}
      <circle cx={x} cy={y} r={r * 0.55} fill={center} />
    </g>
  );
}

function Cloud({ x, y, s, fill, opacity = 1 }: { x: number; y: number; s: number; fill: string; opacity?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} opacity={opacity}>
      <circle cx="0" cy="0" r="18" fill={fill} />
      <circle cx="22" cy="-8" r="24" fill={fill} />
      <circle cx="48" cy="-2" r="19" fill={fill} />
      <circle cx="66" cy="6" r="13" fill={fill} />
      <rect x="-8" y="2" width="82" height="17" rx="8.5" fill={fill} />
    </g>
  );
}

// ---------------- scenes ----------------
type P = string[];
type Opts = BannerSpec & { id: string };

function Pumpkins({ p, id }: Opts) {
  const [sky1, sky2, moon, far, near, body, shade, glow] = p;
  const pumpkin = (x: number, y: number, s: number, face: boolean, k: number) => (
    <g key={k} transform={`translate(${x} ${y}) scale(${s})`}>
      {face ? <circle cx="0" cy="0" r="34" fill={`url(#${id}pg)`} {...anim("sc-flicker", 2.4 + k * 0.3, -k)} /> : null}
      <ellipse cx="-21" cy="1" rx="14" ry="20" fill={shade} />
      <ellipse cx="21" cy="1" rx="14" ry="20" fill={shade} />
      <ellipse cx="-11" cy="0" rx="16" ry="23" fill={body} stroke={shade} strokeWidth="1.6" />
      <ellipse cx="11" cy="0" rx="16" ry="23" fill={body} stroke={shade} strokeWidth="1.6" />
      <ellipse cx="0" cy="-1" rx="13" ry="24" fill={body} stroke={shade} strokeWidth="1.6" />
      <ellipse cx="-6" cy="-12" rx="4" ry="7" fill="#fff" opacity="0.18" />
      <path d="M-3 -21 C-4 -30 1 -35 7 -37 L9 -33 C5 -31 3 -27 3 -21 Z" fill="#4d6b2c" />
      <path d="M5 -30 C14 -36 18 -28 12 -26" fill="none" stroke="#5c7f33" strokeWidth="1.6" strokeLinecap="round" />
      {face ? (
        <g fill={glow} {...anim("sc-flicker", 2.4 + k * 0.3, -k)}>
          <path d="M-13 -6 L-4 -6 L-8.5 -14 Z" />
          <path d="M13 -6 L4 -6 L8.5 -14 Z" />
          <path d="M-2.2 -1 L2.2 -1 L0 -5 Z" />
          <path d="M-15 4 Q0 18 15 4 L11 7 L8 3.5 L4 8 L0 4.5 L-4 8 L-8 3.5 L-11 7 Z" />
        </g>
      ) : null}
    </g>
  );
  const bat = (x: number, y: number, s: number, k: number) => (
    <g key={k} transform={`translate(${x} ${y}) scale(${s})`}>
      <g {...anim("sc-batfly", 9 + k * 2, -k * 3)}>
        <path {...anim("sc-flap", 0.35 + k * 0.05)} d="M0 0 C-3 -3 -6 -3 -9 -1 C-10 -4 -13 -5 -16 -3 C-13 -1 -12 2 -10 4 C-7 2 -4 3 -2 5 L0 3 L2 5 C4 3 7 2 10 4 C12 2 13 -1 16 -3 C13 -5 10 -4 9 -1 C6 -3 3 -3 0 0 Z" fill="#0a0410" />
      </g>
    </g>
  );
  return (
    <>
      <Sky id={id} a={sky1} b={sky2} />
      <defs>
        <radialGradient id={`${id}pg`}>
          <stop offset="0" stopColor={glow} stopOpacity="0.55" />
          <stop offset="1" stopColor={glow} stopOpacity="0" />
        </radialGradient>
      </defs>
      <Stars n={40} top={100} seed={2} />
      <Glow id={id} x={478} y={74} r={28} color={moon} core={28} />
      <circle cx="468" cy="66" r="5" fill="#000" opacity="0.06" />
      <circle cx="488" cy="82" r="7" fill="#000" opacity="0.06" />
      {bat(170, 52, 1, 1)}
      {bat(232, 34, 0.75, 2)}
      {bat(330, 62, 0.9, 3)}
      {bat(400, 40, 0.6, 4)}
      <path d="M0 138 Q110 108 240 132 T470 122 T600 118 V200 H0Z" fill={far} />
      <path d="M-10 160 Q60 140 90 158" fill="none" stroke="#2f4a1c" strokeWidth="2" opacity="0.6" />
      <path d="M0 166 Q150 142 300 162 T600 154 V200 H0Z" fill={near} />
      <path d="M40 186 C80 170 120 192 160 178 S240 170 300 186 S420 172 470 184 S560 176 600 182" fill="none" stroke="#3c5a24" strokeWidth="2.4" opacity="0.8" />
      {pumpkin(64, 184, 0.62, false, 0)}
      {pumpkin(128, 172, 1.15, true, 1)}
      {pumpkin(256, 182, 0.78, true, 2)}
      {pumpkin(386, 174, 1.35, true, 3)}
      {pumpkin(504, 184, 0.8, false, 4)}
      {pumpkin(560, 178, 0.95, true, 5)}
      <rect y="170" width="600" height="30" fill="#fff" opacity="0.05" {...anim("sc-drift", 14)} />
    </>
  );
}

function Mountains({ p, id, stars, snow }: Opts) {
  const [sky1, sky2, orb, farC, midC, nearC, snowC] = p;
  const peaks: [number, number][] = [[170, 70], [290, 58], [410, 76], [530, 82]];
  return (
    <>
      <Sky id={id} a={sky1} b={sky2} />
      {stars ? <Stars n={55} top={95} seed={5} /> : null}
      <Glow id={id} x={460} y={76} r={24} color={orb} core={22} />
      <polygon points="0,130 60,96 110,116 170,70 230,104 290,58 350,100 410,76 470,110 530,82 600,104 600,200 0,200" fill={farC} />
      {snow
        ? peaks.map(([x, y]) => (
            <polygon key={x} points={`${x - 15},${y + 13} ${x},${y} ${x + 15},${y + 13} ${x + 8},${y + 9} ${x + 2},${y + 15} ${x - 5},${y + 9}`} fill={snowC} opacity="0.95" />
          ))
        : null}
      <rect y="112" width="600" height="34" fill="#fff" opacity="0.07" {...anim("sc-drift", 18)} />
      <polygon points="0,160 80,121 140,146 220,106 300,151 380,116 460,150 540,121 600,141 600,200 0,200" fill={midC} />
      <polygon points="0,186 100,156 200,181 300,161 400,186 500,166 600,181 600,200 0,200" fill={nearC} />
      {[0, 1, 2].map((i) => (
        <g key={i} {...anim("sc-birds", 22 + i * 5, -i * 7)}>
          <path d={`M${120 + i * 30} ${60 + i * 9} q4 -4 8 0 q4 -4 8 0`} fill="none" stroke={nearC} strokeWidth="1.6" strokeLinecap="round" />
        </g>
      ))}
    </>
  );
}

function Ocean({ p, id, stars }: Opts) {
  const [sky1, sky2, sun, s1, s2, s3, foam] = p;
  return (
    <>
      <Sky id={id} a={sky1} b={sky2} />
      {stars ? <Stars n={45} top={100} seed={8} /> : null}
      <Glow id={id} x={300} y={112} r={32} color={sun} core={32} />
      {Array.from({ length: 7 }, (_, i) => (
        <rect key={i} x={282 - i * 2 + R(i, 3) * 8} y={128 + i * 9} width={36 + i * 4} height="2.5" rx="1.2" fill={sun} opacity={0.7 - i * 0.08} {...anim("sc-tw", 1.6 + R(i) * 1.5, -R(i, 2))} />
      ))}
      <g {...anim("sc-wave", 7)}>
        <path d={wavePath(122, 3, 60)} fill={s1} />
      </g>
      <g {...anim("sc-wave-r", 10)}>
        <path d={wavePath(142, 5, 70)} fill={s2} />
        <path d={wavePath(142, 5, 70).split(" L1260")[0]} fill="none" stroke={foam} strokeWidth="1.5" opacity="0.45" />
      </g>
      <g {...anim("sc-wave", 6)}>
        <path d={wavePath(168, 8, 90)} fill={s3} />
        <path d={wavePath(168, 8, 90).split(" L1260")[0]} fill="none" stroke={foam} strokeWidth="2" opacity="0.5" />
      </g>
    </>
  );
}

function Forest({ p, id, stars, alt }: Opts) {
  const [sky1, sky2, orb, t1, t2, t3, fog, fly] = p;
  const round = (x: number, base: number, h: number, c: string, k: number) => (
    <g key={k}>
      <rect x={x - 3} y={base - h * 0.45} width="6" height={h * 0.45} fill="#4a2a14" />
      <circle cx={x} cy={base - h * 0.62} r={h * 0.3} fill={c} />
      <circle cx={x - h * 0.2} cy={base - h * 0.5} r={h * 0.22} fill={c} />
      <circle cx={x + h * 0.2} cy={base - h * 0.52} r={h * 0.24} fill={c} />
    </g>
  );
  const layer = (n: number, base: number, hMin: number, hMax: number, color: string, seed: number) =>
    Array.from({ length: n }, (_, i) => {
      const x = (i / (n - 1)) * 620 - 10 + (R(i, seed) - 0.5) * 20;
      const h = hMin + R(i, seed + 1) * (hMax - hMin);
      return alt ? round(x, base, h, color, i) : <path key={i} d={pine(x, base, h, h * 0.55)} fill={color} />;
    });
  return (
    <>
      <Sky id={id} a={sky1} b={sky2} />
      {stars ? <Stars n={35} top={80} seed={11} /> : null}
      <Glow id={id} x={455} y={74} r={22} color={orb} core={20} />
      {layer(15, 150, 55, 80, t1, 1)}
      <rect y="120" width="600" height="40" fill={fog} opacity="0.18" {...anim("sc-drift", 16)} />
      {layer(11, 178, 75, 105, t2, 4)}
      <rect y="150" width="600" height="40" fill={fog} opacity="0.14" {...anim("sc-drift", 20, -6)} />
      {layer(8, 212, 100, 135, t3, 9)}
      {alt
        ? Array.from({ length: 12 }, (_, i) => (
            <ellipse key={i} cx={R(i, 21) * 600} cy={-10} rx="4" ry="2.4" fill={i % 2 ? t1 : fly} {...anim("sc-leaffall", 7 + R(i, 22) * 5, -R(i, 23) * 9)} />
          ))
        : Array.from({ length: 16 }, (_, i) => (
            <circle key={i} cx={R(i, 31) * 600} cy={90 + R(i, 32) * 100} r="1.8" fill={fly} filter={`url(#${id}blur)`} {...anim("sc-firefly", 4 + R(i, 33) * 4, -R(i, 34) * 6)} />
          ))}
      <defs>
        <filter id={`${id}blur`} x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="1.2" />
        </filter>
      </defs>
    </>
  );
}

function City({ p, id }: Opts) {
  const [sky1, sky2, moon, bFar, bNear, win, neon] = p;
  return (
    <>
      <Sky id={id} a={sky1} b={sky2} />
      <Stars n={30} top={70} seed={13} />
      <Glow id={id} x={120} y={72} r={20} color={moon} core={18} />
      {Array.from({ length: 19 }, (_, i) => {
        const h = 50 + R(i, 41) * 55;
        return <rect key={i} x={i * 33 - 6} y={200 - h - 20} width="30" height={h + 20} fill={bFar} />;
      })}
      {Array.from({ length: 12 }, (_, i) => {
        const w = 40 + R(i, 51) * 14;
        const x = i * 52 - 8;
        const h = 70 + R(i, 52) * 70;
        const top = 200 - h;
        const rows = Math.floor((h - 12) / 11);
        return (
          <g key={i}>
            <rect x={x} y={top} width={w} height={h} fill={bNear} />
            {i % 4 === 1 ? <rect x={x + w / 2 - 1} y={top - 16} width="2" height="16" fill={bNear} /> : null}
            {i % 4 === 1 ? <circle cx={x + w / 2} cy={top - 17} r="2" fill="#ff3b3b" {...anim("sc-blink", 1.6)} /> : null}
            {Array.from({ length: rows * 3 }, (_, k) => {
              const lit = R(i * 31 + k, 61) > 0.52;
              if (!lit) return null;
              const c = k % 3;
              const r = Math.floor(k / 3);
              return <rect key={k} x={x + 6 + c * ((w - 12) / 3)} y={top + 8 + r * 11} width={(w - 12) / 3 - 4} height="5" fill={win} opacity="0.85" {...(R(k, i) > 0.85 ? anim("sc-tw", 3 + R(k, 9) * 3, -R(k, 8) * 3) : {})} />;
            })}
            {i === 6 ? <rect x={x + 6} y={top + 14} width={w - 12} height="10" rx="2" fill="none" stroke={neon} strokeWidth="2" {...anim("sc-neon", 3)} /> : null}
          </g>
        );
      })}
    </>
  );
}

function Space({ p, id }: Opts) {
  const [bg1, bg2, n1, n2, pl1, pl2, ring] = p;
  return (
    <>
      <defs>
        <radialGradient id={`${id}bg`} cx="0.3" cy="0.4" r="1">
          <stop offset="0" stopColor={bg2} />
          <stop offset="1" stopColor={bg1} />
        </radialGradient>
        <radialGradient id={`${id}pl`} cx="0.35" cy="0.3" r="0.75">
          <stop offset="0" stopColor={pl1} />
          <stop offset="1" stopColor={pl2} />
        </radialGradient>
        <filter id={`${id}neb`} x="-50%" y="-80%" width="200%" height="260%">
          <feGaussianBlur stdDeviation="16" />
        </filter>
      </defs>
      <rect width="600" height="200" fill={`url(#${id}bg)`} />
      <g filter={`url(#${id}neb)`} {...anim("sc-drift", 26)}>
        <ellipse cx="170" cy="90" rx="130" ry="45" fill={n1} opacity="0.55" />
        <ellipse cx="260" cy="130" rx="90" ry="35" fill={n2} opacity="0.45" />
        <ellipse cx="90" cy="60" rx="60" ry="30" fill={n2} opacity="0.35" />
      </g>
      <Stars n={80} top={200} seed={17} />
      <g transform="rotate(-16 470 112)">
        <path d="M384 112 A86 20 0 0 1 556 112" fill="none" stroke={ring} strokeWidth="6" opacity="0.55" />
      </g>
      <circle cx="470" cy="112" r="46" fill={`url(#${id}pl)`} />
      <path d="M470 66 a46 46 0 0 1 0 92 a36 46 0 0 0 0 -92" fill="#000" opacity="0.25" />
      <g transform="rotate(-16 470 112)">
        <path d="M384 112 A86 20 0 0 0 556 112" fill="none" stroke={ring} strokeWidth="6" opacity="0.95" />
        <path d="M392 116 A78 15 0 0 0 548 116" fill="none" stroke={ring} strokeWidth="2" opacity="0.5" />
      </g>
      <circle cx="380" cy="50" r="9" fill={pl1} opacity="0.85" />
      <g {...anim("sc-shoot", 6, -2)}>
        <line x1="0" y1="0" x2="60" y2="20" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity="0.9" />
      </g>
    </>
  );
}

function Aurora({ p, id }: Opts) {
  const [sky1, sky2, a1, a2, a3, snowC, tree] = p;
  const band = (c: string, y: number, k: number) => (
    <g key={k} {...anim(k % 2 ? "sc-aurora-r" : "sc-aurora", 9 + k * 3)}>
      <path d={`M-40 ${y} C80 ${y - 40} 160 ${y + 30} 280 ${y - 10} S500 ${y - 50} 660 ${y} L660 ${y + 70} C500 ${y + 30} 300 ${y + 80} 140 ${y + 40} S20 ${y + 70} -40 ${y + 60} Z`} fill={`url(#${id}a${k})`} filter={`url(#${id}ab)`} />
      <defs>
        <linearGradient id={`${id}a${k}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={c} stopOpacity="0.8" />
          <stop offset="1" stopColor={c} stopOpacity="0" />
        </linearGradient>
      </defs>
    </g>
  );
  return (
    <>
      <Sky id={id} a={sky1} b={sky2} />
      <defs>
        <filter id={`${id}ab`} x="-20%" y="-60%" width="140%" height="220%">
          <feGaussianBlur stdDeviation="5" />
        </filter>
      </defs>
      <Stars n={60} top={120} seed={19} />
      {band(a1, 40, 0)}
      {band(a2, 60, 1)}
      {band(a3, 30, 2)}
      <path d="M0 165 Q140 140 300 160 T600 150 V200 H0Z" fill={snowC} opacity="0.92" />
      {Array.from({ length: 14 }, (_, i) => (
        <path key={i} d={pine(20 + i * 44 + R(i, 71) * 14, 166 + Math.sin(i) * 6, 30 + R(i, 72) * 22, 18)} fill={tree} />
      ))}
      <path d="M0 185 Q200 172 360 186 T600 180 V200 H0Z" fill={snowC} />
    </>
  );
}

function Sakura({ p, id }: Opts) {
  const [sky1, sky2, hill, branch, b1, b2, petal] = p;
  const spots: [number, number, number][] = [
    [40, 34, 7], [70, 20, 6], [95, 46, 8], [130, 30, 7], [160, 52, 6], [190, 40, 8], [215, 62, 6], [240, 50, 7], [265, 70, 6], [290, 60, 8], [320, 76, 6], [110, 70, 6], [180, 78, 5], [60, 60, 6],
    [600, 20, 8], [570, 40, 7], [545, 22, 6], [585, 64, 6], [520, 46, 7],
  ];
  return (
    <>
      <Sky id={id} a={sky1} b={sky2} />
      <circle cx="420" cy="80" r="40" fill="#fff" opacity="0.35" />
      <path d="M0 160 Q150 120 320 150 T600 140 V200 H0Z" fill={hill} opacity="0.75" />
      <path d="M0 180 Q200 160 400 178 T600 172 V200 H0Z" fill={hill} />
      <g transform="translate(0 38)">
      <path d="M-10 18 C60 22 120 40 180 48 S290 64 340 82" fill="none" stroke={branch} strokeWidth="9" strokeLinecap="round" />
      <path d="M90 34 C110 52 120 70 112 82" fill="none" stroke={branch} strokeWidth="5" strokeLinecap="round" />
      <path d="M200 52 C215 66 222 78 218 92" fill="none" stroke={branch} strokeWidth="4" strokeLinecap="round" />
      <path d="M610 6 C580 20 550 30 515 52" fill="none" stroke={branch} strokeWidth="7" strokeLinecap="round" />
      {spots.map(([x, y, r], i) => (
        <g key={i}>
          <Flower x={x} y={y} r={r * 1.15} color={i % 3 ? b1 : b2} center="#ffe08a" />
          <Flower x={x + r * 1.6} y={y + r * 0.9} r={r * 0.75} color={i % 2 ? b2 : b1} center="#ffe08a" />
        </g>
      ))}
      </g>
      {Array.from({ length: 16 }, (_, i) => (
        <ellipse key={i} cx={R(i, 81) * 600} cy={-6} rx="3.6" ry="2.2" fill={petal} {...anim("sc-petal", 7 + R(i, 82) * 6, -R(i, 83) * 10)} />
      ))}
    </>
  );
}

function Candy({ p, id }: Opts) {
  const [sky1, sky2, cloud, c1, c2, c3, hill] = p;
  const lolly = (x: number, y: number, r: number, c: string, k: number) => (
    <g key={k} {...anim("sc-sway", 4 + k, -k)}>
      <rect x={x - 2} y={y} width="4" height={200 - y} fill="#fff" />
      <circle cx={x} cy={y} r={r} fill={c} />
      <path d={`M${x} ${y} m-${r * 0.7} 0 a${r * 0.7} ${r * 0.7} 0 1 1 ${r * 0.7} ${r * 0.7} a${r * 0.45} ${r * 0.45} 0 1 1 -${r * 0.45} -${r * 0.45} a${r * 0.2} ${r * 0.2} 0 1 1 ${r * 0.2} ${r * 0.2}`} fill="none" stroke="#fff" strokeWidth={r * 0.18} strokeLinecap="round" opacity="0.9" />
    </g>
  );
  return (
    <>
      <Sky id={id} a={sky1} b={sky2} />
      <g {...anim("sc-drift", 18)}>
        <Cloud x={60} y={50} s={1} fill={cloud} />
        <Cloud x={330} y={36} s={0.8} fill={cloud} />
      </g>
      <g {...anim("sc-drift", 24, -8)}>
        <Cloud x={470} y={70} s={1.1} fill={cloud} opacity={0.85} />
      </g>
      {Array.from({ length: 22 }, (_, i) => (
        <rect key={i} x={R(i, 91) * 600} y={R(i, 92) * 120} width="7" height="2.4" rx="1.2" fill={[c1, c2, c3][i % 3]} transform={`rotate(${R(i, 93) * 180} ${R(i, 91) * 600} ${R(i, 92) * 120})`} />
      ))}
      {lolly(110, 108, 26, c1, 1)}
      {lolly(470, 120, 22, c2, 2)}
      {lolly(540, 140, 15, c3, 3)}
      <path d="M-20 200 C20 140 90 140 130 200 Z M100 200 C150 150 230 150 270 200 Z M240 200 C290 130 380 130 420 200 Z M390 200 C430 160 500 160 540 200 Z M510 200 C550 150 620 150 650 200 Z" fill={hill} />
      {Array.from({ length: 30 }, (_, i) => (
        <circle key={i} cx={R(i, 95) * 600} cy={170 + R(i, 96) * 28} r="1.6" fill="#fff" opacity="0.8" />
      ))}
    </>
  );
}

function Desert({ p, id, stars }: Opts) {
  const [sky1, sky2, sun, d1, d2, d3, cactus] = p;
  const saguaro = (x: number, base: number, h: number, k: number) => (
    <g key={k} fill={cactus}>
      <rect x={x - 6} y={base - h} width="12" height={h} rx="6" />
      <path d={`M${x - 6} ${base - h * 0.5} h-12 a6 6 0 0 1 -6 -6 v-${h * 0.25} a5 5 0 0 1 10 0 v${h * 0.14} h8 z`} />
      <path d={`M${x + 6} ${base - h * 0.62} h12 a6 6 0 0 0 6 -6 v-${h * 0.18} a5 5 0 0 0 -10 0 v${h * 0.08} h-8 z`} />
    </g>
  );
  return (
    <>
      <Sky id={id} a={sky1} b={sky2} />
      {stars ? <Stars n={60} top={120} seed={23} /> : null}
      <Glow id={id} x={430} y={92} r={38} color={sun} core={38} />
      <path d="M0 140 C100 110 200 150 320 128 S520 110 600 130 V200 H0Z" fill={d1} />
      <path d="M0 165 C120 140 220 172 360 152 S520 140 600 158 V200 H0Z" fill={d2} />
      {saguaro(140, 160, 48, 1)}
      {saguaro(498, 166, 36, 2)}
      <path d="M0 186 C140 170 260 194 400 178 S540 172 600 182 V200 H0Z" fill={d3} />
      <rect y="120" width="600" height="20" fill="#fff" opacity="0.06" {...anim("sc-drift", 9)} />
    </>
  );
}

function Underwater({ p, id }: Opts) {
  const [w1, w2, ray, weed, co1, co2, bub] = p;
  return (
    <>
      <Sky id={id} a={w1} b={w2} />
      {[60, 180, 320, 450, 540].map((x, i) => (
        <polygon key={x} points={`${x},0 ${x + 30},0 ${x + 90},200 ${x + 20},200`} fill={ray} opacity="0.1" {...anim("sc-ray", 6 + i, -i)} />
      ))}
      <path d="M0 182 C150 170 300 190 450 176 S580 176 600 180 V200 H0Z" fill="#e8d3a2" opacity="0.55" />
      {Array.from({ length: 10 }, (_, i) => {
        const x = 20 + i * 62 + R(i, 101) * 20;
        const h = 50 + R(i, 102) * 50;
        return <path key={i} d={`M${x} 200 C${x - 10} ${200 - h * 0.3} ${x + 10} ${200 - h * 0.6} ${x} ${200 - h}`} fill="none" stroke={weed} strokeWidth="6" strokeLinecap="round" {...anim("sc-sway", 3 + R(i, 103) * 2, -R(i, 104) * 3)} />;
      })}
      <path d="M90 200 v-26 M90 184 l-12 -14 M90 180 l12 -16 M78 170 l-6 -10 M102 164 l8 -8" stroke={co1} strokeWidth="6" strokeLinecap="round" fill="none" />
      <path d="M420 200 v-30 M420 182 l-14 -12 M420 176 l14 -16" stroke={co1} strokeWidth="7" strokeLinecap="round" fill="none" />
      <ellipse cx="250" cy="194" rx="22" ry="14" fill={co2} />
      <ellipse cx="540" cy="194" rx="16" ry="11" fill={co2} />
      {[0, 1, 2].map((i) => (
        <g key={i} {...anim(i % 2 ? "sc-swim-r" : "sc-swim", 14 + i * 4, -i * 5)}>
          <g transform={`translate(0 ${60 + i * 34})`} fill={i % 2 ? co2 : co1}>
            <ellipse cx="0" cy="0" rx="10" ry="5" />
            <path d="M-9 0 L-16 -5 L-16 5 Z" />
            <circle cx="5" cy="-1" r="1" fill="#000" />
          </g>
        </g>
      ))}
      {Array.from({ length: 16 }, (_, i) => (
        <circle key={i} cx={R(i, 111) * 600} cy={205} r={1.5 + R(i, 112) * 3} fill="none" stroke={bub} strokeWidth="1" opacity="0.8" {...anim("sc-bubble", 5 + R(i, 113) * 5, -R(i, 114) * 8)} />
      ))}
    </>
  );
}

function Retro({ p, id }: Opts) {
  const [sky1, sky2, sun1, sun2, grid, ground, mtn] = p;
  return (
    <>
      <Sky id={id} a={sky1} b={sky2} />
      <Stars n={35} top={70} seed={29} />
      <defs>
        <linearGradient id={`${id}sun`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={sun1} />
          <stop offset="1" stopColor={sun2} />
        </linearGradient>
        <mask id={`${id}cut`}>
          <rect width="600" height="200" fill="#fff" />
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <rect key={i} x="0" y={92 + i * 6.5} width="600" height={1.4 + i * 0.7} fill="#000" />
          ))}
        </mask>
      </defs>
      <circle cx="300" cy="104" r="58" fill={`url(#${id}sun)`} mask={`url(#${id}cut)`} />
      <polygon points="0,122 70,96 120,110 180,82 250,122 330,122 400,88 460,106 520,90 600,122" fill={ground} stroke={mtn} strokeWidth="1.5" />
      <rect y="122" width="600" height="78" fill={ground} />
      <g stroke={grid} strokeWidth="1.2" opacity="0.85">
        {Array.from({ length: 21 }, (_, i) => (
          <line key={i} x1="300" y1="122" x2={-300 + i * 60} y2="200" />
        ))}
        <g {...anim("sc-grid", 1.6)}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <line key={i} x1="0" x2="600" y1={124 + Math.pow(i, 1.7) * 6} y2={124 + Math.pow(i, 1.7) * 6} />
          ))}
        </g>
      </g>
      <line x1="0" x2="600" y1="122" y2="122" stroke={grid} strokeWidth="2" />
    </>
  );
}

function Clouds({ p, id }: Opts) {
  const [sky1, sky2, sun, c1, c2, c3] = p;
  return (
    <>
      <Sky id={id} a={sky1} b={sky2} />
      <g {...anim("sc-spin", 60)} style={{ transformOrigin: "470px 74px", animationDuration: "60s" }}>
        {Array.from({ length: 12 }, (_, i) => (
          <rect key={i} x="466" y="-46" width="8" height="70" fill={sun} opacity="0.18" transform={`rotate(${i * 30} 470 74)`} />
        ))}
      </g>
      <Glow id={id} x={470} y={74} r={22} color={sun} core={22} />
      <g {...anim("sc-drift", 30)}>
        <Cloud x={20} y={60} s={1.3} fill={c3} opacity={0.8} />
        <Cloud x={300} y={45} s={1} fill={c3} opacity={0.8} />
      </g>
      <g {...anim("sc-drift-r", 22)}>
        <Cloud x={140} y={110} s={1.6} fill={c2} />
        <Cloud x={420} y={120} s={1.4} fill={c2} />
      </g>
      <g {...anim("sc-drift", 16)}>
        <Cloud x={-20} y={170} s={2} fill={c1} />
        <Cloud x={230} y={182} s={2.2} fill={c1} />
        <Cloud x={470} y={175} s={1.9} fill={c1} />
      </g>
    </>
  );
}

function Meadow({ p, id }: Opts) {
  const [sky1, sky2, sun, h1, h2, f1, f2] = p;
  return (
    <>
      <Sky id={id} a={sky1} b={sky2} />
      <Glow id={id} x={120} y={72} r={22} color={sun} core={20} />
      <g {...anim("sc-drift", 26)}>
        <Cloud x={300} y={50} s={0.8} fill="#fff" opacity={0.85} />
        <Cloud x={480} y={34} s={0.6} fill="#fff" opacity={0.75} />
      </g>
      <path d="M0 140 Q150 100 320 132 T600 120 V200 H0Z" fill={h1} />
      <path d="M0 166 Q170 138 330 160 T600 150 V200 H0Z" fill={h2} />
      {Array.from({ length: 46 }, (_, i) => {
        const x = R(i, 121) * 600;
        const y = 162 + R(i, 122) * 36;
        return (
          <g key={i} {...anim("sc-sway", 3 + R(i, 123) * 2, -R(i, 124) * 3)}>
            <line x1={x} y1={y} x2={x} y2={y + 8} stroke="#2e6b2e" strokeWidth="1" />
            <Flower x={x} y={y} r={2.4 + R(i, 125) * 1.8} color={i % 2 ? f1 : f2} center={i % 3 ? "#ffe066" : "#fff"} />
          </g>
        );
      })}
      {[0, 1].map((i) => (
        <g key={i} {...anim("sc-flutter", 8 + i * 3, -i * 4)}>
          <g transform={`translate(${200 + i * 160} ${100 + i * 12})`}>
            <ellipse cx="-4" cy="0" rx="4" ry="5" fill={i ? f1 : f2} {...anim("sc-flap", 0.3)} />
            <ellipse cx="4" cy="0" rx="4" ry="5" fill={i ? f1 : f2} {...anim("sc-flap", 0.3)} />
          </g>
        </g>
      ))}
    </>
  );
}

function Village({ p, id }: Opts) {
  const [sky1, sky2, snowC, house, roof, win, tree] = p;
  const home = (x: number, w: number, h: number, k: number) => (
    <g key={k}>
      <rect x={x} y={170 - h} width={w} height={h} fill={house} />
      <polygon points={`${x - 6},${170 - h} ${x + w / 2},${170 - h - w * 0.45} ${x + w + 6},${170 - h}`} fill={roof} />
      <rect x={x + w * 0.65} y={170 - h - w * 0.4} width="7" height={w * 0.3} fill={house} />
      <rect x={x + w * 0.2} y={170 - h + 10} width={w * 0.22} height={w * 0.2} fill={win} {...anim("sc-tw", 4 + k, -k)} />
      <rect x={x + w * 0.58} y={170 - h + 10} width={w * 0.22} height={w * 0.2} fill={win} />
      <rect x={x + w * 0.4} y={170 - h * 0.45} width={w * 0.2} height={h * 0.45} fill="#3a2418" />
      {[0, 1, 2].map((s) => (
        <circle key={s} cx={x + w * 0.65 + 3} cy={170 - h - w * 0.45} r={3 + s} fill="#fff" opacity="0.35" {...anim("sc-smoke", 4, -s * 1.3 - k)} />
      ))}
    </g>
  );
  return (
    <>
      <Sky id={id} a={sky1} b={sky2} />
      <Stars n={50} top={90} seed={37} />
      <Glow id={id} x={520} y={68} r={16} color="#fffbe6" core={14} />
      <path d="M0 140 Q160 112 330 136 T600 126 V200 H0Z" fill={snowC} opacity="0.85" />
      {Array.from({ length: 12 }, (_, i) => (
        <path key={i} d={pine(10 + i * 52 + R(i, 131) * 10, 142 + Math.sin(i * 1.7) * 6, 34 + R(i, 132) * 18, 20)} fill={tree} />
      ))}
      {home(70, 44, 34, 1)}
      {home(160, 56, 42, 2)}
      {home(300, 48, 36, 3)}
      {home(420, 60, 46, 4)}
      <path d="M0 170 Q200 160 400 172 T600 166 V200 H0Z" fill={snowC} />
      {Array.from({ length: 26 }, (_, i) => (
        <circle key={i} cx={R(i, 141) * 600} cy={-4} r={1 + R(i, 142) * 1.4} fill="#fff" {...anim("sc-snow", 6 + R(i, 143) * 6, -R(i, 144) * 10)} />
      ))}
    </>
  );
}

function Lava({ p, id }: Opts) {
  const [bg1, bg2, rock1, rock2, l1, l2, ember] = p;
  return (
    <>
      <Sky id={id} a={bg1} b={bg2} />
      <defs>
        <linearGradient id={`${id}lava`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={l1} />
          <stop offset="0.5" stopColor={l2} />
          <stop offset="1" stopColor={l1} />
        </linearGradient>
        <filter id={`${id}lb`} x="-30%" y="-100%" width="160%" height="300%">
          <feGaussianBlur stdDeviation="4" />
        </filter>
      </defs>
      <ellipse cx="300" cy="200" rx="360" ry="70" fill={l1} opacity="0.25" filter={`url(#${id}lb)`} {...anim("sc-flicker", 3)} />
      {[0, 1, 2].map((i) => (
        <circle key={i} cx={290 + i * 14} cy={40 - i * 8} r={14 + i * 6} fill="#000" opacity="0.25" {...anim("sc-smoke", 7, -i * 2)} />
      ))}
      <path d="M140 200 L250 66 L290 58 L330 64 L460 200 Z" fill={rock1} />
      <path d="M262 64 Q300 50 320 64" fill="none" stroke={l2} strokeWidth="4" filter={`url(#${id}lb)`} {...anim("sc-flicker", 2)} />
      <path d="M296 62 C292 100 312 120 300 150 S320 186 312 200" fill="none" stroke={`url(#${id}lava)`} strokeWidth="7" strokeLinecap="round" {...anim("sc-flicker", 2.6)} />
      <path d="M0 200 L0 160 L70 140 L120 168 L170 150 L200 200 Z M420 200 L460 150 L520 170 L560 140 L600 150 L600 200 Z" fill={rock2} />
      <path d="M0 196 C120 186 220 200 340 190 S520 186 600 194 V200 H0Z" fill={`url(#${id}lava)`} {...anim("sc-flicker", 3.3)} />
      {Array.from({ length: 22 }, (_, i) => (
        <circle key={i} cx={R(i, 151) * 600} cy={205} r={1 + R(i, 152) * 1.6} fill={ember} {...anim("sc-ember", 4 + R(i, 153) * 4, -R(i, 154) * 6)} />
      ))}
    </>
  );
}

const SCENES: Record<BannerSpec["scene"], (o: Opts) => ReactNode> = {
  pumpkins: Pumpkins,
  mountains: Mountains,
  ocean: Ocean,
  forest: Forest,
  city: City,
  space: Space,
  aurora: Aurora,
  sakura: Sakura,
  candy: Candy,
  desert: Desert,
  underwater: Underwater,
  retro: Retro,
  clouds: Clouds,
  meadow: Meadow,
  village: Village,
  lava: Lava,
};

/** A banner scene filling its box. */
export function BannerScene({ spec, className }: { spec: BannerSpec; className?: string }) {
  const raw = useId();
  const id = `s${raw.replace(/[^a-zA-Z0-9]/g, "")}`;
  const Scene = SCENES[spec.scene];
  return (
    <svg className={`sc${className ? ` ${className}` : ""}`} viewBox="0 0 600 200" preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false">
      {Scene({ ...spec, id })}
    </svg>
  );
}
