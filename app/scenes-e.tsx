"use client";

import type { CSSProperties, ReactNode } from "react";
import { anim, Bird, Cloud, CloudDefs, dk, H, hillPath, hillY, LG, lt, Mist, mix, Orb, R, RG, Sky, Stars, url, Vignette, W } from "./scene-kit";
import type { Opts } from "./scenes-a";

// Round-4 banner scenes, each composed from scratch.

const f = (n: number) => n.toFixed(1);
const MAPLE = "M0 -6 L1.4 -2.4 L4.6 -3.8 L3.2 -0.6 L6 0.6 L2.4 1.8 L3 5 L0 3 L-3 5 L-2.4 1.8 L-6 0.6 L-3.2 -0.6 L-4.6 -3.8 L-1.4 -2.4 Z";

// ============ Wisteria: a pergola dripping with wisteria over a pond and a red bridge ============
export function WisteriaGarden({ p, id }: Opts) {
  const [sky1, sky2, hill, wood, b1, b2, petal] = p;
  const deep = dk(b1, 0.3);
  const raceme = (x: number, top: number, len: number, w: number, layer: number, k: number) => {
    const n = Math.round(len / (layer === 0 ? 3.4 : 4.2));
    const sway = anim("sc-sway", 3.6 + R(k, 5) * 2.4, -R(k, 6) * 3);
    const tip = mix(b1, deep, 0.4);
    const topC = lt(b2, layer === 0 ? 0.2 : 0.45);
    return (
      <g key={`${layer}-${k}`} {...sway}>
        <path d={`M${x - w} ${top} C${x - w} ${top + len * 0.5} ${x - w * 0.3} ${top + len * 0.85} ${x} ${top + len} C${x + w * 0.3} ${top + len * 0.85} ${x + w} ${top + len * 0.5} ${x + w} ${top} Z`} fill={url(`${id}rc${layer}`)} />
        {layer < 2
          ? Array.from({ length: n }, (_, j) => {
              const t = j / n;
              const r = w * (1 - t * 0.78);
              const xx = x + Math.sin(j * 1.7 + k) * r * 0.45;
              const yy = top + 2 + j * (len / n);
              return <ellipse key={j} cx={f(xx)} cy={f(yy)} rx={f(r * 0.62)} ry={f(Math.max(1.2, r * 0.42))} fill={mix(topC, tip, t)} stroke={dk(b1, 0.35)} strokeWidth="0.3" strokeOpacity="0.5" />;
            })
          : null}
      </g>
    );
  };
  const drape: ReactNode[] = [];
  // Back layer: paler, smaller, everywhere
  for (let i = 0; i < 46; i++) drape.push(raceme(4 + i * 22 + R(i, 1) * 10, 58, 30 + R(i, 2) * 40, 5, 2, i));
  // Mid and front layers: heavy curtains at the sides, opening in the middle onto the bridge
  for (let i = 0; i < 34; i++) {
    const x = i < 17 ? 10 + i * 18 + R(i, 3) * 8 : 690 + (i - 17) * 18 + R(i, 3) * 8;
    const near = Math.abs(x - 500) / 500;
    drape.push(raceme(x, 60, 40 + near * 70 + R(i, 4) * 20, 6.5, 1, i + 100));
  }
  for (let i = 0; i < 22; i++) {
    const x = i < 11 ? -6 + i * 22 + R(i, 7) * 10 : 760 + (i - 11) * 22 + R(i, 7) * 10;
    const near = Math.abs(x - 500) / 500;
    drape.push(raceme(x, 62, 60 + near * 80 + R(i, 8) * 16, 8.5, 0, i + 200));
  }
  const leaves = Array.from({ length: 70 }, (_, i) => {
    const x = R(i, 31) * W;
    const y = 56 + R(i, 32) * 10;
    return <ellipse key={i} cx={f(x)} cy={f(y)} rx="6" ry="2.4" fill={i % 3 ? "#6a9a4a" : "#8fbf5e"} transform={`rotate(${Math.round((R(i, 33) - 0.5) * 70)} ${f(x)} ${f(y)})`} />;
  });
  return (
    <>
      <Sky id={id} top={sky1} bottom={sky2} horizon="#fff6ea" />
      <defs>
        <LG id={`${id}rc0`} s={[[0, lt(b2, 0.1)], [0.7, b1], [1, deep]]} />
        <LG id={`${id}rc1`} s={[[0, lt(b2, 0.35)], [1, mix(b1, deep, 0.3)]]} />
        <LG id={`${id}rc2`} s={[[0, lt(b2, 0.55), 0.85], [1, lt(b1, 0.3), 0.6]]} />
        <LG id={`${id}post`} x2={1} y2={0} s={[[0, lt(wood, 0.25)], [0.5, wood], [1, dk(wood, 0.45)]]} />
        <LG id={`${id}beam`} s={[[0, lt(wood, 0.25)], [1, dk(wood, 0.35)]]} />
        <LG id={`${id}pond`} s={[[0, mix(sky2, b2, 0.35)], [1, mix(hill, "#4a6a9a", 0.45)]]} />
        <LG id={`${id}br`} s={[[0, "#ff5a4d"], [1, "#a8141c"]]} />
        <RG id={`${id}az`} cx={0.4} cy={0.3} r={0.75} s={[[0, "#ffd1e8"], [0.6, "#ff8fc7"], [1, "#c2408a"]]} />
      </defs>
      <Orb id={id} x={500} y={96} r={30} color="#fff4e0" />
      {/* Soft distant hills and trees */}
      <path d={hillPath(140, 10, 0.6, 2)} fill={mix(hill, sky2, 0.45)} />
      {Array.from({ length: 20 }, (_, i) => {
        const x = 40 + i * 50;
        return <ellipse key={i} cx={x} cy={hillY(x, 140, 10, 0.6, 2) - 6} rx="22" ry="12" fill={mix("#8fbf9e", sky2, 0.5)} />;
      })}
      <Mist id={id} k="m0" y={120} h={40} color="#ffffff" opacity={0.5} dur={24} />
      {/* Pond, banks, azaleas */}
      <path d={`M-20 168 Q250 158 500 166 T${W + 20} 162 V${H} H-20 Z`} fill={mix(hill, "#7aa86a", 0.55)} />
      <path d="M180 214 C220 176 380 168 500 170 C640 168 800 178 830 214 Z" fill={url(`${id}pond`)} />
      {Array.from({ length: 7 }, (_, i) => (
        <rect key={i} x={360 + R(i, 3) * 260} y={180 + i * 4.4} width={40 + R(i, 4) * 60} height="1" fill="#ffffff" opacity="0.5" {...anim("sc-shimmer", 2 + R(i, 5), -R(i, 6) * 2)} />
      ))}
      {/* Red taiko bridge and its reflection */}
      <g>
        <path d="M330 178 Q500 112 670 178" fill="none" stroke={url(`${id}br`)} strokeWidth="9" />
        <path d="M330 166 Q500 100 670 166" fill="none" stroke="#e5484d" strokeWidth="3" />
        {Array.from({ length: 13 }, (_, i) => {
          const x = 346 + i * 25.6;
          const tt = (x - 330) / 340;
          const y = 166 - 4 * 33 * tt * (1 - tt);
          return <line key={i} x1={x} y1={y} x2={x} y2={y + 13} stroke="#c43d42" strokeWidth="2.4" />;
        })}
        <path d="M330 182 Q500 248 670 182" fill="none" stroke="#e5484d" strokeWidth="6" opacity="0.25" />
      </g>
      {[[220, 196, 22], [262, 204, 16], [770, 196, 24], [820, 206, 16]].map(([x, y, r], i) => (
        <g key={i}>
          <ellipse cx={x} cy={y + r * 0.5} rx={r * 1.1} ry={r * 0.25} fill="#000" opacity="0.15" />
          <circle cx={x} cy={y} r={r * 0.75} fill={url(`${id}az`)} />
          {Array.from({ length: 8 }, (_, j) => (
            <circle key={j} cx={x + (R(j, i + 9) - 0.5) * r * 1.2} cy={y + (R(j, i + 10) - 0.6) * r} r="1.4" fill="#fff" opacity="0.6" />
          ))}
        </g>
      ))}
      {[[440, 196], [560, 202], [610, 190]].map(([x, y], i) => (
        <g key={i}>
          <ellipse cx={x} cy={y} rx="9" ry="3" fill="#4f8f4f" />
          {i === 1 ? <circle cx={x - 2} cy={y - 2} r="2.4" fill="#ffd1e3" /> : null}
        </g>
      ))}
      {/* The pergola */}
      {[130, 870].map((x) => (
        <g key={x}>
          <rect x={x - 9} y="58" width="18" height="162" fill={url(`${id}post`)} />
          <rect x={x - 12} y="200" width="24" height="8" fill={dk(wood, 0.2)} />
        </g>
      ))}
      <rect x="-20" y="50" width={W + 40} height="12" fill={url(`${id}beam`)} />
      {[100, 300, 500, 700, 900].map((x) => (
        <rect key={x} x={x - 6} y="44" width="12" height="20" rx="2" fill={dk(wood, 0.15)} />
      ))}
      {leaves}
      {drape}
      {Array.from({ length: 20 }, (_, i) => (
        <g key={i} transform={`translate(${R(i, 81) * W} 60)`}>
          <g {...anim("sc-petal", 8 + R(i, 82) * 7, -R(i, 83) * 14)}>
            <ellipse rx="2.4" ry="1.4" fill={petal} />
          </g>
        </g>
      ))}
      <Vignette id={id} strength={0.22} />
    </>
  );
}

