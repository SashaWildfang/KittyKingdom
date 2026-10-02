"use client";

import { anim, dk, H, LG, lt, mix, R, RG, url, W } from "./scene-kit";

// Signature pieces that make each banner its own place, layered into the shared scenes.
// Each takes the scene's id (for gradient ids) and palette colours.

// ---------- Pumpkin scenes ----------
export function Scarecrow({ id, x, y }: { id: string; x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <defs>
        <LG id={`${id}sc`} s={[[0, "#c99a52"], [1, "#7a5a2a"]]} />
      </defs>
      <rect x="-1.6" y="-64" width="3.2" height="66" fill="#5a3a20" />
      <rect x="-26" y="-48" width="52" height="3" fill="#5a3a20" />
      <g {...anim("sc-sway", 4)}>
        <path d="M-12 -48 L12 -48 L14 -18 L-14 -18 Z" fill="#4a6a9a" />
        <path d="M-12 -48 L-28 -42 L-26 -36 L-12 -40 Z M12 -48 L28 -42 L26 -36 L12 -40 Z" fill="#4a6a9a" />
        <rect x="-4" y="-38" width="8" height="8" fill="#c43d42" opacity="0.8" />
        {[-28, 28].map((sx) => (
          <path key={sx} d={`M${sx} -42 l${sx > 0 ? 4 : -4} 2 l${sx > 0 ? -1 : 1} 4 Z`} fill={url(`${id}sc`)} />
        ))}
        <path d="M-12 -18 L-8 -6 L-4 -18 M4 -18 L8 -6 L12 -18" fill="none" stroke={url(`${id}sc`)} strokeWidth="2" />
        <circle cx="0" cy="-56" r="8" fill="#e8c88a" />
        <path d="M-12 -60 L12 -60 L8 -66 L4 -74 L-4 -74 L-8 -66 Z" fill="#6b4a22" />
        <circle cx="-3" cy="-57" r="1.2" fill="#2a1a0e" />
        <circle cx="3" cy="-57" r="1.2" fill="#2a1a0e" />
        <path d="M-3 -52 q3 2 6 0" stroke="#2a1a0e" strokeWidth="0.8" fill="none" />
      </g>
    </g>
  );
}

export function HayBales({ id, x, y }: { id: string; x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <defs>
        <LG id={`${id}hay`} s={[[0, "#f2d27a"], [1, "#b8902e"]]} />
      </defs>
      {[[0, 0, 26], [30, 2, 22], [14, -18, 22]].map(([bx, by, r], i) => (
        <g key={i}>
          <ellipse cx={bx + 2} cy={by + r * 0.45} rx={r * 0.9} ry="3" fill="#000" opacity="0.2" />
          <rect x={bx - r * 0.8} y={by - r * 0.4} width={r * 1.6} height={r * 0.85} rx="3" fill={url(`${id}hay`)} />
          <circle cx={bx + r * 0.8} cy={by} r={r * 0.42} fill="#e8c460" stroke="#b8902e" strokeWidth="0.8" />
          <path d={`M${bx + r * 0.8} ${by} m-${r * 0.25} 0 a${r * 0.25} ${r * 0.25} 0 1 1 ${r * 0.25} ${r * 0.25}`} fill="none" stroke="#b8902e" strokeWidth="0.7" />
          {Array.from({ length: 6 }, (_, k) => (
            <line key={k} x1={bx - r * 0.7 + k * r * 0.25} y1={by - r * 0.35} x2={bx - r * 0.75 + k * r * 0.25} y2={by + r * 0.4} stroke="#b8902e" strokeWidth="0.6" opacity="0.6" />
          ))}
        </g>
      ))}
    </g>
  );
}

export function CornRows({ y }: { y: number }) {
  return (
    <g>
      {Array.from({ length: 40 }, (_, i) => {
        const x = 20 + i * 24 + R(i, 5) * 8;
        const h = 30 + R(i, 6) * 14;
        return (
          <g key={i} {...anim("sc-sway", 3 + R(i, 7) * 2, -R(i, 8) * 3)}>
            <path d={`M${x} ${y} L${x} ${y - h}`} stroke="#8a7a3a" strokeWidth="1.6" />
            {[0.3, 0.5, 0.7].map((t, k) => (
              <path key={k} d={`M${x} ${y - h * t} q${k % 2 ? 10 : -10} -4 ${k % 2 ? 14 : -14} 4`} fill="none" stroke="#a8944a" strokeWidth="1.4" />
            ))}
            <ellipse cx={x + 2} cy={y - h * 0.55} rx="1.8" ry="4" fill="#e8c460" />
          </g>
        );
      })}
    </g>
  );
}

// ---------- Mountain scenes ----------
export function LakeCamp({ id, moon, sky }: { id: string; moon: string; sky: string }) {
  return (
    <g>
      <defs>
        <LG id={`${id}lake`} s={[[0, mix(sky, "#000", 0.2)], [1, mix(sky, "#000", 0.5)]]} />
        <RG id={`${id}fire`} s={[[0, "#ffd27a", 0.8], [1, "#ff8a1f", 0]]} />
      </defs>
      <path d={`M-20 196 Q300 188 600 194 T${W + 20} 192 V${H} H-20 Z`} fill={url(`${id}lake`)} />
      {Array.from({ length: 8 }, (_, i) => (
        <rect key={i} x={620 - (16 + i * 6) / 2} y={198 + i * 2.6} width={16 + i * 6} height="1.2" fill={moon} opacity={0.7 - i * 0.07} {...anim("sc-shimmer", 1.6 + R(i) * 1.2, -R(i, 2) * 2)} />
      ))}
      <g transform="translate(300 196)">
        <circle cx="30" cy="-4" r="26" fill={url(`${id}fire`)} {...anim("sc-flicker", 1.4)} />
        <path d="M-18 0 L0 -26 L18 0 Z" fill="#c4602f" />
        <path d="M0 -26 L18 0 L4 0 Z" fill="#8a3a1a" />
        <path d="M-4 0 L0 -10 L4 0 Z" fill="#2a1408" />
        <path d="M24 0 l6 -3 l6 3 M26 0 l8 -4" stroke="#5a3a20" strokeWidth="1.6" />
        <path d="M30 -2 C26 -8 30 -12 30 -16 C34 -12 36 -6 30 -2 Z" fill="#ffb347" {...anim("sc-flicker", 0.8)} />
        <path d="M30 -3 C28 -6 30 -9 30 -11 C32 -8 33 -5 30 -3 Z" fill="#fff3b0" />
      </g>
    </g>
  );
}

