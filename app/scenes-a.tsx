"use client";

import type { CSSProperties, ReactNode } from "react";
import type { BannerSpec } from "../lib/cosmetics";
import { anim, Bird, Cloud, CloudDefs, dk, H, Hill, hillY, LG, lt, lum, Mist, mix, Orb, Pine, R, RG, RoundTree, Sky, Stars, url, Vignette, W, waveEdge, wavePath } from "./scene-kit";

export type Opts = BannerSpec & { id: string };

// ============ Pumpkin patch ============
export function Pumpkins({ p, id }: Opts) {
  const [sky1, sky2, moon, far, near, body, shade, glow] = p;
  const pumpkin = (x: number, y: number, s: number, face: boolean, k: number) => {
    const lobes: [number, number, number, number][] = [
      [-22, 2, 15, 21],
      [22, 2, 15, 21],
      [-12, 0, 16, 24],
      [12, 0, 16, 24],
      [0, -1, 14, 25],
    ];
    const fl = anim("sc-flicker", 1.8 + (k % 3) * 0.5, -k * 0.7);
    return (
      <g key={k} transform={`translate(${x} ${y}) scale(${s})`}>
        <ellipse cx="0" cy="22" rx="40" ry="7" fill={url(`${id}cs`)} />
        {face ? <ellipse cx="0" cy="22" rx="85" ry="20" fill={url(`${id}pool`)} {...fl} /> : null}
        {lobes.map(([lx, ly, rx, ry], i) => (
          <ellipse key={i} cx={lx} cy={ly} rx={rx} ry={ry} fill={url(i < 2 ? `${id}pkS` : `${id}pk`)} stroke={dk(shade, 0.35)} strokeWidth="0.9" strokeOpacity="0.55" />
        ))}
        <path d="M14 -20 Q30 -16 33 0" fill="none" stroke={lt(moon, 0.2)} strokeWidth="2" strokeLinecap="round" opacity="0.35" />
        <ellipse cx="-7" cy="-13" rx="4" ry="8" fill="#fff" opacity="0.16" transform="rotate(-12 -7 -13)" />
        <path d="M-3 -22 C-5 -31 0 -37 7 -39 L10 -34 C5 -32 3 -28 3 -22 Z" fill={url(`${id}stem`)} />
        <path d="M5 -32 C15 -40 21 -30 13 -27 C9 -26 9 -30 12 -31" fill="none" stroke="#4f7a2e" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M-6 -24 Q-14 -30 -20 -26 Q-15 -22 -6 -24 Z" fill="#3f6a26" />
        {face ? (
          <g {...fl}>
            <g fill={url(`${id}carve`)} stroke={mix(body, glow, 0.5)} strokeWidth="1.1" strokeLinejoin="round">
              <path d="M-15 -6 L-4 -6 L-9 -15 Z" />
              <path d="M15 -6 L4 -6 L9 -15 Z" />
              <path d="M-2.5 -1 L2.5 -1 L0 -5.5 Z" />
              <path d="M-17 4 Q0 21 17 4 L12 8 L8.5 3.5 L4 9 L0 4.5 L-4 9 L-8.5 3.5 L-12 8 Z" />
            </g>
            <ellipse cx="0" cy="0" rx="20" ry="16" fill={url(`${id}inner`)} />
          </g>
        ) : null}
      </g>
    );
  };
  const bat = (x: number, y: number, s: number, k: number) => (
    <g key={k} transform={`translate(${x} ${y}) scale(${s})`}>
      <g {...anim("sc-batfly", 11 + k * 2.5, -k * 3.3)}>
        <g {...anim("sc-bob", 1.4 + k * 0.2, -k)}>
          <path {...anim("sc-flap", 0.28 + k * 0.04)} d="M0 0 C-4 -5 -9 -6 -13 -3 C-14 -7 -19 -8 -23 -5 C-19 -2 -18 3 -15 6 C-11 3 -6 4 -3 7 L0 4 L3 7 C6 4 11 3 15 6 C18 3 19 -2 23 -5 C19 -8 14 -7 13 -3 C9 -6 4 -5 0 0 Z" fill="#0c0612" />
          <ellipse cx="0" cy="2" rx="3" ry="4.2" fill="#140a1c" />
          <path d="M-2 -1.5 L-2.6 -4.5 L-0.8 -2.2 M2 -1.5 L2.6 -4.5 L0.8 -2.2" stroke="#140a1c" strokeWidth="1.2" />
        </g>
      </g>
    </g>
  );
  return (
    <>
      <Sky id={id} top={sky1} bottom={sky2} horizon={mix(sky2, glow, 0.35)} />
      <defs>
        <RG id={`${id}pk`} cx={0.38} cy={0.32} r={0.7} s={[[0, lt(body, 0.32)], [0.55, body], [1, dk(shade, 0.25)]]} />
        <RG id={`${id}pkS`} cx={0.5} cy={0.35} r={0.7} s={[[0, body], [1, dk(shade, 0.45)]]} />
        <LG id={`${id}stem`} x2={1} y2={0} s={[[0, "#2f4a1c"], [0.5, "#6c8f3a"], [1, "#2f4a1c"]]} />
        <RG id={`${id}carve`} s={[[0, lt(glow, 0.75)], [0.6, glow], [1, mix(glow, body, 0.55)]]} />
        <RG id={`${id}inner`} s={[[0, glow, 0.25], [1, glow, 0]]} />
        <RG id={`${id}pool`} s={[[0, glow, 0.45], [0.5, body, 0.18], [1, body, 0]]} />
        <RG id={`${id}cs`} s={[[0, "#000", 0.6], [1, "#000", 0]]} />
        <LG id={`${id}bark`} x2={1} y2={0} s={[[0, dk(far, 0.55)], [0.6, dk(far, 0.3)], [1, dk(far, 0.6)]]} />
      </defs>
      <Stars n={60} top={120} seed={2} color={lt(moon, 0.3)} />
      <Orb id={id} x={640} y={92} r={30} color={moon} moon />
      <g {...anim("sc-drift", 22)}>
        <ellipse cx="610" cy="104" rx="90" ry="5" fill={dk(sky1, 0.2)} opacity="0.55" />
        <ellipse cx="700" cy="84" rx="60" ry="3.5" fill={dk(sky1, 0.2)} opacity="0.45" />
      </g>
      {bat(380, 80, 1, 1)}
      {bat(470, 68, 0.7, 2)}
      {bat(560, 112, 0.85, 3)}
      {bat(300, 96, 0.6, 4)}
      <Hill id={id} k="h1" y={142} amp={14} seed={1.2} waves={2} color={far} rim={moon} rimOpacity={0.3} />
      {/* A crooked old tree with a sleepy owl */}
      <g>
        <path d="M230 150 C228 120 236 100 226 76 C222 66 214 60 206 58 M228 100 C240 90 254 88 266 76 M226 82 C214 76 206 66 204 52 M246 92 C252 80 250 70 258 62 M214 70 C202 68 196 60 188 60" fill="none" stroke={url(`${id}bark`)} strokeWidth="5" strokeLinecap="round" />
        <path d="M222 152 C226 130 224 112 230 96 L236 98 C232 116 236 132 240 152 Z" fill={dk(far, 0.45)} />
        <g transform="translate(246 86)">
          <ellipse cx="0" cy="0" rx="7" ry="9" fill={dk(far, 0.2)} />
          <g {...anim("sc-blinkeye", 5, -1)}>
            <circle cx="-2.6" cy="-2" r="2.2" fill="#ffd75e" />
            <circle cx="2.6" cy="-2" r="2.2" fill="#ffd75e" />
            <circle cx="-2.6" cy="-2" r="0.9" fill="#000" />
            <circle cx="2.6" cy="-2" r="0.9" fill="#000" />
          </g>
          <path d="M-5 -8 L-6 -12 L-3 -9 M5 -8 L6 -12 L3 -9" fill={dk(far, 0.2)} stroke={dk(far, 0.2)} strokeWidth="1.5" />
        </g>
      </g>
      {/* Wonky fence */}
      <g fill={dk(far, 0.15)}>
        {Array.from({ length: 9 }, (_, i) => {
          const x = 640 + i * 24;
          const y = hillY(x, 160, 8, 2.4, 2.2) - 4;
          return <path key={i} d={`M${x} ${y} l3 -22 l3 -3 l3 3 l-1 22 Z`} transform={`rotate(${(R(i, 9) - 0.5) * 10} ${x} ${y})`} />;
        })}
        <rect x="634" y={hillY(700, 160, 8, 2.4, 2.2) - 18} width="220" height="3" rx="1.5" transform="rotate(-1.5 740 140)" />
      </g>
      <Hill id={id} k="h2" y={168} amp={8} seed={2.4} waves={2.2} color={near} rim={mix(near, glow, 0.6)} rimOpacity={0.35} />
      <Mist id={id} k="m1" y={148} h={36} color={lt(sky2, 0.3)} opacity={0.22} dur={20} />
      <path d="M120 206 C180 188 240 210 300 196 S420 186 470 200 S600 190 660 204 S800 194 880 206" fill="none" stroke="#2c4a1a" strokeWidth="2.4" opacity="0.8" />
      {pumpkin(300, 192, 0.62, false, 0)}
      {pumpkin(372, 182, 1.12, true, 1)}
      {pumpkin(470, 192, 0.74, true, 2)}
      {pumpkin(580, 180, 1.38, true, 3)}
      {pumpkin(686, 194, 0.8, false, 4)}
      {pumpkin(752, 186, 0.98, true, 5)}
      {pumpkin(180, 192, 0.85, true, 6)}
      {pumpkin(860, 190, 0.9, true, 7)}
      {Array.from({ length: 16 }, (_, i) => (
        <circle key={i} cx={300 + R(i, 51) * 480} cy={200} r={0.8 + R(i, 52) * 1.4} fill={glow} {...anim("sc-ember", 4 + R(i, 53) * 4, -R(i, 54) * 6)} />
      ))}
      <Mist id={id} k="m2" y={186} h={34} color={lt(sky2, 0.4)} opacity={0.16} dur={26} />
      <Vignette id={id} strength={0.45} />
    </>
  );
}