// ============ Autumn Canopy: a leafy forest path under a blazing canopy ============
export function AutumnPath({ p, id }: Opts) {
  const [sky1, sky2, sun, t1, t2, t3, glow] = p;
  const reds = ["#c8341c", "#e0782a", "#f2a23a", "#b84a14", "#ffc04d", "#9a2a12", "#e8562a"];
  const vx = 500;
  const vy = 150;
  const trunk = (x: number, w: number, lean: number, k: number) => (
    <g key={k}>
      <path d={`M${x - w / 2 - w * 0.3} ${H} C${x - w / 2} ${H - 20} ${x - w / 2 + lean * 0.4} 140 ${x - w / 2 + lean} 40 L${x + w / 2 + lean} 40 C${x + w / 2 + lean * 0.4} 140 ${x + w / 2} ${H - 20} ${x + w / 2 + w * 0.3} ${H} Z`} fill={url(`${id}bark${x < vx ? "L" : "R"}`)} />
      {Array.from({ length: Math.round(w / 5) }, (_, j) => {
        const off = -w / 2 + (j + 0.5) * (w / Math.round(w / 5));
        return <path key={j} d={`M${x + off} ${H} C${x + off + lean * 0.2} 170 ${x + off + lean * 0.6} 110 ${x + off + lean} 40`} fill="none" stroke="#1a0e08" strokeWidth={w / 24} opacity="0.35" strokeDasharray={`${8 + R(j, k) * 14} ${3 + R(j, k + 1) * 5}`} />;
      })}
    </g>
  );
  const canopyLeaves: ReactNode[] = [];
  for (let i = 0; i < 360; i++) {
    const x = R(i, 11) * (W + 40) - 20;
    const edge = 74 + Math.abs(x - vx) * 0.05 + Math.sin(x / 37) * 8;
    const y = 40 + R(i, 12) * (edge - 40);
    const s = 1.1 + R(i, 13) * 1.1;
    const c = reds[Math.floor(R(i, 14) * reds.length)];
    const lit = Math.abs(x - vx) < 240 && y > edge - 18;
    canopyLeaves.push(<path key={i} d={MAPLE} fill={lit ? lt(c, 0.2) : c} transform={`translate(${f(x)} ${f(y)}) rotate(${Math.round(R(i, 15) * 360)}) scale(${f(s)})`} />);
  }
  const ground: ReactNode[] = [];
  for (let i = 0; i < 260; i++) {
    const t = Math.pow(R(i, 21), 0.7);
    const y = vy + 6 + (H - vy) * t;
    const x = R(i, 22) * W;
    const s = 0.4 + t * 1.3;
    ground.push(<path key={i} d={MAPLE} fill={reds[i % reds.length]} opacity={0.85} transform={`translate(${f(x)} ${f(y)}) rotate(${Math.round(R(i, 23) * 360)}) scale(${f(s)} ${f(s * 0.55)})`} />);
  }
  return (
    <>
      <Sky id={id} top={sky1} bottom={sky2} horizon={lt(sun, 0.3)} />
      <defs>
        <LG id={`${id}barkL`} x2={1} y2={0} s={[[0, "#1a0e08"], [0.55, "#4a2e1c"], [1, mix("#8a5a34", sun, 0.3)]]} />
        <LG id={`${id}barkR`} x2={1} y2={0} s={[[0, mix("#8a5a34", sun, 0.3)], [0.45, "#4a2e1c"], [1, "#1a0e08"]]} />
        <RG id={`${id}glow`} s={[[0, "#fff6d6", 0.95], [0.35, sun, 0.6], [1, sun, 0]]} />
        <LG id={`${id}ray`} s={[[0, "#fff6d6", 0.5], [1, "#fff6d6", 0]]} />
        <LG id={`${id}path`} s={[[0, mix("#c99a62", sun, 0.4)], [1, "#7a5230"]]} />
        <LG id={`${id}gnd`} s={[[0, mix(t2, sky2, 0.35)], [1, dk(t3, 0.2)]]} />
        <RG id={`${id}lamp`} s={[[0, "#fff1c1", 0.9], [1, "#ffb347", 0]]} />
      </defs>
      {/* Hazy forest depth behind */}
      {[0, 1, 2].map((layer) => (
        <g key={layer} opacity={0.5 + layer * 0.2}>
          {Array.from({ length: 14 + layer * 4 }, (_, i) => {
            const x = (i / (13 + layer * 4)) * W + R(i, layer + 40) * 30;
            const w = 3 + layer * 3;
            return <rect key={i} x={x} y={90} width={w} height={vy + 10 - 90} fill={mix(t3, sky2, 0.65 - layer * 0.2)} />;
          })}
        </g>
      ))}
      <circle cx={vx} cy={vy - 14} r="150" fill={url(`${id}glow`)} {...anim("sc-breathe", 5)} />
      <rect y={vy} width={W} height={H - vy} fill={url(`${id}gnd`)} />
      {/* The path running into the light */}
      <path d={`M${vx - 6} ${vy} C${vx - 20} 170 ${vx - 90} 196 ${vx - 150} ${H} L${vx + 150} ${H} C${vx + 90} 196 ${vx + 20} 170 ${vx + 6} ${vy} Z`} fill={url(`${id}path`)} />
      {ground}
      {/* God rays */}
      <g {...anim("sc-ray", 7)}>
        {[-3, -2, -1, 0, 1, 2, 3].map((i) => (
          <path key={i} d={`M${vx} ${vy - 30} L${vx + i * 110 - 30} ${H} L${vx + i * 110 + 30} ${H} Z`} fill={url(`${id}ray`)} opacity={0.35} />
        ))}
      </g>
      {/* Great trunks framing the path */}
      {trunk(60, 64, 8, 1)}
      {trunk(190, 38, 4, 2)}
      {trunk(300, 22, 2, 3)}
      {trunk(940, 66, -8, 4)}
      {trunk(810, 40, -4, 5)}
      {trunk(700, 22, -2, 6)}
      {/* Bench with a hanging lantern */}
      <g transform="translate(700 196)">
        <ellipse cx="0" cy="4" rx="34" ry="4" fill="#000" opacity="0.25" />
        <rect x="-26" y="-12" width="52" height="4" rx="1" fill="#6b4224" />
        <rect x="-26" y="-22" width="52" height="3" rx="1" fill="#7a4e2a" />
        <rect x="-26" y="-28" width="52" height="3" rx="1" fill="#7a4e2a" />
        <path d="M-22 -8 V4 M22 -8 V4 M-22 -12 V-28 M22 -12 V-28" stroke="#3a2416" strokeWidth="2.4" />
        <path d="M-10 -12 l3 -4 l3 4 Z" fill="#c8341c" />
      </g>
      <g transform="translate(300 96)">
        <line x1="0" y1="-30" x2="0" y2="0" stroke="#2a1a10" strokeWidth="1" />
        <circle cx="0" cy="8" r="22" fill={url(`${id}lamp`)} {...anim("sc-flicker", 2.6)} />
        <rect x="-5" y="0" width="10" height="14" rx="2" fill="#ffd27a" stroke="#2a1a10" strokeWidth="1.2" />
        <path d="M-6 0 L0 -5 L6 0 Z" fill="#2a1a10" />
      </g>
      {/* The canopy overhead */}
      <path d={`M-20 0 H${W + 20} V70 ${Array.from({ length: 30 }, (_, i) => { const x = W + 20 - (i + 1) * ((W + 40) / 30); const y = 70 + Math.abs(x - vx) * 0.05 + Math.sin(x / 37) * 8; return `L${f(x)} ${f(y)}`; }).join(" ")} Z`} fill={dk(t2, 0.35)} />
      {canopyLeaves}
      {Array.from({ length: 22 }, (_, i) => (
        <g key={i} transform={`translate(${R(i, 61) * W} 60)`}>
          <g {...anim("sc-leaffall", 8 + R(i, 62) * 6, -R(i, 63) * 14)}>
            <path d={MAPLE} fill={reds[i % reds.length]} transform={`scale(${1.2 + R(i, 64) * 0.8})`} />
          </g>
        </g>
      ))}
      <Mist id={id} k="warm" y={130} h={60} color={glow} opacity={0.2} dur={20} />
      <Vignette id={id} strength={0.42} />
    </>
  );
}