export function Chalet({ id, x, y }: { id: string; x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <defs>
        <LG id={`${id}ch`} s={[[0, "#b07a4a"], [1, "#6b4224"]]} />
      </defs>
      <ellipse cx="0" cy="2" rx="40" ry="4" fill="#000" opacity="0.2" />
      <rect x="-24" y="-24" width="48" height="24" fill={url(`${id}ch`)} />
      <rect x="-24" y="-10" width="48" height="2" fill="#4a2a14" />
      <path d="M-34 -22 L0 -48 L34 -22 L28 -22 L0 -42 L-28 -22 Z" fill="#ffffff" />
      <path d="M-28 -22 L0 -42 L28 -22 Z" fill="#7a3a24" />
      {[-14, 0, 14].map((wx) => (
        <g key={wx}>
          <rect x={wx - 4} y="-20" width="8" height="7" fill="#ffd27a" />
          <rect x={wx - 5} y="-13" width="10" height="2.5" fill="#e5484d" />
        </g>
      ))}
      <rect x="-4" y="-8" width="8" height="8" fill="#4a2a14" />
    </g>
  );
}

export function River({ id, color, y0 }: { id: string; color: string; y0: number }) {
  return (
    <g>
      <defs>
        <LG id={`${id}riv`} s={[[0, lt(color, 0.3)], [1, color]]} />
      </defs>
      <path d={`M470 ${y0} C480 ${y0 + 20} 420 ${y0 + 30} 440 ${y0 + 46} C470 ${y0 + 66} 560 ${y0 + 70} 520 ${H + 4} L640 ${H + 4} C660 ${y0 + 70} 520 ${y0 + 60} 480 ${y0 + 44} C462 ${y0 + 32} 500 ${y0 + 20} 486 ${y0} Z`} fill={url(`${id}riv`)} opacity="0.9" />
      {Array.from({ length: 6 }, (_, i) => (
        <path key={i} d={`M${470 + i * 14} ${y0 + 20 + i * 14} q8 -2 16 0`} stroke="#fff" strokeWidth="0.8" opacity="0.5" {...anim("sc-shimmer", 1.8 + i * 0.3, -i * 0.4)} />
      ))}
    </g>
  );
}

// ---------- Ocean scenes ----------
export function Lighthouse({ id, hz }: { id: string; hz: number }) {
  return (
    <g>
      <defs>
        <LG id={`${id}lb`} s={[[0, "#fff6c9", 0.55], [1, "#fff6c9", 0]]} x2={1} y2={0} />
        <LG id={`${id}cliff`} s={[[0, "#3a4a5a"], [1, "#151c26"]]} />
      </defs>
      <path d={`M700 ${H} L700 ${hz + 10} L740 ${hz - 6} L800 ${hz - 12} L860 ${hz - 8} L900 ${hz + 4} L960 ${hz + 16} L${W + 20} ${hz + 20} L${W + 20} ${H} Z`} fill={url(`${id}cliff`)} />
      <g transform={`translate(810 ${hz - 12})`}>
        <path d="M-9 0 L-6 -58 L6 -58 L9 0 Z" fill="#f4f1ec" />
        {[0, 1, 2].map((i) => (
          <path key={i} d={`M${-8.6 + i * 1} ${-10 - i * 16} L${8.6 - i * 1} ${-10 - i * 16} L${8.2 - i * 1} ${-18 - i * 16} L${-8.2 + i * 1} ${-18 - i * 16} Z`} fill="#e5484d" />
        ))}
        <path d="M-9 0 L-6 -58 L0 -58 L0 0 Z" fill="#000" opacity="0.15" />
        <rect x="-7" y="-66" width="14" height="8" fill="#fff6c9" {...anim("sc-flicker", 2)} />
        <path d="M-8 -66 L0 -74 L8 -66 Z" fill="#2a2a32" />
        <g transform="translate(0 -62)">
          <g {...anim("sc-beam", 6)}>
            <path d="M0 0 L-260 -30 L-260 30 Z" fill={url(`${id}lb`)} transform="scale(-1 1)" />
          </g>
        </g>
      </g>
    </g>
  );
}

export function SeaStacks({ id, hz, color }: { id: string; hz: number; color: string }) {
  return (
    <g>
      <defs>
        <LG id={`${id}st`} x2={1} y2={0} s={[[0, lt(color, 0.15)], [0.6, color], [1, dk(color, 0.4)]]} />
      </defs>
      <path d={`M-20 ${H} L-20 ${hz - 40} L30 ${hz - 50} L70 ${hz - 30} L110 ${hz - 34} L150 ${hz + 10} L160 ${H} Z`} fill={url(`${id}st`)} />
      <path d={`M200 ${hz + 6} L206 ${hz - 34} L222 ${hz - 40} L232 ${hz - 20} L238 ${hz + 6} Z`} fill={url(`${id}st`)} />
      <path d={`M256 ${hz + 4} L260 ${hz - 14} L270 ${hz - 18} L276 ${hz + 4} Z`} fill={url(`${id}st`)} />
      {[0, 1].map((i) => (
        <g key={i} transform={`translate(${380 + i * 70} ${hz + 18})`}>
          <g {...anim("sc-dolphin", 4.5, -i * 2.2)}>
            <g transform="translate(0 -22)">
              <path d="M-12 2 C-6 -6 6 -8 12 -2 C10 0 8 1 6 1 L10 6 L4 3 C0 4 -6 4 -12 2 Z" fill={dk(color, 0.3)} />
              <path d="M-1 -5 L2 -11 L4 -5 Z" fill={dk(color, 0.3)} />
            </g>
          </g>
        </g>
      ))}
    </g>
  );
}