// ============ Mountains ============
type Peak = { x: number; y: number };
function ridge(seed: number, base: number, minH: number, maxH: number, n: number) {
  const pts: Peak[] = [];
  const step = (W + 120) / n;
  for (let i = 0; i <= n; i++) {
    const x = -60 + i * step + (R(i, seed) - 0.5) * step * 0.4;
    const peak = i % 2 === 1;
    const h = peak ? minH + R(i, seed + 1) * (maxH - minH) : minH * 0.25 + R(i, seed + 2) * minH * 0.35;
    pts.push({ x, y: base - h });
  }
  return pts;
}

function MountainLayer({ pts, color, light, shadow, snow, snowShade, snowLine = 0.28 }: { pts: Peak[]; color: string; light: string; shadow: string; snow?: string; snowShade?: string; snowLine?: number }) {
  const d = `M${pts[0].x} ${H} ` + pts.map((p) => `L${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ") + ` L${pts[pts.length - 1].x} ${H} Z`;
  const faces: ReactNode[] = [];
  for (let i = 1; i < pts.length - 1; i += 2) {
    const pk = pts[i];
    const l = pts[i - 1];
    const r = pts[i + 1];
    const depth = H - pk.y;
    // Shadow face: right of a jagged line running down from the peak
    const j1 = { x: pk.x + 5, y: pk.y + depth * 0.3 };
    const j2 = { x: pk.x - 4, y: pk.y + depth * 0.6 };
    faces.push(<path key={`s${i}`} d={`M${pk.x} ${pk.y} L${r.x} ${r.y} L${r.x} ${H} L${j2.x + 8} ${H} L${j2.x} ${j2.y} L${j1.x} ${j1.y} Z`} fill={shadow} />);
    // Lit face catches a soft highlight
    faces.push(<path key={`l${i}`} d={`M${pk.x} ${pk.y} L${(pk.x + l.x) / 2} ${(pk.y + l.y) / 2} L${pk.x - 6} ${pk.y + depth * 0.45} Z`} fill={light} opacity="0.5" />);
    if (snow) {
      const t = snowLine;
      const a = { x: pk.x + (l.x - pk.x) * t, y: pk.y + (l.y - pk.y) * t };
      const b = { x: pk.x + (r.x - pk.x) * t, y: pk.y + (r.y - pk.y) * t };
      const my = Math.max(a.y, b.y);
      const cap = `M${pk.x} ${pk.y} L${b.x} ${b.y} L${b.x - (b.x - pk.x) * 0.3} ${my + 4} L${pk.x + 3} ${my - 2} L${pk.x - 4} ${my + 6} L${a.x + (pk.x - a.x) * 0.35} ${my - 1} L${a.x} ${a.y} Z`;
      faces.push(<path key={`c${i}`} d={cap} fill={snowShade} />);
      faces.push(<path key={`cl${i}`} d={`M${pk.x} ${pk.y} L${j1.x - 1} ${Math.min(j1.y, my)} L${pk.x - 4} ${my + 6} L${a.x + (pk.x - a.x) * 0.35} ${my - 1} L${a.x} ${a.y} Z`} fill={snow} />);
    }
  }
  return (
    <g>
      <path d={d} fill={color} />
      {faces}
    </g>
  );
}

export function Mountains({ p, id, stars, snow }: Opts) {
  const [sky1, sky2, orb, farC, midC, nearC, snowC] = p;
  const night = Boolean(stars);
  const far = ridge(3, 150, 60, 105, 14);
  const mid = ridge(7, 176, 45, 80, 12);
  const nearR = ridge(11, 206, 30, 55, 16);
  const haze = lt(sky2, 0.15);
  return (
    <>
      <Sky id={id} top={sky1} bottom={sky2} horizon={mix(sky2, orb, 0.4)} />
      {night ? <Stars n={70} top={120} seed={5} /> : null}
      <Orb id={id} x={620} y={90} r={24} color={orb} moon={night} rays={!night} />
      <CloudDefs id={id} color={mix(lt(sky2, 0.4), orb, 0.15)} shade={mix(sky2, sky1, 0.35)} />
      <g {...anim("sc-drift", 30)}>
        <Cloud id={id} x={360} y={80} s={0.7} seed={1} opacity={night ? 0.25 : 0.7} />
        <Cloud id={id} x={820} y={74} s={0.55} seed={4} opacity={night ? 0.2 : 0.6} />
      </g>
      <MountainLayer pts={far} color={mix(farC, haze, 0.25)} light={lt(farC, 0.35)} shadow={dk(mix(farC, sky1, 0.2), 0.18)} snow={snow ? snowC : undefined} snowShade={mix(snowC, sky1, 0.35)} />
      <Mist id={id} k="m1" y={118} h={50} color={haze} opacity={0.45} dur={24} />
      <MountainLayer pts={mid} color={midC} light={lt(midC, 0.3)} shadow={dk(midC, 0.22)} snow={snow ? snowC : undefined} snowShade={mix(snowC, sky1, 0.45)} snowLine={0.2} />
      <Mist id={id} k="m2" y={150} h={44} color={haze} opacity={0.35} dur={18} />
      <MountainLayer pts={nearR} color={nearC} light={lt(nearC, 0.18)} shadow={dk(nearC, 0.25)} />
      {Array.from({ length: 22 }, (_, i) => {
        const x = 10 + i * 46 + R(i, 61) * 20;
        const h = 18 + R(i, 62) * 16;
        return <Pine key={i} x={x} base={218} h={h} color={dk(nearC, 0.35)} light={dk(nearC, 0.15)} snow={snow ? mix(snowC, nearC, 0.2) : undefined} />;
      })}
      {[0, 1, 2, 3].map((i) => (
        <Bird key={i} x={300 + i * 26} y={92 + (i % 2) * 10} s={1} color={dk(midC, 0.3)} k={i} />
      ))}
      <Vignette id={id} strength={0.3} />
    </>
  );
}

// ============ Ocean ============
export function Ocean({ p, id, stars }: Opts) {
  const [sky1, sky2, sun, s1, s2, s3, foam] = p;
  const night = Boolean(stars);
  const hz = 128;
  const layer = (k: number, y: number, amp: number, period: number, color: string, dur: number, foamOp: number) => (
    <g key={k}>
      <defs>
        <LG id={`${id}w${k}`} s={[[0, lt(color, 0.12)], [0.35, color], [1, dk(color, 0.25)]]} />
      </defs>
      <g {...anim("sc-slide", dur, 0, { "--dx": `-${period}px` })}>
        <path d={wavePath(y, amp, period)} fill={url(`${id}w${k}`)} />
        <path d={waveEdge(y, amp, period)} fill="none" stroke={foam} strokeWidth={1 + k * 0.5} opacity={foamOp} strokeLinecap="round" />
      </g>
    </g>
  );
  return (
    <>
      <Sky id={id} top={sky1} bottom={sky2} horizon={mix(sky2, sun, 0.5)} glowY={0.6} />
      {night ? <Stars n={60} top={110} seed={8} /> : null}
      <Orb id={id} x={560} y={night ? 86 : 112} r={night ? 22 : 34} color={sun} moon={night} />
      <g {...anim("sc-drift", 26)}>
        {[0, 1, 2, 3].map((i) => (
          <ellipse key={i} cx={300 + i * 170} cy={night ? 96 + i * 6 : 84 + i * 9} rx={110 - i * 14} ry={4 + (i % 2) * 2} fill={mix(sky1, sun, night ? 0.15 : 0.45)} opacity={0.55} />
        ))}
      </g>
      {/* A little island with swaying palms */}
      <g>
        <path d={`M200 ${hz + 1} Q240 ${hz - 16} 290 ${hz - 12} Q330 ${hz - 10} 360 ${hz + 1} Z`} fill={dk(s1, 0.45)} />
        {[[262, 0], [300, 1]].map(([x, k]) => (
          <g key={k} {...anim("sc-sway", 4 + k, -k)}>
            <path d={`M${x} ${hz - 12} Q${x + 4} ${hz - 30} ${x + 12} ${hz - 46}`} fill="none" stroke={dk(s1, 0.5)} strokeWidth="2.6" strokeLinecap="round" />
            {[-140, -100, -60, -20, 20].map((a) => (
              <path key={a} d={`M${x + 12} ${hz - 46} q8 -6 20 2`} fill="none" stroke={dk(s1, 0.5)} strokeWidth="2.2" strokeLinecap="round" transform={`rotate(${a + 60} ${x + 12} ${hz - 46})`} />
            ))}
          </g>
        ))}
      </g>
      <rect y={hz} width={W} height={H - hz} fill={dk(s1, 0.1)} />
      {/* Sun glitter on the water */}
      {Array.from({ length: 14 }, (_, i) => {
        const y = hz + 4 + i * 6;
        const w = 20 + i * 7 + R(i, 3) * 14;
        return <rect key={i} x={560 - w / 2 + (R(i, 4) - 0.5) * 16} y={y} width={w} height={1.6 + i * 0.12} rx="1" fill={lt(sun, 0.3)} opacity={0.75 - i * 0.04} {...anim("sc-shimmer", 1.4 + R(i) * 1.6, -R(i, 2) * 2)} />;
      })}
      {/* A little sailboat bobbing on the horizon */}
      <g transform={`translate(700 ${hz + 4})`}>
        <g {...anim("sc-rock", 3.4)}>
          <path d="M-14 0 L14 0 L10 6 L-10 6 Z" fill={dk(s3, 0.4)} />
          <path d="M0 -30 L0 0 L13 -2 Z" fill={lt(foam, 0.2)} />
          <path d="M0 -30 L0 0 L13 -2 Z" fill={url(`${id}sail`)} />
          <path d="M-1 -24 L-1 -2 L-12 -3 Z" fill={mix(foam, sky2, 0.3)} />
          <line x1="0" y1="-32" x2="0" y2="2" stroke={dk(s3, 0.4)} strokeWidth="1.2" />
        </g>
      </g>
      <defs>
        <LG id={`${id}sail`} x2={1} y2={0} s={[[0, "#000", 0.25], [1, "#000", 0]]} />
      </defs>
      {layer(0, hz + 10, 2.5, 60, s1, 9, 0.25)}
      {layer(1, hz + 30, 4, 90, s2, 7, 0.35)}
      {layer(2, hz + 56, 6.5, 130, s3, 6, 0.5)}
      {layer(3, hz + 80, 9, 180, dk(s3, 0.15), 5, 0.6)}
      {Array.from({ length: 12 }, (_, i) => {
        const x = 260 + R(i, 71) * 480;
        const y = hz + 14 + R(i, 72) * 70;
        return <path key={i} d={`M${x} ${y - 4} L${x + 0.8} ${y - 0.8} L${x + 4} ${y} L${x + 0.8} ${y + 0.8} L${x} ${y + 4} L${x - 0.8} ${y + 0.8} L${x - 4} ${y} L${x - 0.8} ${y - 0.8} Z`} fill="#fff" {...anim("sc-tw", 1.5 + R(i, 73) * 2, -R(i, 74) * 3)} />;
      })}
      {night
        ? null
        : [0, 1].map((i) => (
            <Bird key={i} x={380 + i * 40} y={80 + i * 12} s={1.2} color={dk(s3, 0.3)} k={i} />
          ))}
      <Vignette id={id} strength={0.3} />
    </>
  );
}

// ============ Forest ============
export function Forest({ p, id, stars, alt }: Opts) {
  const [sky1, sky2, orb, t1, t2, t3, fog, fly] = p;
  const dark = lum(sky1) < 0.3;
  const tones = [t1, t2, mix(t1, fly, 0.45), dk(t2, 0.12), mix(t1, "#d62828", 0.35)];
  const layer = (n: number, base: number, hMin: number, hMax: number, color: string, seed: number, frame = false) =>
    Array.from({ length: n }, (_, i) => {
      let x = (i / (n - 1)) * (W + 40) - 20 + (R(i, seed) - 0.5) * 30;
      // Big foreground trees frame the scene instead of covering the middle
      if (frame && x > 250 && x < 750) x = x < 500 ? 250 - R(i, seed + 5) * 60 : 750 + R(i, seed + 5) * 60;
      const h = hMin + R(i, seed + 1) * (hMax - hMin);
      if (alt) {
        const tone = mix(tones[Math.floor(R(i, seed + 7) * tones.length)], color, seed === 1 ? 0.55 : seed === 4 ? 0.2 : 0.35);
        const k = `${id}leaf${seed}-${i}`;
        return (
          <g key={i}>
            <defs>
              <RG id={k} cx={0.35} cy={0.3} r={0.75} s={[[0, lt(tone, 0.35)], [0.55, tone], [1, dk(tone, 0.4)]]} />
            </defs>
            <TreeAlt id={id} x={x} base={base} h={h} seed={seed + i} leaf={k} />
          </g>
        );
      }
      return (
        <Pine key={i} x={x} base={base} h={h} color={dk(color, 0.12)} light={lt(color, 0.12)} />
      );
    });
  const mush = (x: number, y: number, s: number, k: number) => (
    <g key={k} transform={`translate(${x} ${y}) scale(${s})`}>
      {dark ? <circle cx="0" cy="-8" r="16" fill={url(`${id}mg`)} {...anim("sc-breathe", 3 + k, -k)} /> : null}
      <path d="M-2.5 0 Q-3 -6 -2 -9 L2 -9 Q3 -6 2.5 0 Z" fill={lt(fog, 0.4)} />
      <path d="M-9 -8 Q-8 -17 0 -18 Q8 -17 9 -8 Q0 -10 -9 -8 Z" fill={url(`${id}cap`)} />
      <circle cx="-3.5" cy="-13" r="1.4" fill="#fff" opacity="0.85" />
      <circle cx="3" cy="-14.5" r="1" fill="#fff" opacity="0.85" />
      <circle cx="4.5" cy="-10.5" r="0.9" fill="#fff" opacity="0.85" />
    </g>
  );
  return (
    <>
      <Sky id={id} top={sky1} bottom={sky2} horizon={mix(sky2, orb, 0.3)} />
      <defs>
        <LG id={`${id}trunk`} x2={1} y2={0} s={[[0, dk(t3, 0.55)], [0.4, dk(mix(t3, "#6b4423", 0.6), 0.1)], [1, dk(t3, 0.65)]]} />
        <LG id={`${id}ray`} s={[[0, orb, 0.32], [1, orb, 0]]} />
        <RG id={`${id}mg`} s={[[0, fly, 0.45], [1, fly, 0]]} />
        <LG id={`${id}cap`} s={[[0, lt(fly, 0.2)], [1, dk(mix(fly, "#e5484d", alt ? 0.7 : 0.2), 0.15)]]} />
        <RG id={`${id}ff`} s={[[0, "#fff", 1], [0.25, fly, 0.9], [1, fly, 0]]} />
        <LG id={`${id}gnd`} s={[[0, dk(t3, 0.2)], [1, dk(t3, 0.6)]]} />
      </defs>
      {stars ? <Stars n={45} top={90} seed={11} /> : null}
      <Orb id={id} x={610} y={86} r={22} color={orb} moon={dark} />
      <g {...anim("sc-ray", 7)}>
        {[-40, -20, 0, 18, 36].map((a, i) => (
          <path key={i} d={`M610 86 L${560 + i * 30 + a * 3} 230 L${600 + i * 30 + a * 3} 230 Z`} fill={url(`${id}ray`)} opacity={0.55} />
        ))}
      </g>
      {alt ? layer(26, 156, 34, 52, mix(t1, fog, 0.45), 1) : layer(20, 150, 50, 82, mix(t1, fog, 0.35), 1)}
      <Mist id={id} k="m1" y={110} h={56} color={fog} opacity={0.3} dur={18} />
      {alt ? layer(16, 186, 50, 74, t2, 4) : layer(15, 184, 70, 108, t2, 4)}
      <Mist id={id} k="m2" y={146} h={50} color={fog} opacity={0.24} dur={22} />
      <rect y="196" width={W} height="24" fill={url(`${id}gnd`)} />
      {alt ? layer(8, 228, 110, 150, t3, 9, true) : layer(10, 226, 104, 150, t3, 9)}
      {mush(300, 212, 1.1, 1)}
      {mush(318, 214, 0.75, 2)}
      {mush(690, 210, 1.25, 3)}
      {mush(708, 213, 0.8, 4)}
      {mush(560, 215, 0.7, 5)}
      {alt
        ? Array.from({ length: 16 }, (_, i) => (
            <g key={i} transform={`translate(${R(i, 21) * W} -12)`}>
              <g {...anim("sc-leaffall", 8 + R(i, 22) * 6, -R(i, 23) * 12)}>
                <path d="M0 -6 C5 -3 5 3 0 6 C-5 3 -5 -3 0 -6 Z" fill={[t1, fly, t2][i % 3]} />
                <path d="M0 -6 L0 6" stroke={dk(t2, 0.3)} strokeWidth="0.6" />
              </g>
            </g>
          ))
        : Array.from({ length: 22 }, (_, i) => (
            <circle key={i} cx={R(i, 31) * W} cy={90 + R(i, 32) * 120} r="5" fill={url(`${id}ff`)} {...anim("sc-firefly", 4 + R(i, 33) * 4, -R(i, 34) * 6)} />
          ))}
      <Vignette id={id} strength={0.4} />
    </>
  );
}

function TreeAlt({ id, x, base, h, seed, leaf }: { id: string; x: number; base: number; h: number; seed: number; leaf: string }) {
  const r = h * 0.28;
  const blobs: [number, number, number][] = [
    [0, -h * 0.7, r],
    [-r * 0.85, -h * 0.54, r * 0.82],
    [r * 0.9, -h * 0.52, r * 0.86],
    [-r * 0.15, -h * 0.44, r * 0.88],
    [r * 0.35, -h * 0.84, r * 0.66],
  ];
  return (
    <g>
      <path d={`M${x - h * 0.04} ${base} L${x - h * 0.02} ${base - h * 0.48} L${x + h * 0.02} ${base - h * 0.48} L${x + h * 0.045} ${base} Z`} fill={url(`${id}trunk`)} />
      {blobs.map(([bx, by, br], i) => (
        <circle key={i} cx={x + bx + (R(i, seed) - 0.5) * r * 0.25} cy={base + by} r={br} fill={url(leaf)} />
      ))}
    </g>
  );
}

// ============ City ============
export function City({ p, id, alt }: Opts) {
  const [sky1, sky2, moon, bFar, bNear, win, neon] = p;
  const light = lum(sky1) > 0.45;
  const buildings = Array.from({ length: 17 }, (_, i) => {
    const w = 46 + R(i, 51) * 22;
    const x = -20 + i * 62 + (R(i, 53) - 0.5) * 10;
    const h = 64 + R(i, 52) * 74 + (i > 5 && i < 11 ? 16 : 0);
    return { x, w, h, top: 196 - h, i };
  });
  return (
    <>
      <Sky id={id} top={sky1} bottom={sky2} horizon={mix(sky2, win, 0.35)} />
      <defs>
        <LG id={`${id}bf`} s={[[0, lt(bNear, 0.1)], [1, dk(bNear, 0.25)]]} />
        <LG id={`${id}bs`} s={[[0, dk(bNear, 0.3)], [1, dk(bNear, 0.55)]]} />
        <LG id={`${id}far`} s={[[0, mix(bFar, sky2, 0.25)], [1, bFar]]} />
        <LG id={`${id}road`} s={[[0, dk(bNear, 0.35)], [1, dk(bNear, 0.6)]]} />
        <RG id={`${id}wg`} s={[[0, win, 0.5], [1, win, 0]]} />
        <filter id={`${id}glow`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.4" />
        </filter>
      </defs>
      {light ? null : <Stars n={40} top={80} seed={13} />}
      <Orb id={id} x={330} y={84} r={20} color={moon} moon={!light} />
      {/* Far skyline */}
      {Array.from({ length: 30 }, (_, i) => {
        const h = 50 + R(i, 41) * 64;
        const x = i * 35 - 10;
        return (
          <g key={i}>
            <rect x={x} y={196 - h} width="32" height={h} fill={url(`${id}far`)} />
            {R(i, 42) > 0.7 ? <rect x={x + 15} y={196 - h - 12} width="2" height="12" fill={bFar} /> : null}
            {Array.from({ length: 6 }, (_, k) => (R(i * 7 + k, 43) > 0.6 ? <rect key={k} x={x + 5 + (k % 3) * 8} y={196 - h + 8 + Math.floor(k / 3) * 12} width="4" height="3" fill={win} opacity="0.35" /> : null))}
          </g>
        );
      })}
      <rect y="120" width={W} height="80" fill={url(`${id}wg`)} opacity="0.25" />
      {/* Near buildings with a lit face, shaded side and rooftop clutter */}
      {buildings.map(({ x, w, h, top, i }) => {
        const side = w * 0.18;
        const rows = Math.floor((h - 18) / 12);
        const cols = Math.max(3, Math.floor(w / 15));
        return (
          <g key={i}>
            <path d={`M${x + w} ${top} L${x + w + side} ${top + 6} L${x + w + side} 200 L${x + w} 200 Z`} fill={url(`${id}bs`)} />
            <rect x={x} y={top} width={w} height={200 - top} fill={url(`${id}bf`)} />
            <rect x={x - 2} y={top - 3} width={w + 4} height="4" fill={lt(bNear, 0.15)} />
            {i % 5 === 2 ? (
              <g>
                <rect x={x + w * 0.2} y={top - 22} width="16" height="13" rx="2" fill={dk(bNear, 0.15)} />
                <path d={`M${x + w * 0.2 - 2} ${top - 22} L${x + w * 0.2 + 8} ${top - 30} L${x + w * 0.2 + 18} ${top - 22} Z`} fill={dk(bNear, 0.25)} />
                <path d={`M${x + w * 0.2 + 2} ${top - 9} L${x + w * 0.2} ${top} M${x + w * 0.2 + 14} ${top - 9} L${x + w * 0.2 + 16} ${top}`} stroke={dk(bNear, 0.25)} strokeWidth="1.5" />
              </g>
            ) : null}
            {i % 4 === 1 ? (
              <g>
                <rect x={x + w / 2 - 1} y={top - 26} width="2" height="26" fill={dk(bNear, 0.1)} />
                <circle cx={x + w / 2} cy={top - 27} r="2.4" fill="#ff3b3b" {...anim("sc-blink", 1.6 + (i % 3) * 0.4)} />
              </g>
            ) : null}
            {Array.from({ length: rows * cols }, (_, k) => {
              const lit = R(i * 41 + k, 61) > 0.45;
              const c = k % cols;
              const r = Math.floor(k / cols);
              const ww = (w - 10) / cols - 3;
              const wx = x + 6 + c * ((w - 10) / cols);
              const wy = top + 10 + r * 12;
              if (!lit) return <rect key={k} x={wx} y={wy} width={ww} height="6" fill={dk(bNear, 0.35)} />;
              const tint = R(k, i) > 0.8 ? mix(win, neon, 0.5) : win;
              return <rect key={k} x={wx} y={wy} width={ww} height="6" fill={tint} opacity={0.75 + R(k, i + 3) * 0.25} {...(R(k, i + 9) > 0.9 ? anim("sc-tw", 3 + R(k, 9) * 3, -R(k, 8) * 3) : {})} />;
            })}
          </g>
        );
      })}
      {/* A neon heart sign */}
      <g transform="translate(520 92)" {...anim("sc-neon", 4.5)}>
        <rect x="-26" y="-18" width="52" height="34" rx="6" fill={dk(bNear, 0.5)} stroke={dk(bNear, 0.2)} />
        <path d="M0 10 C-3 7 -13 2 -13 -5 A6 6 0 0 1 0 -8 A6 6 0 0 1 13 -5 C13 2 3 7 0 10 Z" fill="none" stroke={neon} strokeWidth="4" filter={url(`${id}glow`)} />
        <path d="M0 10 C-3 7 -13 2 -13 -5 A6 6 0 0 1 0 -8 A6 6 0 0 1 13 -5 C13 2 3 7 0 10 Z" fill="none" stroke={lt(neon, 0.6)} strokeWidth="1.6" />
      </g>
      {/* Wet street with reflections and passing cars */}
      <rect y="196" width={W} height="24" fill={url(`${id}road`)} />
      {buildings.map(({ x, w, i }) => (
        <rect key={i} x={x + w * 0.2} y="198" width={w * 0.6} height="20" fill={win} opacity={0.06 + R(i, 77) * 0.08} />
      ))}
      <rect x="490" y="198" width="60" height="22" fill={neon} opacity="0.14" filter={url(`${id}glow`)} />
      {[0, 1, 2].map((i) => (
        <g key={i} {...anim(i % 2 ? "sc-drive-r" : "sc-drive", 6 + i * 2, -i * 2.5)}>
          <g transform={`translate(0 ${204 + i * 5})`}>
            <rect x="0" y="-3" width="22" height="6" rx="3" fill={dk(bNear, 0.6)} />
            <circle cx={i % 2 ? 1 : 21} cy="0" r="2" fill={i % 2 ? "#ff4a4a" : "#fff6c9"} />
            <rect x={i % 2 ? -14 : 22} y="-1" width="14" height="2" fill={i % 2 ? "#ff4a4a" : "#fff6c9"} opacity="0.35" />
          </g>
        </g>
      ))}
      {alt
        ? Array.from({ length: 70 }, (_, i) => (
            <line key={i} x1={R(i, 81) * W} y1={-20} x2={R(i, 81) * W - 4} y2={-6} stroke={lt(sky2, 0.5)} strokeWidth="1" opacity="0.55" {...anim("sc-rain", 0.7 + R(i, 82) * 0.5, -R(i, 83) * 2)} />
          ))
        : null}
      <Vignette id={id} strength={0.4} />
    </>
  );
}

// ============ Space ============
export function Space({ p, id }: Opts) {
  const [bg1, bg2, n1, n2, pl1, pl2, ring] = p;
  const px = 640;
  const py = 128;
  const pr = 58;
  const bands = Array.from({ length: 14 }, (_, i) => mix(pl1, pl2, R(i, 5) * 0.9));
  return (
    <>
      <defs>
        <RG id={`${id}bg`} cx={0.35} cy={0.4} r={0.9} s={[[0, bg2], [1, bg1]]} />
        <RG id={`${id}n1`} s={[[0, n1, 0.55], [0.5, n1, 0.18], [1, n1, 0]]} />
        <RG id={`${id}n2`} s={[[0, n2, 0.5], [0.5, n2, 0.15], [1, n2, 0]]} />
        <RG id={`${id}dust`} s={[[0, bg1, 0.7], [1, bg1, 0]]} />
        <RG id={`${id}term`} cx={0.3} cy={0.3} r={0.85} s={[[0.35, "#000", 0], [0.8, "#000", 0.55], [1, "#000", 0.8]]} />
        <RG id={`${id}atm`} s={[[0.8, n1, 0], [0.9, lt(n1, 0.3), 0.55], [1, n1, 0]]} />
        <LG id={`${id}ring`} x2={1} y2={0} s={[[0, ring, 0.15], [0.3, ring, 0.9], [0.5, lt(ring, 0.4), 1], [0.7, ring, 0.8], [1, ring, 0.15]]} />
        <clipPath id={`${id}pc`}>
          <circle cx={px} cy={py} r={pr} />
        </clipPath>
        <RG id={`${id}moon`} cx={0.35} cy={0.35} r={0.7} s={[[0, lt(pl1, 0.5)], [0.6, mix(pl1, "#999999", 0.4)], [1, dk(pl2, 0.5)]]} />
        <LG id={`${id}tail`} x2={1} y2={0} s={[[0, "#fff", 0], [1, "#fff", 0.9]]} />
      </defs>
      <rect width={W} height={H} fill={url(`${id}bg`)} />
      <g {...anim("sc-drift", 40)}>
        <ellipse cx="330" cy="90" rx="260" ry="90" fill={url(`${id}n1`)} />
        <ellipse cx="460" cy="150" rx="190" ry="70" fill={url(`${id}n2`)} />
        <ellipse cx="200" cy="60" rx="150" ry="60" fill={url(`${id}n2`)} />
        <ellipse cx="880" cy="60" rx="180" ry="70" fill={url(`${id}n1`)} opacity="0.6" />
        <ellipse cx="350" cy="110" rx="160" ry="16" fill={url(`${id}dust`)} transform="rotate(-12 350 110)" />
      </g>
      <Stars n={120} top={H} seed={17} />
      <Stars n={14} top={H} seed={18} color={lt(n1, 0.5)} />
      {/* Ringed planet: back half of the ring, banded body, terminator shadow, front half */}
      <g transform={`rotate(-14 ${px} ${py})`}>
        <ellipse cx={px} cy={py} rx={pr * 1.9} ry={pr * 0.42} fill="none" stroke={url(`${id}ring`)} strokeWidth="9" opacity="0.6" />
      </g>
      <circle cx={px} cy={py} r={pr + 10} fill={url(`${id}atm`)} />
      <g clipPath={`url(#${id}pc)`}>
        <rect x={px - pr} y={py - pr} width={pr * 2} height={pr * 2} fill={pl1} />
        <g {...anim("sc-slide", 40, 0, { "--dx": "-160px" })}>
          {bands.map((c, i) => (
            <path key={i} d={`M${px - pr - 10} ${py - pr + i * 9.5} q40 -4 80 0 t80 0 t80 0 t80 0 t80 0 v${4 + R(i, 6) * 6} q-40 4 -80 0 t-80 0 t-80 0 t-80 0 t-80 0 Z`} fill={c} opacity="0.85" />
          ))}
          <ellipse cx={px + 30} cy={py + 18} rx="14" ry="7" fill={dk(pl2, 0.15)} opacity="0.8" />
          <ellipse cx={px + 190} cy={py + 18} rx="14" ry="7" fill={dk(pl2, 0.15)} opacity="0.8" />
        </g>
        <circle cx={px} cy={py} r={pr} fill={url(`${id}term`)} />
        <ellipse cx={px} cy={py + 22} rx={pr * 1.5} ry="6" fill="#000" opacity="0.3" transform={`rotate(-14 ${px} ${py})`} />
      </g>
      <g transform={`rotate(-14 ${px} ${py})`}>
        <path d={`M${px - pr * 1.9} ${py} A${pr * 1.9} ${pr * 0.42} 0 0 0 ${px + pr * 1.9} ${py}`} fill="none" stroke={url(`${id}ring`)} strokeWidth="9" />
        <path d={`M${px - pr * 1.72} ${py + 2} A${pr * 1.72} ${pr * 0.36} 0 0 0 ${px + pr * 1.72} ${py + 2}`} fill="none" stroke={dk(ring, 0.4)} strokeWidth="1.2" opacity="0.6" />
      </g>
      {/* Little moon */}
      <g {...anim("sc-bob", 7)}>
        <circle cx="420" cy="80" r="13" fill={url(`${id}moon`)} />
        <circle cx="416" cy="76" r="2.6" fill="#000" opacity="0.18" />
        <circle cx="425" cy="84" r="1.8" fill="#000" opacity="0.18" />
      </g>
      {/* A tiny UFO wandering past */}
      <g {...anim("sc-ufo", 26, -6)}>
        <g transform="translate(0 68)">
          <ellipse cx="0" cy="0" rx="14" ry="4" fill={mix("#c9d1e0", n1, 0.2)} />
          <ellipse cx="0" cy="-3" rx="6" ry="5" fill={lt(n2, 0.6)} opacity="0.85" />
          <ellipse cx="0" cy="1.5" rx="14" ry="1.6" fill="#000" opacity="0.25" />
          {[-9, -3, 3, 9].map((x, i) => (
            <circle key={x} cx={x} cy="0.5" r="1.1" fill={i % 2 ? "#ffe066" : "#7df9ff"} {...anim("sc-blink", 0.8, -i * 0.2)} />
          ))}
        </g>
      </g>
      {[0, 1].map((i) => (
        <g key={i} {...anim("sc-shoot", 7 + i * 3, -2 - i * 4)}>
          <line x1="0" y1="0" x2="70" y2="22" stroke={url(`${id}tail`)} strokeWidth="2" strokeLinecap="round" />
          <circle cx="70" cy="22" r="1.6" fill="#fff" />
        </g>
      ))}
      <Vignette id={id} strength={0.45} />
    </>
  );
}

// ============ Aurora ============
export function Aurora({ p, id }: Opts) {
  const [sky1, sky2, a1, a2, a3, snowC, tree] = p;
  const curtain = (c: string, y0: number, amp: number, k: number) => {
    const rays = 70;
    return (
      <g key={k} {...anim(k % 2 ? "sc-curtain-r" : "sc-curtain", 10 + k * 3)} style={{ animationDuration: `${10 + k * 3}s`, mixBlendMode: "screen" } as CSSProperties}>
        <defs>
          <LG id={`${id}ar${k}`} s={[[0, c, 0], [0.55, c, 0.5], [0.9, lt(c, 0.35), 0.85], [1, c, 0]]} />
        </defs>
        {Array.from({ length: rays }, (_, i) => {
          const x = -40 + (i / rays) * (W + 80);
          const y = y0 + Math.sin(i * 0.22 + k) * amp + Math.sin(i * 0.07 + k * 2) * amp * 0.8;
          const h = 50 + R(i, k + 30) * 40;
          return <rect key={i} x={x} y={y - h} width={W / rays + 3} height={h} fill={url(`${id}ar${k}`)} opacity={0.35 + R(i, k + 40) * 0.5} />;
        })}
      </g>
    );
  };
  return (
    <>
      <Sky id={id} top={sky1} bottom={sky2} horizon={mix(sky2, a1, 0.25)} />
      <defs>
        <LG id={`${id}snow`} s={[[0, snowC], [1, mix(snowC, sky2, 0.45)]]} />
        <LG id={`${id}lake`} s={[[0, mix(sky2, a1, 0.25)], [1, dk(sky2, 0.3)]]} />
        <RG id={`${id}spill`} s={[[0, "#ffc56b", 0.55], [1, "#ffc56b", 0]]} />
      </defs>
      <Stars n={80} top={140} seed={19} />
      {curtain(a1, 92, 14, 0)}
      {curtain(a2, 110, 18, 1)}
      {curtain(a3, 76, 10, 2)}
      <MountainLayer pts={ridge(23, 168, 26, 50, 14)} color={mix(sky2, snowC, 0.3)} light={lt(snowC, 0.2)} shadow={mix(sky2, sky1, 0.3)} snow={snowC} snowShade={mix(snowC, sky2, 0.5)} snowLine={0.35} />
      {/* Frozen lake catching the lights */}
      <rect x="0" y="168" width={W} height="20" fill={url(`${id}lake`)} />
      <g opacity="0.35" transform="translate(0 340) scale(1 -1)">
        <rect x="200" y="152" width="600" height="20" fill={a1} opacity="0.4" />
      </g>
      <path d={`M-20 186 Q200 172 420 182 T${W + 20} 178 V${H} H-20 Z`} fill={url(`${id}snow`)} />
      {Array.from({ length: 26 }, (_, i) => {
        const x = 10 + i * 40 + R(i, 71) * 18;
        if (x > 520 && x < 620) return null;
        return <Pine key={i} x={x} base={190 + Math.sin(i) * 4} h={34 + R(i, 72) * 26} color={tree} light={lt(tree, 0.12)} snow={snowC} />;
      })}
      {/* A cosy cabin */}
      <g transform="translate(570 188)">
        <ellipse cx="0" cy="6" rx="60" ry="10" fill={url(`${id}spill`)} />
        <rect x="-20" y="-22" width="40" height="22" fill={dk(mix(tree, "#6b4423", 0.6), 0.1)} />
        <path d="M-20 -22 L20 -22 L28 -6 L-12 -6 Z" fill={dk(mix(tree, "#6b4423", 0.6), 0.35)} opacity="0.5" />
        <path d="M-26 -20 L0 -40 L26 -20 Z" fill={snowC} />
        <path d="M-26 -20 L0 -40 L0 -36 L-22 -19 Z" fill={lt(snowC, 0.3)} />
        <rect x="-8" y="-16" width="10" height="9" fill="#ffc56b" {...anim("sc-flicker", 3)} />
        <rect x="8" y="-14" width="7" height="14" fill={dk(tree, 0.4)} />
        <rect x="10" y="-44" width="6" height="12" fill={dk(mix(tree, "#6b4423", 0.6), 0.2)} />
        {[0, 1, 2].map((s) => (
          <circle key={s} cx="13" cy="-46" r={3 + s} fill="#fff" opacity="0.3" {...anim("sc-smoke", 4.5, -s * 1.5)} />
        ))}
      </g>
      {Array.from({ length: 14 }, (_, i) => (
        <circle key={i} cx={R(i, 91) * W} cy={192 + R(i, 92) * 24} r="0.9" fill="#fff" {...anim("sc-tw", 1.2 + R(i, 93) * 2, -R(i, 94) * 2)} />
      ))}
      <Vignette id={id} strength={0.4} />
    </>
  );
}

// ============ Sakura ============
export function Sakura({ p, id }: Opts) {
  const [sky1, sky2, hill, branch, b1, b2, petal] = p;
  const night = lum(sky1) < 0.3;
  const flower = (x: number, y: number, r: number, c: string, k: number, rot = 0) => (
    <g key={k} transform={`translate(${x} ${y}) rotate(${rot}) scale(${r / 10})`}>
      {[0, 72, 144, 216, 288].map((a) => (
        <path key={a} d="M0 0 C-6 -3 -7 -10 -3 -13 L0 -11 L3 -13 C7 -10 6 -3 0 0 Z" fill={url(c === b1 ? `${id}pt1` : `${id}pt2`)} transform={`rotate(${a})`} />
      ))}
      <circle r="2.6" fill={mix(c, "#c2185b", 0.5)} opacity="0.6" />
      {[0, 60, 120, 180, 240, 300].map((a) => (
        <line key={a} x1="0" y1="0" x2="0" y2="-4.5" stroke="#ffd166" strokeWidth="0.6" transform={`rotate(${a})`} />
      ))}
      {[0, 60, 120, 180, 240, 300].map((a) => (
        <circle key={a} cx="0" cy="-4.7" r="0.8" fill="#ffcf4d" transform={`rotate(${a})`} />
      ))}
    </g>
  );
  const clusters: [number, number, number][] = [];
  // Along the upper-left branch and the upper-right branch
  for (let i = 0; i < 26; i++) {
    const t = i / 25;
    clusters.push([-10 + t * 380, 18 + t * 70 + (R(i, 3) - 0.5) * 30, 7 + R(i, 4) * 5]);
  }
  for (let i = 0; i < 18; i++) {
    const t = i / 17;
    clusters.push([W + 10 - t * 270, 10 + t * 56 + (R(i, 5) - 0.5) * 26, 6.5 + R(i, 6) * 5]);
  }
  return (
    <>
      <Sky id={id} top={sky1} bottom={sky2} horizon={lt(sky2, 0.3)} />
      <defs>
        <RG id={`${id}pt1`} cx={0.5} cy={1} r={1} s={[[0, lt(b1, 0.65)], [0.6, b1], [1, dk(b1, 0.08)]]} />
        <RG id={`${id}pt2`} cx={0.5} cy={1} r={1} s={[[0, lt(b2, 0.65)], [0.6, b2], [1, dk(b2, 0.08)]]} />
        <LG id={`${id}fuji`} s={[[0, lt(hill, 0.25)], [1, mix(hill, sky2, 0.4)]]} />
        <RG id={`${id}lan`} s={[[0, "#ffe7a3", 0.9], [0.4, "#ff9a5a", 0.4], [1, "#ff9a5a", 0]]} />
      </defs>
      {night ? <Stars n={50} top={110} seed={81} /> : null}
      <Orb id={id} x={600} y={92} r={34} color={night ? "#fff8e6" : lt(b1, 0.6)} moon={night} />
      {/* Distant snowy peak and a pagoda in the mist */}
      <path d="M380 150 L480 76 Q500 66 520 76 L640 150 Z" fill={url(`${id}fuji`)} opacity="0.85" />
      <path d="M480 76 Q500 66 520 76 L540 92 L528 88 L516 96 L504 86 L492 96 L480 88 L462 92 Z" fill={night ? "#e6e0ff" : "#ffffff"} opacity="0.9" />
      <Hill id={id} k="h1" y={150} amp={10} seed={0.8} waves={2} color={mix(hill, sky2, 0.35)} />
      <g fill={mix(dk(hill, 0.25), sky2, 0.3)} transform="translate(360 148)">
        {[0, 1, 2, 3].map((i) => (
          <g key={i} transform={`translate(0 ${-i * 12})`}>
            <rect x={-10 + i * 1.5} y="-10" width={20 - i * 3} height="10" />
            <path d={`M${-18 + i * 2} -9 Q0 -14 ${18 - i * 2} -9 L${14 - i * 2} -13 L${-14 + i * 2} -13 Z`} />
          </g>
        ))}
        <rect x="-1" y="-62" width="2" height="14" />
      </g>
      <Mist id={id} k="m1" y={130} h={40} color={lt(sky2, 0.5)} opacity={0.5} dur={22} />
      <Hill id={id} k="h2" y={176} amp={10} seed={2.2} waves={2.5} color={hill} rim={lt(hill, 0.4)} rimOpacity={0.5} />
      <Hill id={id} k="h3" y={202} amp={6} seed={3.4} waves={3} color={mix(hill, b1, 0.35)} />
      <g transform="translate(0 30)">
      {/* Branches (dark bark with a lit top edge) */}
      {[
        "M-20 20 C60 26 140 48 210 58 S320 74 380 98",
        "M120 40 C140 60 150 80 142 96",
        "M250 64 C266 78 272 92 268 108",
        `M${W + 20} 4 C${W - 30} 20 ${W - 80} 34 ${W - 150} 52 S${W - 230} 72 ${W - 270} 70`,
        `M${W - 90} 32 C${W - 100} 52 ${W - 96} 66 ${W - 104} 80`,
      ].map((d, i) => (
        <g key={i}>
          <path d={d} fill="none" stroke={dk(branch, 0.25)} strokeWidth={i % 3 === 0 ? 10 : 5} strokeLinecap="round" />
          <path d={d} fill="none" stroke={lt(branch, 0.25)} strokeWidth={i % 3 === 0 ? 3 : 1.5} strokeLinecap="round" transform="translate(0 -2)" opacity="0.7" />
        </g>
      ))}
      {/* Paper lantern swinging from the branch */}
      <g transform="translate(300 74)">
        <g {...anim("sc-swing", 3.6)} style={{ transformOrigin: "0px 0px", transformBox: "view-box", animationDuration: "3.6s" } as CSSProperties}>
          <line x1="0" y1="0" x2="0" y2="16" stroke={dk(branch, 0.2)} strokeWidth="1" />
          <circle cx="0" cy="30" r="22" fill={url(`${id}lan`)} {...anim("sc-flicker", 2.6)} />
          <rect x="-6" y="14" width="12" height="3" fill={dk(branch, 0.1)} />
          <ellipse cx="0" cy="28" rx="11" ry="12" fill="#ff6b5b" />
          <ellipse cx="0" cy="28" rx="11" ry="12" fill={url(`${id}lan`)} opacity="0.8" />
          <path d="M-11 28 H11 M-10 22 Q0 24 10 22 M-10 34 Q0 32 10 34" stroke="#c0392b" strokeWidth="0.8" fill="none" opacity="0.7" />
          <rect x="-6" y="39" width="12" height="3" fill={dk(branch, 0.1)} />
          <line x1="0" y1="42" x2="0" y2="50" stroke="#ffd166" strokeWidth="1.2" />
        </g>
      </g>
      {clusters.map(([x, y, r], i) => (
        <g key={i} {...(i % 4 === 0 ? anim("sc-sway", 3 + (i % 3), -i * 0.4) : {})}>
          {flower(x, y, r * 1.15, i % 3 ? b1 : b2, 0, i * 23)}
          {flower(x + r * 1.5, y + r * 0.8, r * 0.8, i % 2 ? b2 : b1, 1, i * 41)}
          {i % 2 ? flower(x - r * 1.3, y + r * 0.6, r * 0.65, b1, 2, i * 17) : <circle cx={x - r * 1.2} cy={y + r * 0.9} r={r * 0.3} fill={dk(b2, 0.1)} />}
        </g>
      ))}
      </g>
      {Array.from({ length: 24 }, (_, i) => (
        <g key={i} transform={`translate(${R(i, 81) * W} 30)`}>
          <g {...anim("sc-petal", 8 + R(i, 82) * 7, -R(i, 83) * 14)}>
            <path d="M0 0 C-3 -2 -4 -6 -2 -8 L0 -7 L2 -8 C4 -6 3 -2 0 0 Z" fill={petal} transform={`scale(${1 + R(i, 84) * 0.6})`} />
          </g>
        </g>
      ))}
      <Vignette id={id} strength={0.22} />
    </>
  );
}