// ============ Lavender Fields: real hedge rows of lavender running to the sunset ============
export function LavenderRows({ p, id }: Opts) {
  const [sky1, sky2, sun, h1, h2, f1, f2] = p;
  const vx = 520;
  const vy = 134;
  const rows = 14;
  const span = W + 2600;
  const out: ReactNode[] = [];
  // Draw far-to-near so nearer hedge tops overlap
  const steps = 26;
  for (let j = 0; j < steps; j++) {
    const t0 = Math.pow(j / steps, 1.6);
    const t1 = Math.pow((j + 1) / steps, 1.6);
    const y0 = vy + (H + 40 - vy) * t0;
    const y1 = vy + (H + 40 - vy) * t1;
    for (let i = 0; i < rows; i++) {
      const bc = -1300 + (i + 0.5) * (span / rows);
      const half = (span / rows) * 0.36;
      const xl0 = vx + (bc - half - vx) * t0;
      const xr0 = vx + (bc + half - vx) * t0;
      const xl1 = vx + (bc - half - vx) * t1;
      const xr1 = vx + (bc + half - vx) * t1;
      if (Math.max(xr0, xr1) < -40 || Math.min(xl0, xl1) > W + 40) continue;
      const hgt = 2 + t1 * 18;
      // Hedge segment: shaded body, lit rounded top
      out.push(<path key={`b${i}-${j}`} d={`M${f(xl0)} ${f(y0)} L${f(xr0)} ${f(y0)} L${f(xr1)} ${f(y1)} L${f(xl1)} ${f(y1)} Z`} fill={j % 2 ? h2 : dk(h2, 0.06)} />);
      out.push(<path key={`t${i}-${j}`} d={`M${f(xl1)} ${f(y1)} Q${f((xl1 + xr1) / 2)} ${f(y1 - hgt)} ${f(xr1)} ${f(y1)} Z`} fill={url(`${id}top`)} />);
      if (t1 > 0.3) {
        const spikes = Math.min(9, Math.round(t1 * 9));
        for (let s = 0; s < spikes; s++) {
          const sx = xl1 + ((s + 0.5) / spikes) * (xr1 - xl1);
          const sy = y1 - hgt * Math.sin(((s + 0.5) / spikes) * Math.PI) * 0.9;
          out.push(<path key={`s${i}-${j}-${s}`} d={`M${f(sx)} ${f(sy + 1)} l${f((R(s, i + j) - 0.5) * 2)} ${f(-3 - t1 * 7)}`} stroke={s % 2 ? f2 : lt(f1, 0.2)} strokeWidth={f(0.8 + t1 * 1.4)} strokeLinecap="round" />);
        }
      }
    }
  }
  return (
    <>
      <Sky id={id} top={sky1} bottom={sky2} horizon={lt(sun, 0.25)} glowY={0.62} />
      <defs>
        <LG id={`${id}top`} s={[[0, lt(f2, 0.2)], [0.45, f1], [1, h1]]} />
        <LG id={`${id}soil`} s={[[0, mix("#9a7a5a", sky2, 0.5)], [1, "#4a3a2a"]]} />
        <LG id={`${id}wall`} x2={1} y2={0} s={[[0, "#f6e2c6"], [1, "#c9a882"]]} />
        <RG id={`${id}sunglow`} s={[[0, "#fff6d6", 0.9], [1, sun, 0]]} />
      </defs>
      <circle cx={vx} cy={vy} r="180" fill={url(`${id}sunglow`)} />
      <Orb id={id} x={vx} y={vy - 6} r={24} color={sun} />
      <path d={`M-20 ${vy + 1} Q160 ${vy - 26} 360 ${vy - 8} T720 ${vy - 14} T${W + 20} ${vy - 6} V${vy + 2} H-20 Z`} fill={mix(h1, sky2, 0.55)} />
      <g transform={`translate(700 ${vy + 1})`}>
        <rect x="-26" y="-16" width="40" height="16" fill={url(`${id}wall`)} />
        <rect x="14" y="-12" width="18" height="12" fill={url(`${id}wall`)} />
        <path d="M-29 -16 L-6 -26 L17 -16 Z M12 -12 L23 -18 L34 -12 Z" fill="#c4502b" />
        <rect x="-18" y="-10" width="5" height="5" fill="#5a3a20" />
        <rect x="-4" y="-10" width="5" height="5" fill="#ffd27a" {...anim("sc-flicker", 4)} />
        {[-40, -47, 44, 51].map((x, i) => (
          <path key={i} d={`M${x} 0 C${x - 4} -12 ${x - 3} -26 ${x} ${-32 - (i % 2) * 6} C${x + 3} -26 ${x + 4} -12 ${x} 0 Z`} fill="#24402a" />
        ))}
      </g>
      <g transform={`translate(260 ${vy})`}>
        <path d="M0 0 L0 -12" stroke="#3a2a1a" strokeWidth="2" />
        <circle cx="0" cy="-18" r="10" fill="#4a6a3a" />
        <circle cx="-6" cy="-14" r="7" fill="#3a5a2e" />
      </g>
      <rect y={vy} width={W} height={H - vy} fill={url(`${id}soil`)} />
      {out}
      {/* Close-up stalks in the corners */}
      {Array.from({ length: 30 }, (_, i) => {
        const left = i < 15;
        const x = left ? R(i, 131) * 180 : W - R(i, 131) * 180;
        const y = 168 + R(i, 132) * 30;
        return (
          <g key={i} {...anim("sc-sway", 3 + R(i, 133) * 2, -R(i, 134) * 3)}>
            <path d={`M${x} ${H + 4} Q${x + 2} ${y + 20} ${x} ${y}`} stroke="#6a8a4a" strokeWidth="1.4" fill="none" />
            {Array.from({ length: 9 }, (_, k) => (
              <ellipse key={k} cx={x + (k % 2 ? 2 : -2)} cy={y - k * 3.6} rx={2.6 - k * 0.15} ry="3.2" fill={k % 3 === 0 ? dk(f1, 0.2) : k % 2 ? f1 : lt(f1, 0.3)} />
            ))}
          </g>
        );
      })}
      {[0, 1].map((i) => (
        <g key={i} {...anim("sc-flutter", 6 + i * 2, -i * 2)}>
          <g transform={`translate(${440 + i * 140} ${158 + i * 12})`}>
            <ellipse cx="0" cy="0" rx="3.6" ry="2.6" fill="#ffd23f" />
            <path d="M-1 -2.4 V2.4 M1.4 -2.4 V2.4" stroke="#2a1a0e" strokeWidth="1" />
            <g {...anim("sc-flap", 0.12)}>
              <ellipse cx="-1" cy="-3.4" rx="2.2" ry="2.6" fill="#fff" opacity="0.8" />
            </g>
          </g>
        </g>
      ))}
      <Mist id={id} k="warm" y={vy - 16} h={40} color={lt(sun, 0.3)} opacity={0.35} dur={22} />
      <Vignette id={id} strength={0.25} />
    </>
  );
}