// ---------- Forest scenes ----------
export function Deer({ x, y, color }: { x: number; y: number; color: string }) {
  return (
    <g transform={`translate(${x} ${y})`} fill={color}>
      <path d="M-14 -16 C-14 -22 10 -22 12 -16 L14 -18 L16 -26 L20 -24 L18 -16 L16 -12 L12 -12 L11 0 L9 0 L8 -10 L-8 -10 L-10 0 L-12 0 L-12 -11 Z" />
      <path d="M16 -26 L14 -34 M16 -30 L12 -32 M18 -26 L22 -34 M20 -30 L24 -31" stroke={color} strokeWidth="1.2" fill="none" />
      <g {...anim("sc-blinkeye", 6)}>
        <rect x="-9" y="-10" width="1.6" height="10" />
      </g>
    </g>
  );
}

export function FairyLights({ id }: { id: string }) {
  const lights = Array.from({ length: 26 }, (_, i) => {
    const t = i / 25;
    const x = 120 + t * 760;
    const y = 70 + Math.sin(t * Math.PI * 3) * 14 + t * 10;
    return [x, y] as [number, number];
  });
  return (
    <g>
      <defs>
        <RG id={`${id}fl`} s={[[0, "#fff", 1], [0.3, "#fff6c9", 0.8], [1, "#ffd27a", 0]]} />
      </defs>
      <path d={`M${lights.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(" L")}`} fill="none" stroke="#2a1a3a" strokeWidth="0.8" />
      {lights.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y + 3} r="5" fill={url(`${id}fl`)} {...anim("sc-tw", 1.4 + (i % 4) * 0.4, -i * 0.2)} />
      ))}
    </g>
  );
}

export function FairyTree({ id, x, base, color, glow }: { id: string; x: number; base: number; color: string; glow: string }) {
  return (
    <g transform={`translate(${x} ${base})`}>
      <defs>
        <RG id={`${id}door`} s={[[0, "#fff6c9"], [1, glow]]} />
      </defs>
      <path d="M-26 0 C-18 -30 -22 -60 -14 -90 L14 -90 C22 -60 18 -30 26 0 Z" fill={dk(color, 0.3)} />
      <path d="M-14 -90 C-30 -100 -40 -96 -50 -106 M14 -90 C30 -102 44 -96 52 -110 M0 -90 L0 -110" stroke={dk(color, 0.3)} strokeWidth="6" strokeLinecap="round" fill="none" />
      <path d="M-8 0 L-8 -16 A8 8 0 0 1 8 -16 L8 0 Z" fill={url(`${id}door`)} {...anim("sc-flicker", 3)} />
      <circle cx="4" cy="-8" r="1" fill="#5a3a20" />
      <circle cx="-14" cy="-40" r="4" fill={url(`${id}door`)} />
      <circle cx="0" cy="-30" r="34" fill={glow} opacity="0.12" />
    </g>
  );
}

// ---------- City scenes ----------
export function Holograms({ id, neon, win }: { id: string; neon: string; win: string }) {
  return (
    <g>
      <defs>
        <LG id={`${id}holo`} s={[[0, neon, 0.75], [1, neon, 0.15]]} />
      </defs>
      <g transform="translate(300 70)" {...anim("sc-neon", 5)}>
        <rect x="-26" y="-16" width="52" height="32" rx="3" fill={url(`${id}holo`)} stroke={neon} strokeWidth="1" />
        <path d="M-14 -4 L-6 -10 L2 -2 L10 -8 L16 2" fill="none" stroke="#fff" strokeWidth="1.4" />
        <rect x="-18" y="6" width="36" height="3" fill="#fff" opacity="0.6" />
      </g>
      <g transform="translate(760 60)" {...anim("sc-neon", 6.5, -2)}>
        <rect x="-18" y="-24" width="36" height="48" rx="3" fill="none" stroke="#00f0ff" strokeWidth="1.4" />
        <circle cx="0" cy="-4" r="10" fill="none" stroke="#00f0ff" strokeWidth="1.4" />
        <path d="M-8 14 h16" stroke={win} strokeWidth="2" />
      </g>
      {[0, 1, 2].map((i) => (
        <g key={i} {...anim(i % 2 ? "sc-drive-r" : "sc-drive", 7 + i * 3, -i * 3)}>
          <g transform={`translate(0 ${54 + i * 18})`}>
            <path d="M0 0 L14 -4 L26 -4 L32 0 Z" fill="#1a1030" />
            <rect x="2" y="-1" width="28" height="2" fill={i % 2 ? neon : "#00f0ff"} />
            <path d={i % 2 ? "M32 0 h30" : "M0 0 h-30"} stroke={i % 2 ? neon : "#00f0ff"} strokeWidth="1" opacity="0.5" />
          </g>
        </g>
      ))}
    </g>
  );
}

export function Bridge({ id, color, glow }: { id: string; color: string; glow: string }) {
  return (
    <g>
      <defs>
        <LG id={`${id}rv`} s={[[0, lt(glow, 0.2)], [1, dk(color, 0.2)]]} />
      </defs>
      <rect y="190" width={W} height="30" fill={url(`${id}rv`)} />
      {Array.from({ length: 10 }, (_, i) => (
        <rect key={i} x={R(i, 5) * W} y={196 + R(i, 6) * 20} width={20 + R(i, 7) * 30} height="1.2" fill={glow} opacity="0.5" {...anim("sc-shimmer", 1.6 + R(i, 8), -R(i, 9) * 2)} />
      ))}
      <g stroke="#c4502b" fill="none">
        <path d="M200 96 L200 200 M800 96 L800 200" strokeWidth="9" />
        <path d="M193 110 H207 M193 140 H207 M793 110 H807 M793 140 H807" strokeWidth="3" />
        <path d="M60 184 L940 184" strokeWidth="6" />
        <path d="M60 188 L940 188" stroke="#7a2e16" strokeWidth="2" />
        <path d="M200 98 Q500 200 800 98" strokeWidth="2.6" />
        <path d="M-20 160 Q90 120 200 98 M800 98 Q910 120 1020 160" strokeWidth="2.6" />
        {Array.from({ length: 28 }, (_, i) => {
          const x = 214 + i * 21;
          const t = (x - 200) / 600;
          const y = 98 + 4 * 51 * t * (1 - t);
          return <line key={i} x1={x} y1={y} x2={x} y2={184} strokeWidth="0.9" />;
        })}
      </g>
      <path d="M197 96 L197 200" stroke="#ff8a5a" strokeWidth="2" opacity="0.6" />
      <path d="M797 96 L797 200" stroke="#ff8a5a" strokeWidth="2" opacity="0.6" />
      {Array.from({ length: 16 }, (_, i) => (
        <circle key={i} cx={130 + i * 50} cy="181" r="1.6" fill={glow} {...anim("sc-tw", 2 + (i % 3), -i * 0.3)} />
      ))}
    </g>
  );
}

export function RainStreet({ id, lamp }: { id: string; lamp: string }) {
  return (
    <g>
      <defs>
        <RG id={`${id}lampg`} s={[[0, lamp, 0.55], [1, lamp, 0]]} />
        <LG id={`${id}cone`} s={[[0, lamp, 0.35], [1, lamp, 0]]} />
      </defs>
      {[250, 720].map((x) => (
        <g key={x}>
          <path d={`M${x} 152 L${x - 30} 210 L${x + 30} 210 Z`} fill={url(`${id}cone`)} />
          <circle cx={x} cy="150" r="18" fill={url(`${id}lampg`)} />
          <rect x={x - 1.4} y="150" width="2.8" height="62" fill="#1a2030" />
          <path d={`M${x - 6} 150 L${x} 142 L${x + 6} 150 Z`} fill="#1a2030" />
          <ellipse cx={x} cy="214" rx="26" ry="3" fill={lamp} opacity="0.35" {...anim("sc-shimmer", 2)} />
        </g>
      ))}
      <g {...anim("sc-walk", 22, -6)}>
        <g transform="translate(470 212)">
          <path d="M-3 0 L-2 -14 L2 -14 L3 0 Z" fill="#1a2030" />
          <circle cx="0" cy="-17" r="3" fill="#1a2030" />
          <path d="M-14 -20 Q0 -34 14 -20 Z" fill="#e5484d" />
          <line x1="0" y1="-26" x2="0" y2="-14" stroke="#1a2030" strokeWidth="0.8" />
        </g>
      </g>
    </g>
  );
}

// ---------- Space scenes ----------
export function SpiralGalaxy({ id, a, b }: { id: string; a: string; b: string }) {
  return (
    <g transform="translate(640 92)">
      <defs>
        <RG id={`${id}core`} s={[[0, "#ffffff"], [0.2, lt(b, 0.5), 0.9], [1, a, 0]]} />
      </defs>
      <g {...anim("sc-spin", 80)}>
        {[0, 180].map((rot) => (
          <g key={rot} transform={`rotate(${rot}) scale(1 0.5)`}>
            {Array.from({ length: 60 }, (_, i) => {
              const t = i / 59;
              const ang = t * 4.2;
              const r = 6 + t * 70;
              return <circle key={i} cx={Math.cos(ang) * r} cy={Math.sin(ang) * r} r={4.5 - t * 3.2} fill={i % 3 ? lt(b, 0.3) : a} opacity={0.55 - t * 0.35} />;
            })}
          </g>
        ))}
      </g>
      <ellipse rx="26" ry="14" fill={url(`${id}core`)} />
    </g>
  );
}

export function PlanetHorizon({ id, c1, c2, atm }: { id: string; c1: string; c2: string; atm: string }) {
  return (
    <g>
      <defs>
        <LG id={`${id}ph`} s={[[0, c1], [1, dk(c2, 0.4)]]} />
        <LG id={`${id}atm`} s={[[0, atm, 0], [1, atm, 0.8]]} />
      </defs>
      <path d={`M-40 ${H} Q500 120 1040 ${H} Z`} fill={url(`${id}atm`)} transform="translate(0 -14)" />
      <path d={`M-40 ${H + 10} Q500 140 1040 ${H + 10} Z`} fill={url(`${id}ph`)} />
      {Array.from({ length: 5 }, (_, i) => (
        <path key={i} d={`M${100 + i * 40} ${H} Q500 ${160 + i * 12} ${900 - i * 40} ${H}`} fill="none" stroke={lt(c1, 0.3)} strokeWidth="2" opacity="0.25" />
      ))}
      <g {...anim("sc-ufo", 40, -10)}>
        <g transform="translate(0 74)">
          <rect x="-6" y="-4" width="12" height="8" rx="1.5" fill="#d9dde5" />
          <rect x="-22" y="-2.5" width="14" height="5" fill="#3a6ad9" stroke="#9fc0ff" strokeWidth="0.5" />
          <rect x="8" y="-2.5" width="14" height="5" fill="#3a6ad9" stroke="#9fc0ff" strokeWidth="0.5" />
          <circle cx="0" cy="0" r="1.4" fill="#ff4d4d" {...anim("sc-blink", 1.2)} />
        </g>
      </g>
    </g>
  );
}