// ============ Ember Forge: a blacksmith's forge, a roaring furnace and sparks off the anvil ============
export function BlacksmithForge({ p, id }: Opts) {
  const [bg1, bg2, rock1, rock2, l1, l2, ember] = p;
  const stones: ReactNode[] = [];
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 9; c++) {
      const w = 30;
      const x = 300 + c * w + (r % 2 ? w / 2 : 0);
      const y = 84 + r * 15;
      if (x > 560) continue;
      // Firelight: stones near the furnace mouth glow warm, the rest fall into shadow
      const d = Math.hypot(x + w / 2 - 430, y + 6 - 176);
      const warm = Math.max(0, 0.42 - d / 330);
      stones.push(<rect key={`${r}-${c}`} x={x} y={y} width={w - 2} height="13" rx="3" fill={mix(dk(rock1, 0.3 + R(r * 9 + c, 4) * 0.15), l1, warm)} stroke={dk(rock1, 0.6)} strokeWidth="0.8" />);
    }
  }
  const strike = 1.6;
  return (
    <>
      <Sky id={id} top={bg1} bottom={bg2} horizon={mix(bg2, l1, 0.35)} />
      <defs>
        <RG id={`${id}fire`} cx={0.5} cy={0.75} r={0.8} s={[[0, "#fff6c9"], [0.3, l2], [0.65, l1], [1, "#7a1a00"]]} />
        <RG id={`${id}spill`} s={[[0, l1, 0.55], [1, l1, 0]]} />
        <LG id={`${id}steel`} s={[[0, "#9aa4b2"], [0.35, "#4a525e"], [1, "#1a1e26"]]} />
        <LG id={`${id}stump`} x2={1} y2={0} s={[[0, "#3a2416"], [0.5, "#7a5230"], [1, "#2a1a10"]]} />
        <LG id={`${id}ingot`} x2={1} y2={0} s={[[0, l1], [0.5, "#fff6c9"], [1, l1]]} />
        <LG id={`${id}roof`} s={[[0, dk(rock2, 0.1)], [1, dk(rock2, 0.5)]]} />
        <RG id={`${id}spark`} s={[[0, "#fff"], [0.4, l2], [1, l1, 0]]} />
        <filter id={`${id}bl`} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="6" />
        </filter>
      </defs>
      <Stars n={50} top={90} seed={71} />
      {/* Mountains with a distant volcanic glow */}
      <path d={`M-20 160 L80 112 L160 136 L240 100 L320 140 L380 130 L430 160 Z`} fill={mix(rock2, bg2, 0.4)} />
      <path d={`M600 160 L680 118 L760 136 L840 96 L920 128 L${W + 20} 112 L${W + 20} 160 Z`} fill={mix(rock2, bg2, 0.4)} />
      <ellipse cx="840" cy="96" rx="40" ry="16" fill={l1} opacity="0.25" filter={url(`${id}bl`)} />
      {/* Smoke rolling from the chimney */}
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <g key={i} transform={`translate(${380 + i * 3} 42)`}>
          <circle r={9 + (i % 3) * 3} fill={mix(rock2, "#a89ab8", 0.4)} opacity="0.7" {...anim("sc-plume", 5, -i * 0.85, { "--sx": `${40 + i * 6}px` })} />
        </g>
      ))}
      {/* The forge: stone walls, chimney, timber roof, roaring furnace mouth */}
      <rect x="360" y="34" width="34" height="56" fill={mix(rock1, "#000", 0.2)} stroke={dk(rock1, 0.4)} />
      <rect x="356" y="30" width="42" height="7" fill={dk(rock1, 0.1)} />
      <path d="M270 92 L440 58 L610 92 Z" fill={url(`${id}roof`)} />
      <path d="M270 92 L440 58 L610 92" fill="none" stroke={mix(rock2, l1, 0.3)} strokeWidth="1.6" />
      <rect x="296" y="84" width="268" height="122" fill={dk(rock1, 0.3)} />
      {stones}
      <ellipse cx="430" cy="196" rx="200" ry="40" fill={url(`${id}spill`)} {...anim("sc-flicker", 2.2)} />
      <path d="M380 206 V156 A50 46 0 0 1 480 156 V206 Z" fill={dk(rock2, 0.4)} />
      <path d="M388 206 V158 A42 40 0 0 1 472 158 V206 Z" fill={url(`${id}fire`)} {...anim("sc-flicker", 1.4)} />
      {[0, 1, 2, 3, 4].map((i) => (
        <path key={i} d={`M${398 + i * 16} 206 C${392 + i * 16} 192 ${402 + i * 16} 182 ${404 + i * 16} ${168 - (i % 2) * 8} C${410 + i * 16} 182 ${416 + i * 16} 194 ${410 + i * 16} 206 Z`} fill={i % 2 ? l2 : "#fff6c9"} opacity="0.85" {...anim("sc-sway", 0.8 + i * 0.15, -i * 0.2)} />
      ))}
      {/* Tongs and a hammer hanging on the wall */}
      <path d="M312 104 L318 140 M318 104 L314 140" stroke="#5a5e66" strokeWidth="2" />
      <path d="M530 104 L530 136" stroke="#7a5230" strokeWidth="3" />
      <rect x="522" y="100" width="16" height="8" rx="1" fill="#5a5e66" />
      {/* Ground */}
      <path d={`M-20 206 L${W + 20} 202 V${H} H-20 Z`} fill={dk(rock2, 0.4)} />
      <ellipse cx="640" cy="210" rx="160" ry="12" fill={url(`${id}spill`)} />
      {/* Barrel and water trough */}
      <g transform="translate(250 208)">
        <rect x="-16" y="-34" width="32" height="34" rx="6" fill="#6b4224" />
        <path d="M-16 -28 H16 M-16 -8 H16" stroke="#3a3e46" strokeWidth="2.4" />
        <rect x="-16" y="-34" width="10" height="34" rx="5" fill="#fff" opacity="0.07" />
      </g>
      {/* Anvil on a stump with a glowing ingot */}
      <g transform="translate(640 206)">
        <rect x="-16" y="-24" width="32" height="24" fill={url(`${id}stump`)} />
        <ellipse cx="0" cy="-24" rx="16" ry="3" fill="#9a7a52" />
        <path d="M-26 -40 L30 -40 C38 -40 44 -44 48 -46 C46 -40 40 -34 30 -34 L18 -34 L14 -28 L-14 -28 L-18 -34 L-26 -34 Z" fill={url(`${id}steel`)} />
        <path d="M-26 -40 L30 -40 C38 -40 44 -44 48 -46" fill="none" stroke="#c9d1dc" strokeWidth="1.2" />
        <rect x="-6" y="-44" width="22" height="4" rx="1" fill={url(`${id}ingot`)} {...anim("sc-flicker", 1.2)} />
        <ellipse cx="5" cy="-44" rx="18" ry="6" fill={l1} opacity="0.35" filter={url(`${id}bl`)} />
      </g>
      {/* The smith swinging the hammer */}
      <g transform="translate(682 206)">
        <path d="M-6 0 L-4 -24 L8 -24 L10 0 Z" fill="#141018" />
        <path d="M-8 -24 C-8 -40 12 -40 12 -24 Z" fill="#141018" />
        <path d="M-6 -36 L10 -36 L8 -14 L-4 -14 Z" fill="#5a3a20" />
        <circle cx="2" cy="-44" r="6" fill="#141018" />
        <g transform="translate(-4 -34)">
          <g className="sc-swing-hammer" style={{ animationDuration: `${strike}s` } as CSSProperties}>
            <path d="M0 0 L-16 -6" stroke="#141018" strokeWidth="5" strokeLinecap="round" />
            <path d="M-16 -6 L-30 -2" stroke="#6b4224" strokeWidth="2.4" strokeLinecap="round" />
            <rect x="-36" y="-8" width="8" height="12" rx="1.5" fill="#3a3e46" transform="rotate(16 -32 -2)" />
          </g>
        </g>
      </g>
      {/* Sparks bursting off each strike */}
      <g transform="translate(646 162)">
        {Array.from({ length: 14 }, (_, i) => {
          const a = -170 + i * 12 + (R(i, 5) - 0.5) * 8;
          const d = 30 + R(i, 6) * 40;
          return (
            <circle
              key={i}
              r={1 + R(i, 7) * 1.4}
              fill={url(`${id}spark`)}
              className="sc-sparkburst"
              style={{ animationDuration: `${strike}s`, "--sx": `${Math.cos((a * Math.PI) / 180) * d}px`, "--sy": `${Math.sin((a * Math.PI) / 180) * d - 10}px` } as CSSProperties}
            />
          );
        })}
      </g>
      {Array.from({ length: 30 }, (_, i) => (
        <circle key={i} cx={360 + R(i, 151) * 160} cy={60} r={0.8 + R(i, 152) * 1.4} fill={i % 3 ? ember : l2} {...anim("sc-ember", 3 + R(i, 153) * 3, -R(i, 154) * 6)} />
      ))}
      <Vignette id={id} strength={0.5} />
    </>
  );
}