export function RedSun({ id, c1, c2 }: { id: string; c1: string; c2: string }) {
  return (
    <g transform="translate(640 120)">
      <defs>
        <RG id={`${id}rs`} cx={0.45} cy={0.45} r={0.6} s={[[0, "#fff1c4"], [0.35, c2], [0.85, c1], [1, dk(c1, 0.3)]]} />
        <RG id={`${id}rsg`} s={[[0, c1, 0.6], [1, c1, 0]]} />
      </defs>
      <circle r="180" fill={url(`${id}rsg`)} {...anim("sc-breathe", 4)} />
      <circle r="84" fill={url(`${id}rs`)} />
      {[[-40, -30, 16], [20, 10, 22], [-10, 40, 12], [40, -40, 10]].map(([x, y, r], i) => (
        <circle key={i} cx={x} cy={y} r={r} fill={dk(c1, 0.25)} opacity="0.35" />
      ))}
      {[-60, 30, 150].map((a, i) => (
        <g key={a} transform={`rotate(${a})`}>
          <path d="M84 -6 C110 -26 124 -6 100 10 C112 0 104 -12 86 4 Z" fill={c2} opacity="0.85" {...anim("sc-flicker", 2 + i)} />
        </g>
      ))}
      {/* Asteroid belt */}
      <g transform="rotate(-12)">
        {Array.from({ length: 30 }, (_, i) => {
          const t = i / 29;
          const x = -420 + t * 840;
          const y = 50 + Math.sin(t * Math.PI) * -10 + (R(i, 3) - 0.5) * 16;
          return <ellipse key={i} cx={x} cy={y} rx={2 + R(i, 4) * 4} ry={1.5 + R(i, 5) * 3} fill={mix("#6b5a50", c1, 0.25)} opacity={x > -90 && x < 90 && y < 0 ? 0 : 0.9} />;
        })}
      </g>
    </g>
  );
}

// ---------- Aurora ----------
export function Igloo({ id, snow }: { id: string; snow: string }) {
  return (
    <g transform="translate(560 190)">
      <defs>
        <RG id={`${id}ig`} cx={0.4} cy={0.3} r={0.8} s={[[0, "#ffffff"], [0.7, snow], [1, mix(snow, "#7a8ab8", 0.4)]]} />
      </defs>
      <path d="M-30 0 A30 26 0 0 1 30 0 Z" fill={url(`${id}ig`)} />
      {[-18, -8, 2, 12].map((y, i) => (
        <path key={i} d={`M${-Math.sqrt(900 - (y * 30 / 26) ** 2)} ${y} H${Math.sqrt(900 - (y * 30 / 26) ** 2)}`} stroke="#b8c4e0" strokeWidth="0.8" opacity="0.7" />
      ))}
      <path d="M8 0 V-10 A8 8 0 0 1 24 -10 V0 Z" fill="#ffd27a" {...anim("sc-flicker", 3)} />
      {[[-56, 0], [-44, 2]].map(([x, y], i) => (
        <g key={i} transform={`translate(${x} ${y})`}>
          <g {...anim("sc-waddle", 1.2, -i * 0.4)}>
            <ellipse cx="0" cy="-8" rx="5" ry="8" fill="#1a1a24" />
            <ellipse cx="0.8" cy="-7" rx="3.2" ry="6" fill="#ffffff" />
            <circle cx="0" cy="-16" r="3.6" fill="#1a1a24" />
            <path d="M2 -16 L5 -15 L2 -14 Z" fill="#ffb347" />
          </g>
        </g>
      ))}
    </g>
  );
}

// ---------- Sakura ----------
export function KoiPond({ id }: { id: string }) {
  return (
    <g>
      <defs>
        <LG id={`${id}pond`} s={[[0, "#3d3570"], [1, "#1b1838"]]} />
        <LG id={`${id}lan`} x2={1} y2={0} s={[[0, "#8a8a92"], [1, "#4a4a52"]]} />
        <RG id={`${id}lg`} s={[[0, "#ffe7a3", 0.9], [1, "#ffb347", 0]]} />
      </defs>
      <ellipse cx="520" cy="204" rx="230" ry="22" fill={url(`${id}pond`)} />
      {[[440, 202], [600, 208], [520, 196]].map(([x, y], i) => (
        <g key={i}>
          <ellipse cx={x} cy={y} rx="9" ry="3.4" fill="#3f8f4f" />
          <path d={`M${x} ${y} l9 -1`} stroke="#1b1838" strokeWidth="1" />
          {i === 1 ? <circle cx={x - 2} cy={y - 2} r="2.4" fill="#ffd1e3" /> : null}
        </g>
      ))}
      {[0, 1].map((i) => (
        <g key={i} {...anim(i ? "sc-swim-r" : "sc-swim", 18 + i * 5, -i * 6)}>
          <g transform={`translate(0 ${204 + i * 6})`}>
            <ellipse rx="7" ry="2.4" fill={i ? "#ffffff" : "#ff8a3d"} />
            <circle cx="2" cy="0" r="1.4" fill={i ? "#ff5a5a" : "#ffffff"} />
            <path d="M-7 0 L-11 -2.4 L-11 2.4 Z" fill={i ? "#ffffff" : "#ff8a3d"} />
          </g>
        </g>
      ))}
      <g transform="translate(330 204)">
        <circle cx="0" cy="-26" r="22" fill={url(`${id}lg`)} {...anim("sc-flicker", 3)} />
        <rect x="-4" y="-12" width="8" height="12" fill={url(`${id}lan`)} />
        <rect x="-10" y="-14" width="20" height="3" fill={url(`${id}lan`)} />
        <rect x="-7" y="-26" width="14" height="12" fill={url(`${id}lan`)} />
        <rect x="-4" y="-23" width="8" height="6" fill="#ffe7a3" />
        <path d="M-13 -26 L0 -34 L13 -26 Z" fill={url(`${id}lan`)} />
        <circle cx="0" cy="-36" r="2" fill={url(`${id}lan`)} />
      </g>
    </g>
  );
}

// ---------- Candy ----------
export function CakeMountains({ id, cream, berry }: { id: string; cream: string; berry: string }) {
  return (
    <g>
      <defs>
        <LG id={`${id}cake`} s={[[0, "#f7d9b0"], [1, "#c99a62"]]} />
        <RG id={`${id}sb`} cx={0.4} cy={0.3} r={0.75} s={[[0, "#ff8a9e"], [0.6, berry], [1, dk(berry, 0.35)]]} />
      </defs>
      {[[200, 160, 70], [470, 166, 92], [790, 160, 76]].map(([x, base, w], i) => (
        <g key={i}>
          <rect x={x - w} y={base - w * 0.5} width={w * 2} height={w * 0.5 + 30} rx="4" fill={url(`${id}cake`)} />
          <rect x={x - w} y={base - w * 0.32} width={w * 2} height="5" fill={berry} opacity="0.8" />
          <rect x={x - w * 0.7} y={base - w * 0.95} width={w * 1.4} height={w * 0.48} rx="4" fill={url(`${id}cake`)} />
          <path d={`M${x - w * 0.72} ${base - w * 0.95} h${w * 1.44} v6 ${Array.from({ length: 8 }, (_, k) => `q${w * 0.09} 8 ${w * 0.18} 0`).join(" ")} Z`} fill={cream} />
          <path d={`M${x - w} ${base - w * 0.5} h${w * 2} v5 ${Array.from({ length: 10 }, () => `q${w * 0.1} 8 ${w * 0.2} 0`).join(" ")} Z`} fill={cream} />
          {[-0.4, 0, 0.4].map((t, k) => (
            <g key={k} transform={`translate(${x + t * w} ${base - w * 0.95 - 4})`}>
              <path d="M0 6 C-7 4 -8 -4 0 -6 C8 -4 7 4 0 6 Z" fill={url(`${id}sb`)} />
              <path d="M-3 -6 L0 -9 L3 -6 L0 -5 Z" fill="#3f8f4f" />
              {[[-2, -1], [2, 0], [0, 3]].map(([sx, sy], j) => (
                <circle key={j} cx={sx} cy={sy} r="0.5" fill="#ffe680" />
              ))}
            </g>
          ))}
        </g>
      ))}
    </g>
  );
}

export function GiantStrawberries({ id, berry }: { id: string; berry: string }) {
  return (
    <g>
      {[[300, 200, 1.6], [680, 204, 1.3], [740, 208, 0.9]].map(([x, y, s], i) => (
        <g key={i} transform={`translate(${x} ${y}) scale(${s})`}>
          <ellipse cx="0" cy="12" rx="12" ry="3" fill="#000" opacity="0.15" />
          <path d="M0 12 C-14 6 -14 -10 0 -10 C14 -10 14 6 0 12 Z" fill={url(`${id}sb`)} />
          <path d="M-8 -10 L-4 -15 L0 -11 L4 -15 L8 -10 L0 -8 Z" fill="#3f8f4f" />
          {Array.from({ length: 10 }, (_, j) => (
            <ellipse key={j} cx={(R(j, i + 3) - 0.5) * 16} cy={-4 + R(j, i + 4) * 12} rx="0.7" ry="1.1" fill="#ffe680" />
          ))}
          <ellipse cx="-5" cy="-4" rx="2.6" ry="1.6" fill="#fff" opacity="0.5" />
        </g>
      ))}
    </g>
  );
}

export function IceCreamMountains({ id, c1, c2, c3 }: { id: string; c1: string; c2: string; c3: string }) {
  return (
    <g>
      <defs>
        <LG id={`${id}cone`} s={[[0, "#e8b878"], [1, "#b8803e"]]} />
      </defs>
      {[[200, 166, 56, c1], [470, 170, 74, c2], [790, 166, 60, c3]].map(([x, base, w, c], i) => (
        <g key={i}>
          <path d={`M${(x as number) - (w as number) * 0.8} ${base} L${x} ${(base as number) + 70} L${(x as number) + (w as number) * 0.8} ${base} Z`} fill={url(`${id}cone`)} />
          <path d={`M${(x as number) - (w as number) * 0.6} ${(base as number) + 8} l${(w as number) * 1.2} 30 M${(x as number) + (w as number) * 0.6} ${(base as number) + 8} l${-(w as number) * 1.2} 30`} stroke="#9a6a2e" strokeWidth="1" opacity="0.6" />
          <path d={`M${(x as number) - (w as number)} ${base} C${(x as number) - (w as number)} ${(base as number) - (w as number) * 1.2} ${(x as number) + (w as number)} ${(base as number) - (w as number) * 1.2} ${(x as number) + (w as number)} ${base} q-8 12 -16 2 q-10 16 -22 0 q-10 12 -22 -2 q-12 14 -24 0 q-10 10 -22 0 Z`} fill={c as string} />
          <path d={`M${(x as number) - (w as number) * 0.6} ${(base as number) - (w as number) * 0.7} q${(w as number) * 0.3} -${(w as number) * 0.2} ${(w as number) * 0.6} -${(w as number) * 0.05}`} stroke="#fff" strokeWidth="3" opacity="0.5" fill="none" strokeLinecap="round" />
          <circle cx={x} cy={(base as number) - (w as number) * 0.92} r="6" fill="#e5484d" />
        </g>
      ))}
    </g>
  );
}