// ============ Witching Hour: a haunted house above a moonlit graveyard ============
export function WitchingHour({ p, id }: Opts) {
  const [sky1, sky2, moon, far, near, body, shade, glow] = p;
  const tomb = (x: number, y: number, s: number, kind: number, k: number) => (
    <g key={k} transform={`translate(${x} ${y}) scale(${s}) rotate(${(R(k, 3) - 0.5) * 12})`}>
      <ellipse cx="2" cy="1" rx="14" ry="3" fill="#000" opacity="0.35" />
      {kind === 0 ? (
        <>
          <path d="M-10 0 V-22 A10 10 0 0 1 10 -22 V0 Z" fill={url(`${id}stone`)} />
          <path d="M-10 0 V-22 A10 10 0 0 1 -2 -31.6 V0 Z" fill="#fff" opacity="0.08" />
          <path d="M-5 -22 h10 M-5 -17 h10 M-3 -12 h6" stroke="#1a2a22" strokeWidth="1" opacity="0.6" />
          <path d="M4 -28 l-3 6 l3 4" stroke="#1a2a22" strokeWidth="0.8" fill="none" opacity="0.7" />
        </>
      ) : kind === 1 ? (
        <>
          <path d="M-3 0 V-26 H-11 V-32 H-3 V-40 H3 V-32 H11 V-26 H3 V0 Z" fill={url(`${id}stone`)} />
          <path d="M-3 0 V-26 H-11 V-32 H-3 V-40 H0 V0 Z" fill="#fff" opacity="0.08" />
        </>
      ) : (
        <>
          <rect x="-11" y="-18" width="22" height="18" rx="2" fill={url(`${id}stone`)} />
          <path d="M-11 -18 L0 -26 L11 -18 Z" fill={url(`${id}stone`)} />
        </>
      )}
      <path d="M-10 -1 q4 -4 7 0 q3 -3 6 0" stroke="#3f7a3e" strokeWidth="1.6" fill="none" />
    </g>
  );
  return (
    <>
      <Sky id={id} top={sky1} bottom={sky2} horizon={mix(sky2, moon, 0.25)} />
      <defs>
        <LG id={`${id}stone`} x2={1} y2={0.3} s={[[0, "#7a8a82"], [0.6, "#4a5a52"], [1, "#24302a"]]} />
        <RG id={`${id}win`} s={[[0, "#f6ffb0", 0.9], [1, glow, 0]]} />
        <LG id={`${id}gh`} s={[[0, "#ffffff", 0.95], [1, "#c8ffe0", 0.25]]} />
        <RG id={`${id}wisp`} s={[[0, "#ffffff", 1], [0.3, body, 0.8], [1, body, 0]]} />
        <RG id={`${id}pk`} cx={0.4} cy={0.35} r={0.7} s={[[0, lt(body, 0.3)], [0.6, body], [1, dk(shade, 0.3)]]} />
      </defs>
      <Stars n={60} top={110} seed={2} color={lt(moon, 0.3)} />
      <Orb id={id} x={560} y={96} r={40} color={moon} moon />
      <g {...anim("sc-drift", 22)}>
        <ellipse cx="520" cy="104" rx="120" ry="6" fill={dk(sky1, 0.2)} opacity="0.65" />
        <ellipse cx="640" cy="80" rx="80" ry="4" fill={dk(sky1, 0.2)} opacity="0.55" />
      </g>
      {[0, 1, 2].map((i) => (
        <g key={i} transform={`translate(${480 + i * 50} ${84 + i * 10}) scale(${0.8 - i * 0.15})`}>
          <g {...anim("sc-batfly", 12 + i * 3, -i * 4)}>
            <path {...anim("sc-flap", 0.28)} d="M0 0 C-4 -5 -9 -6 -13 -3 C-14 -7 -19 -8 -23 -5 C-19 -2 -18 3 -15 6 C-11 3 -6 4 -3 7 L0 4 L3 7 C6 4 11 3 15 6 C18 3 19 -2 23 -5 C19 -8 14 -7 13 -3 C9 -6 4 -5 0 0 Z" fill="#05100b" />
          </g>
        </g>
      ))}
      {/* The haunted house on its hill */}
      <path d={hillPath(150, 16, 0.4, 1.4)} fill={far} />
      <g transform={`translate(720 ${hillY(720, 150, 16, 0.4, 1.4) + 2})`} fill="#030a07">
        <path d="M-50 0 V-40 L-34 -56 L-18 -40 V-30 H18 V-46 L30 -74 L42 -46 V0 Z" />
        <path d="M-24 -30 L0 -52 L24 -30 Z" />
        <rect x="40" y="-30" width="20" height="30" />
        <path d="M38 -30 L50 -44 L62 -30 Z" />
        <rect x="-6" y="-66" width="4" height="14" />
        {[[-42, -30], [-26, -30], [-8, -20], [8, -20], [24, -40], [30, -58], [46, -20]].map(([x, y], i) => (
          <g key={i}>
            <circle cx={x + 3} cy={y + 4} r="9" fill={url(`${id}win`)} {...anim("sc-flicker", 2 + i * 0.5, -i)} />
            <rect x={x} y={y} width="6" height="8" fill="#e9ff8a" opacity={i % 3 === 1 ? 0.25 : 0.9} {...anim("sc-flicker", 2 + i * 0.5, -i)} />
          </g>
        ))}
      </g>
      {/* Gnarled dead tree */}
      <g stroke="#020806" strokeLinecap="round" fill="none">
        <path d="M150 220 C150 170 160 140 150 100 C146 84 132 70 116 62" strokeWidth="9" />
        <path d="M152 128 C170 110 196 104 214 84 M150 104 C132 98 110 102 92 90 M196 104 C204 94 208 84 220 76 M120 64 C110 56 100 56 90 58 M214 84 C228 80 238 70 246 60" strokeWidth="4" />
        <path d="M92 90 C84 86 76 88 70 84 M246 60 L256 54" strokeWidth="2" />
      </g>
      <g transform="translate(212 86)">
        <line x1="0" y1="0" x2="0" y2="10" stroke="#3a3a2a" strokeWidth="0.8" />
        <rect x="-4" y="10" width="8" height="10" rx="1" fill="#e9ff8a" {...anim("sc-flicker", 2.4)} />
        <circle cx="0" cy="15" r="12" fill={url(`${id}win`)} />
      </g>
      <Mist id={id} k="m1" y={150} h={40} color={lt(sky2, 0.4)} opacity={0.35} dur={16} />
      {/* Graveyard */}
      <path d={hillPath(186, 8, 2.4, 2.2)} fill={near} />
      <g stroke="#030a07" strokeWidth="1.6">
        <line x1="260" x2="560" y1="180" y2="176" />
        <line x1="260" x2="560" y1="194" y2="190" />
        {Array.from({ length: 22 }, (_, i) => (
          <g key={i}>
            <line x1={262 + i * 14} x2={262 + i * 14} y1={200 - i * 0.2} y2={172 - i * 0.2} />
            <path d={`M${259 + i * 14} ${172 - i * 0.2} L${262 + i * 14} ${165 - i * 0.2} L${265 + i * 14} ${172 - i * 0.2}`} fill="#030a07" />
          </g>
        ))}
      </g>
      {tomb(300, 206, 1, 0, 1)}
      {tomb(360, 210, 1.1, 1, 2)}
      {tomb(430, 204, 0.85, 2, 3)}
      {tomb(600, 208, 1.2, 0, 4)}
      {tomb(670, 212, 0.9, 1, 5)}
      {tomb(760, 206, 1, 0, 6)}
      {tomb(840, 212, 1.15, 2, 7)}
      {[[490, 210, 0.9], [540, 214, 0.7], [890, 212, 0.75]].map(([x, y, s], i) => (
        <g key={i} transform={`translate(${x} ${y}) scale(${s})`}>
          <circle cx="0" cy="-8" r="30" fill={url(`${id}win`)} {...anim("sc-flicker", 2 + i * 0.4, -i)} />
          <ellipse cx="0" cy="-8" rx="13" ry="10" fill={url(`${id}pk`)} />
          <path d="M-6 -11 l3 -3 l3 3 Z M0 -11 l3 -3 l3 3 Z M-6 -5 q6 5 12 0" fill="#f6ffb0" transform="translate(-0.5 0)" />
        </g>
      ))}
      {[[400, 120, 1], [640, 132, 0.8], [300, 150, 0.7]].map(([x, y, s], i) => (
        <g key={i} transform={`translate(${x} ${y}) scale(${s})`}>
          <g {...anim("sc-ghost", 5 + i, -i * 1.5)}>
            <path d="M-12 16 V-2 A12 12 0 0 1 12 -2 V16 L8 12 L4 16 L0 12 L-4 16 L-8 12 Z" fill={url(`${id}gh`)} />
            <ellipse cx="-4" cy="-1" rx="1.8" ry="2.6" fill="#123" />
            <ellipse cx="4" cy="-1" rx="1.8" ry="2.6" fill="#123" />
            <ellipse cx="0" cy="6" rx="2" ry="2.8" fill="#123" />
          </g>
        </g>
      ))}
      {Array.from({ length: 8 }, (_, i) => (
        <circle key={i} cx={260 + R(i, 41) * 560} cy={150 + R(i, 42) * 50} r="6" fill={url(`${id}wisp`)} {...anim("sc-firefly", 3 + R(i, 43) * 3, -R(i, 44) * 4)} />
      ))}
      <Mist id={id} k="m2" y={186} h={34} color={lt(sky2, 0.5)} opacity={0.4} dur={20} />
      <Vignette id={id} strength={0.5} />
    </>
  );
}