export function Peppermints({ y }: { y: number }) {
  return (
    <g>
      {[[260, y], [560, y + 4], [860, y - 2]].map(([x, yy], i) => (
        <g key={i} transform={`translate(${x} ${yy})`}>
          <g {...anim("sc-spin", 10 + i * 3)}>
            <circle r="12" fill="#ffffff" stroke="#e8e8e8" strokeWidth="0.8" />
            {[0, 60, 120, 180, 240, 300].map((a) => (
              <path key={a} d="M0 0 L12 0 A12 12 0 0 1 6 10.4 Z" fill="#e5484d" transform={`rotate(${a})`} />
            ))}
          </g>
          <ellipse cx="-4" cy="-5" rx="3.4" ry="1.8" fill="#fff" opacity="0.7" />
        </g>
      ))}
    </g>
  );
}

// ---------- Desert ----------
export function Caravan({ y, color }: { y: number; color: string }) {
  return (
    <g fill={color}>
      {[0, 1, 2].map((i) => (
        <g key={i} transform={`translate(${620 + i * 34} ${y - i * 2}) scale(0.9)`}>
          <path d="M-12 0 L-11 -10 C-12 -16 -4 -20 0 -14 C4 -20 10 -16 12 -12 L16 -18 L19 -18 L18 -12 L14 -8 L13 0 L11 0 L10 -7 L-8 -7 L-9 0 Z" />
        </g>
      ))}
    </g>
  );
}

export function Oasis({ id, moon }: { id: string; moon: string }) {
  return (
    <g>
      <defs>
        <LG id={`${id}oa`} s={[[0, "#2a3a6a"], [1, "#0c1029"]]} />
        <RG id={`${id}tent`} s={[[0, "#ffd27a", 0.8], [1, "#ffb347", 0]]} />
      </defs>
      <ellipse cx="420" cy="196" rx="120" ry="14" fill={url(`${id}oa`)} />
      {Array.from({ length: 6 }, (_, i) => (
        <rect key={i} x={430 - (10 + i * 5) / 2} y={190 + i * 2.6} width={10 + i * 5} height="1" fill={moon} opacity={0.7 - i * 0.09} {...anim("sc-shimmer", 1.8, -i * 0.3)} />
      ))}
      {[[330, 192, -20], [360, 190, 14], [500, 194, 18]].map(([x, y, lean], i) => (
        <g key={i}>
          <path d={`M${x} ${y} Q${x + lean * 0.3} ${y - 30} ${x + lean} ${y - 54}`} stroke="#0f1a14" strokeWidth="3.4" fill="none" />
          <g transform={`translate(${x + lean} ${y - 54})`}>
            <g {...anim("sc-sway", 4 + i, -i)}>
              {[-150, -110, -70, -30, 10].map((a) => (
                <path key={a} d="M0 0 C10 -8 26 -6 34 4 C24 -2 12 -2 0 0 Z" fill="#0f2a1c" transform={`rotate(${a + 60})`} />
              ))}
            </g>
          </g>
        </g>
      ))}
      <g transform="translate(560 196)">
        <circle cx="0" cy="-8" r="26" fill={url(`${id}tent`)} {...anim("sc-flicker", 3)} />
        <path d="M-20 0 L0 -22 L20 0 Z" fill="#6b3a5a" />
        <path d="M-4 0 L0 -12 L4 0 Z" fill="#ffd27a" />
      </g>
    </g>
  );
}

// ---------- Underwater ----------
export function Turtle({ id }: { id: string }) {
  return (
    <g {...anim("sc-swim", 34, -8)}>
      <defs>
        <RG id={`${id}shell`} cx={0.4} cy={0.35} r={0.75} s={[[0, "#b8d47a"], [0.6, "#6b8a3a"], [1, "#3a5220"]]} />
      </defs>
      <g transform="translate(0 84)">
        <g {...anim("sc-bob", 3)}>
          <path d="M-6 -8 C-14 -18 -26 -16 -30 -10 C-22 -10 -14 -6 -8 -2 Z" fill="#8aa86a" {...anim("sc-flick", 1.6)} />
          <path d="M-6 8 C-14 16 -24 16 -28 12 C-20 10 -12 6 -8 2 Z" fill="#8aa86a" />
          <path d="M8 -6 C14 -14 22 -12 24 -8 C18 -6 14 -4 10 -2 Z" fill="#8aa86a" />
          <ellipse cx="0" cy="0" rx="16" ry="11" fill={url(`${id}shell`)} />
          <path d="M-8 -6 L0 -8 L8 -6 L10 2 L0 6 L-10 2 Z" fill="none" stroke="#3a5220" strokeWidth="0.8" />
          <ellipse cx="20" cy="0" rx="6" ry="4.4" fill="#9ab87a" />
          <circle cx="22" cy="-1.4" r="0.9" fill="#111" />
        </g>
      </g>
    </g>
  );
}

export function Angler({ id, glow }: { id: string; glow: string }) {
  return (
    <g transform="translate(640 118)">
      <defs>
        <RG id={`${id}lure`} s={[[0, "#ffffff"], [0.3, glow, 0.9], [1, glow, 0]]} />
      </defs>
      <g {...anim("sc-bob", 4)}>
        <path d="M-30 0 C-30 -22 10 -26 26 -8 C30 -2 30 6 24 12 C10 26 -30 22 -30 0 Z" fill="#1a1a2e" />
        <path d="M-30 0 L-44 -10 L-42 0 L-44 10 Z" fill="#1a1a2e" />
        <path d="M24 12 L4 6 L26 -2" fill="#0a0a14" />
        {[0, 1, 2, 3, 4].map((i) => (
          <path key={i} d={`M${8 + i * 4} ${4 - i * 0.6} l1.4 3 l1.4 -3`} fill="#e9e9f0" />
        ))}
        <circle cx="8" cy="-10" r="3.4" fill="#e9e9f0" />
        <circle cx="9" cy="-10" r="1.6" fill="#0a0a14" />
        <path d="M0 -20 C8 -40 30 -40 36 -24" fill="none" stroke="#2a2a44" strokeWidth="1.4" />
        <circle cx="36" cy="-22" r="16" fill={url(`${id}lure`)} {...anim("sc-flicker", 2.4)} />
        <circle cx="36" cy="-22" r="2.4" fill="#ffffff" />
      </g>
    </g>
  );
}