// ============ Sunflower Hills: a whole field of sunflowers ============
export function SunflowerField({ p, id }: Opts) {
  const [sky1, sky2, sun, h1, h2, f1, f2] = p;
  const head = (x: number, y: number, r: number, k: number, detail: boolean) => (
    <g key={k}>
      <path d={`M${x} ${y + r * 0.8} Q${x + r * 0.2} ${y + r * 3} ${x} ${H + 10}`} stroke="#4f7a2a" strokeWidth={Math.max(0.8, r * 0.16)} fill="none" />
      {detail ? <path d={`M${x} ${y + r * 2.2} C${x - r * 0.8} ${y + r * 1.6} ${x - r * 1.8} ${y + r * 1.8} ${x - r * 2.2} ${y + r * 2.6} C${x - r * 1.4} ${y + r * 2.8} ${x - r * 0.6} ${y + r * 2.6} ${x} ${y + r * 2.2} Z`} fill={url(`${id}lf`)} /> : null}
      {detail
        ? Array.from({ length: 18 }, (_, j) => (
            <path key={j} d={`M0 ${-r * 0.4} C${-r * 0.22} ${-r * 0.6} ${-r * 0.2} ${-r * 0.95} 0 ${-r * 1.15} C${r * 0.2} ${-r * 0.95} ${r * 0.22} ${-r * 0.6} 0 ${-r * 0.4} Z`} fill={j % 2 ? f1 : lt(f1, 0.25)} transform={`translate(${x} ${y}) rotate(${j * 20})`} />
          ))
        : <circle cx={x} cy={y} r={r} fill={f1} />}
      <circle cx={x} cy={y} r={r * (detail ? 0.45 : 0.42)} fill={detail ? url(`${id}seed`) : "#5a3410"} />
    </g>
  );
  const heads: ReactNode[] = [];
  // Far: a carpet of tiny heads; mid: hundreds of small ones; near: big detailed flowers
  for (let i = 0; i < 420; i++) {
    const t = R(i, 3);
    const y = 142 + t * 22;
    heads.push(<circle key={`f${i}`} cx={R(i, 4) * W} cy={y} r={0.9 + t * 1.3} fill={i % 5 ? f1 : f2} />);
  }
  for (let i = 0; i < 170; i++) {
    const t = R(i, 5);
    const y = 164 + t * 26;
    heads.push(head(R(i, 6) * W, y, 2.6 + t * 3.4, 1000 + i, false));
  }
  const near: [number, number, number][] = [[80, 176, 15], [210, 190, 18], [330, 182, 13], [470, 196, 17], [600, 184, 14], [720, 194, 18], [850, 180, 15], [960, 192, 16], [140, 206, 12], [540, 210, 12], [800, 210, 12]];
  return (
    <>
      <Sky id={id} top={sky1} bottom={sky2} horizon={lt(sun, 0.4)} />
      <defs>
        <RG id={`${id}seed`} cx={0.4} cy={0.35} r={0.7} s={[[0, "#8a5a20"], [0.6, "#4a2a0a"], [1, "#2a1606"]]} />
        <LG id={`${id}lf`} s={[[0, "#8fd36a"], [1, "#2f6b1f"]]} />
      </defs>
      <Orb id={id} x={560} y={84} r={26} color={sun} rays />
      <CloudDefs id={id} color="#ffffff" shade={mix("#ffffff", sky1, 0.35)} />
      <g {...anim("sc-drift", 30)}>
        <Cloud id={id} x={320} y={76} s={0.8} seed={1} />
        <Cloud id={id} x={780} y={68} s={0.65} seed={3} />
      </g>
      <path d={hillPath(132, 12, 0.6, 2)} fill={mix(h1, sky2, 0.4)} />
      <g transform={`translate(780 ${hillY(780, 132, 12, 0.6, 2) + 4})`}>
        <path d="M-14 0 V-14 L-7 -21 H7 L14 -14 V0 Z" fill="#c43d42" />
        <path d="M-15 -14 L-7 -22 H7 L15 -14" fill="none" stroke="#fff" strokeWidth="1.2" />
        <rect x="18" y="-26" width="8" height="26" rx="4" fill="#c9ccd4" />
      </g>
      {[200, 240, 300].map((x, i) => (
        <g key={x} transform={`translate(${x} ${hillY(x, 132, 12, 0.6, 2) + 2})`}>
          <rect x="-1.2" y="-10" width="2.4" height="10" fill="#4a3a2a" />
          <circle cx="0" cy="-14" r={7 + i} fill="#5f9a3e" />
        </g>
      ))}
      <path d={hillPath(150, 8, 1.8, 2.4)} fill={h2} />
      {heads}
      {near.map(([x, y, r], i) => (
        <g key={`n${i}`} {...anim("sc-sway", 4 + (i % 3), -i * 0.6)}>
          {head(x, y, r, 5000 + i, true)}
        </g>
      ))}
      {[0, 1].map((i) => (
        <g key={i} {...anim("sc-flutter", 6 + i * 2, -i * 2)}>
          <g transform={`translate(${380 + i * 200} ${140 + i * 10})`}>
            <ellipse cx="0" cy="0" rx="4.4" ry="3.2" fill="#ffd23f" />
            <path d="M-1.4 -3 V3 M1.6 -3 V3" stroke="#2a1a0e" strokeWidth="1.2" />
            <g {...anim("sc-flap", 0.12)}>
              <ellipse cx="-1" cy="-4" rx="2.6" ry="3" fill="#fff" opacity="0.8" />
            </g>
          </g>
        </g>
      ))}
      {[0, 1].map((i) => (
        <Bird key={i} x={420 + i * 30} y={70 + i * 8} s={1} color="#3a4a5a" k={i} />
      ))}
      <Vignette id={id} strength={0.15} />
    </>
  );
}