// ---------- Retro ----------
export function Road({ hz }: { hz: number }) {
  return (
    <g>
      <path d={`M500 ${hz} L340 ${H} L660 ${H} Z`} fill="#0a0016" opacity="0.9" />
      {Array.from({ length: 6 }, (_, i) => (
        <rect key={i} x={498 - i} y={hz + 6 + Math.pow(i + 1, 1.9) * 2.2} width={4 + i * 2} height={2 + i} fill="#ffd319" opacity="0.8" {...anim("sc-gridline", 1.2, 0, { "--dy": `${Math.pow(i + 2, 1.9) * 2.2 - Math.pow(i + 1, 1.9) * 2.2}px` })} />
      ))}
      <g transform={`translate(500 ${H - 12})`}>
        <path d="M-30 0 L-26 -10 L-14 -16 L14 -16 L26 -10 L30 0 Z" fill="#14002a" />
        <rect x="-28" y="-6" width="10" height="3" fill="#ff2a6d" />
        <rect x="18" y="-6" width="10" height="3" fill="#ff2a6d" />
        <rect x="-26" y="-6" width="52" height="1" fill="#ff2a6d" opacity="0.6" />
      </g>
    </g>
  );
}

export function VaporTemple({ id, a, b, hz }: { id: string; a: string; b: string; hz: number }) {
  return (
    <g>
      <defs>
        <LG id={`${id}col`} x2={1} y2={0} s={[[0, "#e9e4f0"], [0.5, "#ffffff"], [1, "#b8b0c8"]]} />
        <pattern id={`${id}chk`} width="40" height="40" patternUnits="userSpaceOnUse">
          <rect width="40" height="40" fill="#14002a" />
          <rect width="20" height="20" fill={a} opacity="0.5" />
          <rect x="20" y="20" width="20" height="20" fill={a} opacity="0.5" />
        </pattern>
      </defs>
      <path d={`M-200 ${H} L300 ${hz} L700 ${hz} L1200 ${H} Z`} fill={`url(#${id}chk)`} opacity="0.9" />
      {[220, 300, 700, 780].map((x, i) => (
        <g key={x} transform={`translate(${x} ${hz + 40})`}>
          <rect x="-8" y="-76" width="16" height="76" fill={url(`${id}col`)} />
          {[-4, 0, 4].map((dx) => (
            <line key={dx} x1={dx} x2={dx} y1="-74" y2="-2" stroke="#b8b0c8" strokeWidth="0.8" />
          ))}
          <rect x="-11" y="-80" width="22" height="5" fill={url(`${id}col`)} />
          <rect x="-11" y="-2" width="22" height="4" fill={url(`${id}col`)} />
          {i % 2 ? null : <rect x="-9" y="-76" width="18" height="2" fill={b} opacity="0.5" />}
        </g>
      ))}
      <g transform="translate(400 70)">
        <g {...anim("sc-bob", 4)}>
          <path d="M0 -18 L16 10 L-16 10 Z" fill="none" stroke={b} strokeWidth="1.6" />
          <path d="M0 -18 L4 10 M0 -18 L-6 10" stroke={b} strokeWidth="0.8" />
        </g>
      </g>
      <g transform="translate(610 64)">
        <g {...anim("sc-bob", 5, -2)}>
          <circle r="12" fill={a} opacity="0.85" />
          <ellipse cx="-4" cy="-4" rx="4" ry="2.4" fill="#fff" opacity="0.6" />
        </g>
      </g>
    </g>
  );
}

// ---------- Clouds ----------
export function FloatingIslands({ id, grass }: { id: string; grass: string }) {
  const island = (x: number, y: number, s: number, k: number, house: boolean) => (
    <g key={k} transform={`translate(${x} ${y}) scale(${s})`}>
      <g {...anim("sc-float", 6 + k, -k * 2)}>
        <path d="M-40 0 C-30 30 -10 46 0 50 C10 46 30 30 40 0 Z" fill={url(`${id}rock`)} />
        <path d="M-42 0 C-40 -8 40 -8 42 0 C30 6 -30 6 -42 0 Z" fill={grass} />
        {house ? (
          <g transform="translate(-6 -4)">
            <rect x="-8" y="-12" width="16" height="12" fill="#fff4e6" />
            <path d="M-11 -12 L0 -22 L11 -12 Z" fill="#e5484d" />
            <rect x="-2" y="-7" width="4" height="7" fill="#8a5a2b" />
          </g>
        ) : (
          <g transform="translate(10 -4)">
            <rect x="-1.4" y="-14" width="2.8" height="14" fill="#6b4423" />
            <circle cx="0" cy="-18" r="8" fill={grass} />
          </g>
        )}
        <path d="M30 4 C32 20 30 40 32 70" stroke="#bfefff" strokeWidth="3" opacity="0.8" strokeDasharray="6 4" {...anim("sc-flow", 1.2)} />
      </g>
    </g>
  );
  return (
    <g>
      <defs>
        <LG id={`${id}rock`} s={[[0, "#c9a88a"], [1, "#6b5a7a"]]} />
        <LG id={`${id}rb`} s={[[0, "#ff8fab", 0.5], [0.33, "#ffe066", 0.5], [0.66, "#8fd3ff", 0.5], [1, "#b46cff", 0.2]]} />
      </defs>
      <path d="M220 200 A280 160 0 0 1 780 200" fill="none" stroke={url(`${id}rb`)} strokeWidth="22" opacity="0.6" />
      {island(380, 84, 1.25, 1, true)}
      {island(640, 70, 0.95, 2, false)}
      {island(840, 96, 0.75, 3, true)}
    </g>
  );
}
