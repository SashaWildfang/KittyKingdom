"use client";

import { anim, Bird, Cloud, CloudDefs, dk, H, Hill, hillY, LG, lt, lum, Mist, mix, Orb, Pine, R, RG, RoundTree, Sky, Stars, url, Vignette, W } from "./scene-kit";
import type { Opts } from "./scenes-a";

// ============ Candy land ============
export function Candy({ p, id }: Opts) {
  const [sky1, sky2, cloud, c1, c2, c3, hill] = p;
  const lolly = (x: number, y: number, r: number, c: string, k: number) => (
    <g key={k} {...anim("sc-sway", 4 + k, -k)}>
      <rect x={x - 2.5} y={y} width="5" height={H - y} fill={url(`${id}stick`)} />
      <circle cx={x} cy={y} r={r} fill={c} />
      <g clipPath={`url(#${id}lc${k})`}>
        <g {...anim("sc-spin", 14 + k * 3)}>
          {Array.from({ length: 6 }, (_, i) => (
            <path key={i} d={`M${x} ${y} Q${x + r * 0.9} ${y - r * 0.2} ${x + r * 1.1} ${y + r * 0.9} L${x + r * 0.5} ${y + r * 1.2} Q${x + r * 0.5} ${y + r * 0.2} ${x} ${y} Z`} fill="#fff" opacity="0.75" transform={`rotate(${i * 60} ${x} ${y})`} />
          ))}
        </g>
      </g>
      <defs>
        <clipPath id={`${id}lc${k}`}>
          <circle cx={x} cy={y} r={r} />
        </clipPath>
      </defs>
      <circle cx={x} cy={y} r={r} fill={url(`${id}ball`)} />
      <ellipse cx={x - r * 0.38} cy={y - r * 0.42} rx={r * 0.28} ry={r * 0.16} fill="#fff" opacity="0.75" transform={`rotate(-30 ${x - r * 0.38} ${y - r * 0.42})`} />
      <circle cx={x} cy={y} r={r} fill="none" stroke={dk(c, 0.2)} strokeWidth="1.2" />
    </g>
  );
  const gumdrop = (x: number, base: number, w: number, h: number, c: string, k: number) => (
    <g key={k}>
      <ellipse cx={x} cy={base + 1} rx={w * 0.55} ry="4" fill="#000" opacity="0.18" />
      <path d={`M${x - w / 2} ${base} C${x - w / 2} ${base - h * 1.2} ${x + w / 2} ${base - h * 1.2} ${x + w / 2} ${base} Z`} fill={c} />
      <path d={`M${x - w / 2} ${base} C${x - w / 2} ${base - h * 1.2} ${x + w / 2} ${base - h * 1.2} ${x + w / 2} ${base} Z`} fill={url(`${id}gum`)} />
      <ellipse cx={x - w * 0.18} cy={base - h * 0.62} rx={w * 0.12} ry={h * 0.12} fill="#fff" opacity="0.7" />
      {Array.from({ length: 8 }, (_, i) => (
        <circle key={i} cx={x + (R(i, k + 3) - 0.5) * w * 0.7} cy={base - R(i, k + 4) * h * 0.7} r="0.9" fill="#fff" opacity="0.8" />
      ))}
    </g>
  );
  const cane = (x: number, base: number, h: number, k: number) => (
    <g key={k} {...anim("sc-sway", 5 + k, -k)}>
      <path d={`M${x} ${base} V${base - h} a10 10 0 0 0 -20 0`} fill="none" stroke="#fff" strokeWidth="7" strokeLinecap="round" />
      <path d={`M${x} ${base} V${base - h} a10 10 0 0 0 -20 0`} fill="none" stroke={c1} strokeWidth="7" strokeLinecap="round" strokeDasharray="5 5" />
      <path d={`M${x + 2} ${base} V${base - h}`} fill="none" stroke="#000" strokeWidth="2" opacity="0.15" />
      <path d={`M${x - 2} ${base} V${base - h} a8 8 0 0 0 -15 -2`} fill="none" stroke="#fff" strokeWidth="1.4" opacity="0.6" />
    </g>
  );
  return (
    <>
      <Sky id={id} top={sky1} bottom={sky2} horizon={lt(sky2, 0.4)} />
      <defs>
        <LG id={`${id}stick`} x2={1} y2={0} s={[[0, "#d9d9d9"], [0.4, "#ffffff"], [1, "#bdbdbd"]]} />
        <RG id={`${id}ball`} cx={0.35} cy={0.3} r={0.8} s={[[0, "#fff", 0.25], [0.5, "#fff", 0], [1, "#000", 0.3]]} />
        <RG id={`${id}gum`} cx={0.35} cy={0.25} r={0.9} s={[[0, "#fff", 0.3], [0.5, "#fff", 0], [1, "#000", 0.28]]} />
        <LG id={`${id}rain`} s={[[0, c1, 0.5], [0.33, c3, 0.5], [0.66, c2, 0.5], [1, c2, 0]]} />
        <LG id={`${id}frost`} s={[[0, lt(hill, 0.7)], [1, lt(hill, 0.35)]]} />
        <LG id={`${id}ging`} s={[[0, "#c47a3a"], [1, "#8a4d1f"]]} />
        <RG id={`${id}spark`} s={[[0, "#fff", 1], [1, "#fff", 0]]} />
      </defs>
      <CloudDefs id={id} color={cloud} shade={mix(cloud, c1, 0.3)} light="#ffffff" />
      {/* Soft rainbow */}
      <path d="M260 210 A240 180 0 0 1 740 210" fill="none" stroke={url(`${id}rain`)} strokeWidth="26" opacity="0.5" />
      <Orb id={id} x={640} y={82} r={20} color="#fff6c2" rays />
      <g {...anim("sc-drift", 20)}>
        <Cloud id={id} x={300} y={80} s={0.9} seed={1} />
        <Cloud id={id} x={520} y={70} s={0.7} seed={3} />
      </g>
      <g {...anim("sc-drift-r", 26)}>
        <Cloud id={id} x={780} y={90} s={1.05} seed={5} />
        <Cloud id={id} x={120} y={96} s={0.8} seed={7} />
      </g>
      {/* Frosted cupcake mountains */}
      {[[200, 150, 120, 70], [470, 150, 160, 90], [790, 150, 130, 74]].map(([x, base, w, h], i) => (
        <g key={i}>
          <path d={`M${x - w} ${base + 20} Q${x - w * 0.4} ${base - h} ${x} ${base - h} Q${x + w * 0.4} ${base - h} ${x + w} ${base + 20} Z`} fill={mix(hill, c2, 0.4)} />
          <path d={`M${x - w * 0.62} ${base - h * 0.42} Q${x - w * 0.3} ${base - h * 1.02} ${x} ${base - h} Q${x + w * 0.3} ${base - h * 1.02} ${x + w * 0.62} ${base - h * 0.42} q-12 10 -20 0 q-10 16 -22 2 q-12 12 -24 -2 q-12 14 -26 0 q-12 12 -24 0 q-12 18 -26 2 q-12 10 -22 -2 q-10 12 -20 0 Z`} fill={url(`${id}frost`)} />
          <circle cx={x} cy={base - h - 6} r="7" fill={c1} />
          <ellipse cx={x - 2} cy={base - h - 8} rx="2.4" ry="1.6" fill="#fff" opacity="0.7" />
          {Array.from({ length: 12 }, (_, k) => (
            <rect key={k} x={x + (R(k, i + 9) - 0.5) * w * 0.9} y={base - h * (0.5 + R(k, i + 10) * 0.45)} width="5" height="1.8" rx="0.9" fill={[c1, c2, c3][k % 3]} transform={`rotate(${R(k, i + 11) * 180} ${x} ${base - h * 0.7})`} />
          ))}
        </g>
      ))}
      <Hill id={id} k="h1" y={170} amp={8} seed={1.5} waves={3} color={hill} rim="#ffffff" rimOpacity={0.6} shade={0.15} />
      {/* Gingerbread house */}
      <g transform="translate(560 172)">
        <ellipse cx="0" cy="2" rx="40" ry="5" fill="#000" opacity="0.18" />
        <rect x="-26" y="-30" width="52" height="32" fill={url(`${id}ging`)} />
        <path d="M-32 -28 L0 -56 L32 -28 Z" fill={dk(c1, 0.1)} />
        <path d="M-34 -27 L0 -58 L34 -27" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M-30 -26 q4 6 8 0 q4 6 8 0 q4 6 8 0 q4 6 8 0 q4 6 8 0 q4 6 8 0 q4 6 8 0" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
        <rect x="-6" y="-14" width="12" height="16" rx="6" fill="#5a2d10" />
        <rect x="-20" y="-22" width="9" height="9" fill="#ffd166" {...anim("sc-flicker", 3)} />
        <rect x="11" y="-22" width="9" height="9" fill="#ffd166" {...anim("sc-flicker", 3.4, -1)} />
        <path d="M-20 -17.5 h9 M-15.5 -22 v9 M11 -17.5 h9 M15.5 -22 v9" stroke="#fff" strokeWidth="1.2" />
        {[-22, -10, 2, 14].map((x, i) => (
          <circle key={x} cx={x + 4} cy="-36" r="2.4" fill={[c2, c3, c1, c2][i]} />
        ))}
      </g>
      {gumdrop(300, 196, 46, 34, c2, 1)}
      {gumdrop(350, 202, 32, 24, c3, 2)}
      {gumdrop(680, 200, 40, 30, c1, 3)}
      {gumdrop(730, 204, 28, 20, c2, 4)}
      {lolly(250, 120, 26, c1, 1)}
      {lolly(430, 140, 20, c3, 2)}
      {lolly(800, 118, 28, c2, 3)}
      {cane(390, 210, 52, 1)}
      {cane(640, 214, 46, 2)}
      <path d={`M-20 206 Q250 196 500 206 T${W + 20} 204 V${H} H-20 Z`} fill={lt(hill, 0.25)} />
      {Array.from({ length: 18 }, (_, i) => (
        <g key={i} transform={`translate(${R(i, 31) * W} ${20 + R(i, 32) * 150})`}>
          <g {...anim("sc-twinkle", 2 + R(i, 33) * 2, -R(i, 34) * 3)}>
            <circle r="5" fill={url(`${id}spark`)} opacity="0.6" />
            <path d="M0 -5 L1 -1 L5 0 L1 1 L0 5 L-1 1 L-5 0 L-1 -1 Z" fill="#fff" />
          </g>
        </g>
      ))}
      <Vignette id={id} strength={0.18} />
    </>
  );
}

// ============ Desert ============
export function Desert({ p, id, stars }: Opts) {
  const [sky1, sky2, sun, d1, d2, d3, cactus] = p;
  const night = Boolean(stars);
  const dune = (x0: number, w: number, peakX: number, peakY: number, base: number, color: string, k: number) => (
    <g key={k}>
      <path d={`M${x0} ${base} C${x0 + w * 0.25} ${base - 4} ${peakX - w * 0.2} ${peakY + 2} ${peakX} ${peakY} C${peakX + w * 0.15} ${peakY - 1} ${x0 + w * 0.8} ${base - 6} ${x0 + w} ${base} V${H} H${x0} Z`} fill={url(`${id}dl${k}`)} />
      <path d={`M${peakX} ${peakY} C${peakX + w * 0.15} ${peakY - 1} ${x0 + w * 0.8} ${base - 6} ${x0 + w} ${base} V${H} L${peakX + w * 0.1} ${H} C${peakX + w * 0.02} ${base + 10} ${peakX - w * 0.1} ${peakY + (base - peakY) * 0.5} ${peakX} ${peakY} Z`} fill={dk(color, night ? 0.3 : 0.2)} opacity="0.85" />
      <path d={`M${peakX} ${peakY} C${peakX - w * 0.1} ${peakY + (base - peakY) * 0.5} ${peakX + w * 0.02} ${base + 10} ${peakX + w * 0.1} ${H}`} fill="none" stroke={lt(color, 0.35)} strokeWidth="1.2" opacity="0.7" />
      {Array.from({ length: 5 }, (_, i) => (
        <path key={i} d={`M${x0 + w * 0.08 + i * 12} ${base - 2 + i * 6} q${w * 0.12} -6 ${w * 0.28} -2`} fill="none" stroke={lt(color, 0.25)} strokeWidth="0.8" opacity="0.5" />
      ))}
      <defs>
        <LG id={`${id}dl${k}`} x1={0} y1={0} x2={0.3} y2={1} s={[[0, lt(color, night ? 0.05 : 0.2)], [1, dk(color, 0.12)]]} />
      </defs>
    </g>
  );
  const saguaro = (x: number, base: number, h: number, k: number, flower: boolean) => (
    <g key={k}>
      <ellipse cx={x + h * 0.4} cy={base} rx={h * 0.45} ry="3" fill="#000" opacity="0.2" />
      <g fill={url(`${id}cac`)}>
        <rect x={x - 7} y={base - h} width="14" height={h} rx="7" />
        <path d={`M${x - 6} ${base - h * 0.45} h-10 a7 7 0 0 1 -7 -7 v-${h * 0.26} a5.5 5.5 0 0 1 11 0 v${h * 0.16} h6 z`} />
        <path d={`M${x + 6} ${base - h * 0.6} h10 a7 7 0 0 0 7 -7 v-${h * 0.18} a5.5 5.5 0 0 0 -11 0 v${h * 0.08} h-6 z`} />
      </g>
      <path d={`M${x - 2.5} ${base - h + 6} V${base - 2} M${x + 2.5} ${base - h + 6} V${base - 2}`} stroke={dk(cactus, 0.35)} strokeWidth="0.8" opacity="0.7" />
      {flower ? (
        <g transform={`translate(${x} ${base - h - 1})`}>
          {[0, 72, 144, 216, 288].map((a) => (
            <ellipse key={a} cx="0" cy="-3" rx="2" ry="3.2" fill="#ff7eb6" transform={`rotate(${a})`} />
          ))}
          <circle r="1.6" fill="#ffd166" />
        </g>
      ) : null}
    </g>
  );
  return (
    <>
      <Sky id={id} top={sky1} bottom={sky2} horizon={mix(sky2, sun, 0.5)} />
      <defs>
        <LG id={`${id}cac`} x2={1} y2={0} s={[[0, dk(cactus, 0.35)], [0.45, lt(cactus, night ? 0 : 0.2)], [0.7, cactus], [1, dk(cactus, 0.45)]]} />
        <LG id={`${id}mesa`} x2={1} y2={0} s={[[0, lt(mix(d1, sky2, 0.4), 0.1)], [0.6, mix(d1, sky2, 0.45)], [1, dk(mix(d1, sky2, 0.4), 0.15)]]} />
        <LG id={`${id}haze`} s={[[0, sky2, 0], [1, lt(sky2, 0.2), 0.6]]} />
      </defs>
      {night ? <Stars n={90} top={130} seed={23} /> : null}
      <Orb id={id} x={620} y={night ? 84 : 92} r={night ? 22 : 34} color={sun} moon={night} rays={!night} />
      {/* Mesas on the horizon */}
      <path d="M150 140 L170 104 L250 102 L262 120 L300 122 L312 140 Z" fill={url(`${id}mesa`)} />
      <path d="M720 140 L736 112 L800 110 L812 126 L860 126 L874 140 Z" fill={url(`${id}mesa`)} />
      <path d="M170 104 L250 102 L252 106 L172 108 Z M736 112 L800 110 L802 114 L738 116 Z" fill={lt(d1, 0.3)} opacity="0.5" />
      <rect y="110" width={W} height="40" fill={url(`${id}haze`)} {...anim("sc-shimmer", 3)} />
      {dune(-60, 620, 300, 128, 168, d1, 1)}
      {dune(420, 640, 700, 122, 170, d1, 2)}
      {dune(-40, 560, 220, 158, 200, d2, 3)}
      {dune(380, 700, 610, 152, 204, d2, 4)}
      {saguaro(372, 180, 62, 1, !night)}
      {saguaro(668, 184, 44, 2, false)}
      {saguaro(820, 172, 30, 3, false)}
      {dune(-100, 1250, 520, 190, 226, d3, 5)}
      {/* Tumbleweed */}
      <g {...anim("sc-tumble", 11, -3)}>
        <g transform="translate(0 196)">
          <g {...anim("sc-spin", 1.6)}>
            {Array.from({ length: 10 }, (_, i) => (
              <ellipse key={i} cx="0" cy="0" rx="9" ry={3 + (i % 3)} fill="none" stroke={dk(d3, 0.35)} strokeWidth="0.9" transform={`rotate(${i * 18})`} />
            ))}
          </g>
        </g>
      </g>
      {night ? null : (
        <g transform="translate(470 70)">
          <g className="sc-spin sc-o0" style={{ animationDuration: "14s" }}>
            <path {...anim("sc-flap", 0.6)} d="M-10 -24 Q-5 -30 0 -24 Q5 -30 10 -24" fill="none" stroke={dk(sky1, 0.5)} strokeWidth="2" strokeLinecap="round" />
          </g>
        </g>
      )}
      <Vignette id={id} strength={night ? 0.4 : 0.22} />
    </>
  );
}

// ============ Underwater ============
export function Underwater({ p, id }: Opts) {
  const [w1, w2, ray, weed, co1, co2, bub] = p;
  const deep = lum(w1) < 0.15;
  const sand = mix("#e8d3a2", w2, deep ? 0.7 : 0.35);
  const fish = (k: number, y: number, s: number, c: string, flip: boolean, dur: number) => (
    <g key={k} {...anim(flip ? "sc-swim-r" : "sc-swim", dur, -k * 5)}>
      <g transform={`translate(0 ${y}) scale(${s})`}>
        <g {...anim("sc-bob", 2 + k * 0.3)}>
          <path d="M-12 0 L-20 -7 Q-18 0 -20 7 Z" fill={dk(c, 0.15)} {...anim("sc-flick", 0.5)} />
          <ellipse cx="0" cy="0" rx="13" ry="7.5" fill={c} />
          <ellipse cx="0" cy="0" rx="13" ry="7.5" fill={url(`${id}fish`)} />
          <path d="M-3 -7 Q2 -12 7 -6" fill={dk(c, 0.2)} />
          <path d="M-4 -7 Q-6 0 -4 7 M2 -7.5 Q0 0 2 7.5" stroke="#fff" strokeWidth="1.6" opacity="0.7" fill="none" />
          <circle cx="7" cy="-1.5" r="2.2" fill="#fff" />
          <circle cx="7.5" cy="-1.5" r="1.2" fill="#111" />
          <circle cx="8" cy="-2" r="0.4" fill="#fff" />
        </g>
      </g>
    </g>
  );
  const jelly = (x: number, y: number, s: number, k: number) => (
    <g key={k} transform={`translate(${x} ${y}) scale(${s})`}>
      <g {...anim("sc-jelly", 3.2 + k * 0.5, -k)}>
        {deep ? <circle cx="0" cy="0" r="30" fill={url(`${id}jg`)} /> : null}
        {[-7, -3, 1, 5, 8].map((tx, i) => (
          <path key={i} d={`M${tx} 4 q-4 8 0 16 t0 16`} fill="none" stroke={lt(bub, 0.3)} strokeWidth="1.1" opacity="0.6" {...anim("sc-sway", 1.6 + i * 0.2, -i * 0.3)} />
        ))}
        <path d="M-12 4 C-12 -12 12 -12 12 4 Q6 1 0 4 Q-6 1 -12 4 Z" fill={url(`${id}bell`)} />
        <path d="M-7 -4 Q-2 -9 4 -6" stroke="#fff" strokeWidth="1.2" fill="none" opacity="0.6" />
      </g>
    </g>
  );
  return (
    <>
      <Sky id={id} top={w1} bottom={w2} />
      <defs>
        <LG id={`${id}ray`} s={[[0, ray, deep ? 0.18 : 0.35], [1, ray, 0]]} />
        <LG id={`${id}sand`} s={[[0, lt(sand, 0.1)], [1, dk(sand, 0.3)]]} />
        <LG id={`${id}fish`} s={[[0, "#000", 0.3], [0.5, "#fff", 0.05], [1, "#fff", 0.35]]} />
        <RG id={`${id}bell`} cx={0.5} cy={0.3} r={0.7} s={[[0, lt(bub, 0.6), 0.9], [1, co2, 0.55]]} />
        <RG id={`${id}jg`} s={[[0, bub, 0.45], [1, bub, 0]]} />
        <RG id={`${id}brain`} cx={0.4} cy={0.3} r={0.8} s={[[0, lt(co2, 0.3)], [0.6, co2], [1, dk(co2, 0.4)]]} />
        <RG id={`${id}bubg`} cx={0.35} cy={0.3} r={0.7} s={[[0, "#fff", 0.8], [0.4, bub, 0.15], [0.9, bub, 0.3], [1, bub, 0.7]]} />
        <LG id={`${id}tube`} x2={1} y2={0} s={[[0, dk(mix(co2, co1, 0.4), 0.3)], [0.4, lt(mix(co2, co1, 0.4), 0.2)], [1, dk(mix(co2, co1, 0.4), 0.4)]]} />
        <LG id={`${id}kelp`} x2={1} y2={0} s={[[0, dk(weed, 0.3)], [0.5, lt(weed, 0.15)], [1, dk(weed, 0.3)]]} />
      </defs>
      {/* Rippling light at the surface */}
      <g {...anim("sc-slide", 8, 0, { "--dx": "-80px" })} opacity={deep ? 0.25 : 0.55}>
        {[6, 14, 22].map((y, i) => (
          <path key={i} d={`M-80 ${y} ${Array.from({ length: 28 }, (_, k) => `q20 ${k % 2 ? 4 : -4} 40 0`).join(" ")}`} fill="none" stroke={lt(ray, 0.4)} strokeWidth={2 - i * 0.5} opacity={0.6 - i * 0.15} />
        ))}
      </g>
      {[300, 420, 520, 640, 760].map((x, i) => (
        <path key={x} d={`M${x} -10 L${x + 40} -10 L${x + 110 + i * 6} ${H} L${x + 30} ${H} Z`} fill={url(`${id}ray`)} {...anim("sc-ray", 5 + i * 1.3, -i)} />
      ))}
      {/* Far reef silhouettes */}
      <path d={`M-20 170 Q80 140 160 160 T340 150 T520 162 T700 146 T880 158 T${W + 20} 150 V${H} H-20 Z`} fill={mix(w2, w1, 0.35)} opacity="0.8" />
      {Array.from({ length: 30 }, (_, i) => (
        <circle key={i} cx={R(i, 201) * W} cy={R(i, 202) * H} r={0.6 + R(i, 203)} fill={deep ? bub : "#fff"} opacity={deep ? 0.7 : 0.35} {...anim(deep ? "sc-tw" : "sc-firefly", 3 + R(i, 204) * 4, -R(i, 205) * 5)} />
      ))}
      {jelly(330, 104, 1.2, 1)}
      {jelly(700, 92, 0.9, 2)}
      {deep ? jelly(540, 128, 0.7, 3) : null}
      {fish(1, 118, 1.4, co1, false, 16)}
      {fish(2, 152, 1.1, co2, true, 20)}
      {fish(3, 96, 0.9, lt(co1, 0.2), true, 24)}
      {/* A small school */}
      <g {...anim("sc-swim", 30, -12)}>
        {Array.from({ length: 7 }, (_, i) => (
          <g key={i} transform={`translate(${(i % 4) * 12} ${110 + Math.floor(i / 4) * 8 + (i % 2) * 3})`}>
            <ellipse rx="4" ry="1.8" fill={lt(bub, 0.2)} opacity="0.85" />
            <path d="M-4 0 L-7 -2 L-7 2 Z" fill={lt(bub, 0.2)} opacity="0.85" />
          </g>
        ))}
      </g>
      <path d={`M-20 196 Q200 184 420 194 T${W + 20} 190 V${H} H-20 Z`} fill={url(`${id}sand`)} />
      {Array.from({ length: 8 }, (_, i) => (
        <path key={i} d={`M${60 + i * 120} ${204 + (i % 2) * 6} q20 -4 40 0`} fill="none" stroke={dk(sand, 0.2)} strokeWidth="1" opacity="0.5" />
      ))}
      {/* Kelp */}
      {Array.from({ length: 9 }, (_, i) => {
        const x = 40 + i * 118 + R(i, 101) * 30;
        const h = 90 + R(i, 102) * 70;
        return (
          <g key={i} {...anim("sc-sway", 3.5 + R(i, 103) * 2, -R(i, 104) * 3)}>
            <path d={`M${x - 6} ${H} C${x - 24} ${H - h * 0.3} ${x + 14} ${H - h * 0.6} ${x - 2} ${H - h} C${x + 16} ${H - h * 0.6} ${x - 6} ${H - h * 0.3} ${x + 6} ${H} Z`} fill={url(`${id}kelp`)} />
            <path d={`M${x} ${H} C${x - 10} ${H - h * 0.3} ${x + 10} ${H - h * 0.6} ${x - 2} ${H - h}`} fill="none" stroke={lt(weed, 0.3)} strokeWidth="0.8" opacity="0.6" />
            {[0.3, 0.5, 0.7].map((t, k) => (
              <ellipse key={k} cx={x + (k % 2 ? 9 : -9)} cy={H - h * t} rx="11" ry="4.5" fill={weed} opacity="0.85" transform={`rotate(${k % 2 ? -30 : 30} ${x} ${H - h * t})`} />
            ))}
          </g>
        );
      })}
      {/* Coral: branching, brain and a fan */}
      {[[290, 0], [720, 1]].map(([x, k]) => (
        <g key={k} strokeLinecap="round" fill="none">
          <path d={`M${x} ${H} v-26 M${x} ${H - 14} l-14 -16 M${x} ${H - 18} l14 -18 M${x - 14} ${H - 30} l-6 -10 M${x + 14} ${H - 36} l8 -9`} stroke={dk(co1, 0.3)} strokeWidth="8" />
          <path d={`M${x} ${H} v-26 M${x} ${H - 14} l-14 -16 M${x} ${H - 18} l14 -18 M${x - 14} ${H - 30} l-6 -10 M${x + 14} ${H - 36} l8 -9`} stroke={co1} strokeWidth="5" transform="translate(-1 -1)" />
          <path d={`M${x - 15} ${H - 31} l-5 -8 M${x + 13} ${H - 37} l7 -8`} stroke={lt(co1, 0.4)} strokeWidth="1.6" transform="translate(-1 -1)" />
        </g>
      ))}
      <g>
        <ellipse cx="460" cy="206" rx="26" ry="16" fill={url(`${id}brain`)} />
        <path d="M440 204 q5 -8 10 0 t10 0 t10 0 t10 0 M444 212 q5 -6 10 0 t10 0 t10 0" fill="none" stroke={dk(co2, 0.35)} strokeWidth="1.1" />
      </g>
      <g {...anim("sc-sway", 5)}>
        {Array.from({ length: 9 }, (_, i) => (
          <path key={i} d={`M600 ${H} L${572 + i * 7} ${H - 46 + Math.abs(i - 4) * 3}`} stroke={mix(co2, co1, 0.5)} strokeWidth="1.4" opacity="0.85" />
        ))}
        <path d="M572 174 Q600 160 628 174" fill="none" stroke={lt(mix(co2, co1, 0.5), 0.3)} strokeWidth="1" />
      </g>
      <path d="M380 210 l3 -7 l3 7 l7 1 l-6 4 l2 7 l-6 -4 l-6 4 l2 -7 l-6 -4 Z" fill={co1} />
      {/* Tube sponges and anemones */}
      {[[170, 0], [860, 1]].map(([x, k]) => (
        <g key={k}>
          {[[-8, 34], [0, 46], [9, 28]].map(([dx, h], i) => (
            <g key={i}>
              <rect x={x + dx - 4} y={H - h} width="8" height={h} rx="3" fill={url(`${id}tube`)} />
              <ellipse cx={x + dx} cy={H - h} rx="4" ry="1.6" fill={dk(co2, 0.5)} />
            </g>
          ))}
        </g>
      ))}
      {[[530, 0], [800, 1], [240, 2]].map(([x, k]) => (
        <g key={k} transform={`translate(${x} ${H - 8})`}>
          <ellipse cx="0" cy="2" rx="9" ry="5" fill={dk(co1, 0.2)} />
          {Array.from({ length: 9 }, (_, i) => (
            <path key={i} d={`M${(i - 4) * 2} 0 q${(i - 4) * 2} -8 ${(i - 4) * 3.4} -16`} fill="none" stroke={i % 2 ? lt(co1, 0.3) : co1} strokeWidth="2.2" strokeLinecap="round" {...anim("sc-sway", 2 + (i % 3) * 0.4, -i * 0.2)} />
          ))}
        </g>
      ))}
      <ellipse cx="820" cy="210" rx="20" ry="13" fill={url(`${id}brain`)} />
      <path d="M804 208 q5 -7 10 0 t10 0 t10 0" fill="none" stroke={dk(co2, 0.35)} strokeWidth="1.1" />
      {Array.from({ length: 18 }, (_, i) => (
        <circle key={i} cx={R(i, 111) * W} cy={H + 6} r={2 + R(i, 112) * 4} fill={url(`${id}bubg`)} {...anim("sc-bubble", 6 + R(i, 113) * 5, -R(i, 114) * 9)} />
      ))}
      <Vignette id={id} strength={deep ? 0.55 : 0.35} />
    </>
  );
}

// ============ Retro synthwave ============
export function Retro({ p, id }: Opts) {
  const [sky1, sky2, sun1, sun2, grid, ground, mtn] = p;
  const hz = 130;
  const lines = Array.from({ length: 10 }, (_, i) => hz + 2 + Math.pow(i + 1, 1.9) * 1.05);
  return (
    <>
      <Sky id={id} top={sky1} bottom={sky2} horizon={mix(sky2, sun2, 0.6)} glowY={0.6} />
      <defs>
        <LG id={`${id}sun`} s={[[0, sun1], [1, sun2]]} />
        <mask id={`${id}cut`}>
          <rect width={W} height={H} fill="#fff" />
          <g {...anim("sc-stripe", 3)}>
            {Array.from({ length: 9 }, (_, i) => (
              <rect key={i} x="0" y={104 + i * 7} width={W} height={1 + i * 0.6} fill="#000" />
            ))}
          </g>
        </mask>
        <RG id={`${id}sg`} s={[[0, sun2, 0.5], [1, sun2, 0]]} />
        <LG id={`${id}mt`} s={[[0, mix(ground, mtn, 0.5)], [1, ground]]} />
        <LG id={`${id}gnd`} s={[[0, mix(ground, grid, 0.25)], [0.15, ground], [1, dk(ground, 0.3)]]} />
        <filter id={`${id}gl`} x="-20%" y="-50%" width="140%" height="200%">
          <feGaussianBlur stdDeviation="1.6" />
        </filter>
      </defs>
      <Stars n={50} top={90} seed={29} />
      <circle cx="500" cy="116" r="130" fill={url(`${id}sg`)} {...anim("sc-breathe", 5)} />
      <circle cx="500" cy="116" r="64" fill={url(`${id}sun`)} mask={`url(#${id}cut)`} />
      {/* Faceted wireframe mountains */}
      {[
        [[-20, hz], [60, 100], [110, 116], [170, 84], [240, hz]],
        [[180, hz], [250, 106], [300, 92], [360, hz]],
        [[640, hz], [700, 96], [760, 112], [820, 80], [900, 108], [960, 92], [1020, hz]],
      ].map((pts, i) => (
        <g key={i}>
          <polygon points={pts.map((q) => q.join(",")).join(" ")} fill={url(`${id}mt`)} />
          {pts.slice(1, -1).map(([x, y], k) => (
            <path key={k} d={`M${x} ${y} L${x + 8} ${hz}`} stroke={mtn} strokeWidth="0.8" opacity="0.5" />
          ))}
          <polyline points={pts.map((q) => q.join(",")).join(" ")} fill="none" stroke={mtn} strokeWidth="2.6" filter={url(`${id}gl`)} />
          <polyline points={pts.map((q) => q.join(",")).join(" ")} fill="none" stroke={lt(mtn, 0.5)} strokeWidth="1" />
        </g>
      ))}
      <rect y={hz} width={W} height={H - hz} fill={url(`${id}gnd`)} />
      <g stroke={grid} strokeWidth="1.3">
        {Array.from({ length: 31 }, (_, i) => (
          <line key={i} x1="500" y1={hz} x2={-1000 + i * 100} y2={H + 30} opacity="0.8" />
        ))}
        {lines.map((y, i) => (
          <line key={i} x1="0" x2={W} y1={y} y2={y} opacity={0.3 + i * 0.07} {...anim("sc-gridline", 1.4, 0, { "--dy": `${(lines[i + 1] ?? y + (y - lines[i - 1]) * 1.2) - y}px` })} />
        ))}
      </g>
      <line x1="0" x2={W} y1={hz} y2={hz} stroke={lt(grid, 0.4)} strokeWidth="2" />
      <line x1="0" x2={W} y1={hz} y2={hz} stroke={grid} strokeWidth="6" filter={url(`${id}gl`)} opacity="0.8" />
      {/* Palms */}
      {[[250, 1], [760, -1]].map(([x, f]) => (
        <g key={x} transform={`translate(${x} ${hz + 50}) scale(${f} 1)`}>
          <path d="M0 0 Q6 -30 -4 -70" fill="none" stroke={dk(sky1, 0.3)} strokeWidth="4" strokeLinecap="round" />
          <g {...anim("sc-sway", 4)}>
            {[-150, -115, -80, -45, -10, 25].map((a) => (
              <path key={a} d="M-4 -70 q14 -10 34 4 q-16 -4 -34 -4" fill={dk(sky1, 0.3)} transform={`rotate(${a + 70} -4 -70)`} />
            ))}
          </g>
        </g>
      ))}
      {[0, 1].map((i) => (
        <g key={i} {...anim("sc-shoot", 8 + i * 3, -3 - i * 4)}>
          <line x1="0" y1="0" x2="50" y2="14" stroke={lt(sun1, 0.5)} strokeWidth="1.6" strokeLinecap="round" />
        </g>
      ))}
      <Vignette id={id} strength={0.4} />
    </>
  );
}

// ============ Clouds ============
export function Clouds({ p, id }: Opts) {
  const [sky1, sky2, sun, c1, c2, c3] = p;
  const storm = lum(sky1) < 0.25;
  const balloon = (x: number, y: number, s: number, a: string, b: string, k: number) => (
    <g key={k} transform={`translate(${x} ${y}) scale(${s})`}>
      <g {...anim("sc-float", 7 + k * 2, -k * 2)}>
        <path d="M-6 26 L-4 36 M6 26 L4 36" stroke="#6b4423" strokeWidth="0.8" />
        <rect x="-5" y="35" width="10" height="7" rx="1.5" fill="#8a5a2b" />
        <rect x="-5" y="35" width="10" height="2" fill="#a8743f" />
        <path d="M0 -26 C20 -26 24 -4 14 12 L6 26 L-6 26 L-14 12 C-24 -4 -20 -26 0 -26 Z" fill={a} />
        <path d="M0 -26 C8 -26 9 -4 5 12 L2 26 L-2 26 L-5 12 C-9 -4 -8 -26 0 -26 Z" fill={b} />
        <path d="M0 -26 C20 -26 24 -4 14 12 L6 26 L-6 26 L-14 12 C-24 -4 -20 -26 0 -26 Z" fill={url(`${id}bal`)} />
      </g>
    </g>
  );
  return (
    <>
      <Sky id={id} top={sky1} bottom={sky2} horizon={mix(sky2, sun, 0.3)} />
      <defs>
        <RG id={`${id}bal`} cx={0.3} cy={0.3} r={0.8} s={[[0, "#fff", 0.35], [0.5, "#fff", 0], [1, "#000", 0.35]]} />
        <LG id={`${id}bolt`} s={[[0, "#fff"], [1, lt(sun, 0.4)]]} />
      </defs>
      {storm ? null : <Orb id={id} x={640} y={88} r={24} color={sun} rays />}
      {storm ? (
        <g {...anim("sc-flash", 6, -1)}>
          <rect width={W} height={H} fill={lt(sun, 0.4)} opacity="0.3" />
          <path d="M560 60 L540 100 L556 100 L530 150 L580 92 L562 92 L584 60 Z" fill={url(`${id}bolt`)} />
        </g>
      ) : null}
      <CloudDefs id={`${id}a`} color={c3} shade={mix(c3, sky1, storm ? 0.5 : 0.25)} light={lt(c3, 0.5)} />
      <CloudDefs id={`${id}b`} color={c2} shade={mix(c2, sky1, storm ? 0.55 : 0.3)} light={lt(c2, 0.6)} />
      <CloudDefs id={`${id}c`} color={c1} shade={mix(c1, sky1, storm ? 0.5 : 0.28)} light={storm ? lt(c1, 0.3) : "#ffffff"} />
      <g {...anim("sc-drift", 34)}>
        <Cloud id={`${id}a`} x={120} y={84} s={1.1} seed={1} opacity={0.85} />
        <Cloud id={`${id}a`} x={420} y={74} s={0.9} seed={2} opacity={0.85} />
        <Cloud id={`${id}a`} x={860} y={80} s={1} seed={3} opacity={0.85} />
      </g>
      {storm
        ? null
        : [balloon(330, 110, 0.9, "#ff6b6b", "#ffd166", 1), balloon(760, 100, 0.7, "#4dc3ff", "#ffffff", 2), balloon(520, 120, 0.5, "#b46cff", "#ffe066", 3)]}
      <g {...anim("sc-drift-r", 26)}>
        <Cloud id={`${id}b`} x={220} y={130} s={1.6} seed={4} />
        <Cloud id={`${id}b`} x={600} y={138} s={1.4} seed={5} />
        <Cloud id={`${id}b`} x={940} y={124} s={1.5} seed={6} />
      </g>
      <g {...anim("sc-drift", 20)}>
        <Cloud id={`${id}c`} x={40} y={196} s={2.3} seed={7} />
        <Cloud id={`${id}c`} x={330} y={204} s={2.5} seed={8} />
        <Cloud id={`${id}c`} x={620} y={198} s={2.2} seed={9} />
        <Cloud id={`${id}c`} x={900} y={206} s={2.4} seed={10} />
      </g>
      {storm
        ? Array.from({ length: 60 }, (_, i) => (
            <line key={i} x1={R(i, 81) * W} y1={-20} x2={R(i, 81) * W - 5} y2={-4} stroke={lt(c1, 0.4)} strokeWidth="1" opacity="0.5" {...anim("sc-rain", 0.7 + R(i, 82) * 0.4, -R(i, 83) * 2)} />
          ))
        : [0, 1, 2].map((i) => <Bird key={i} x={440 + i * 22} y={92 + (i % 2) * 8} s={1} color={dk(sky1, 0.4)} k={i} />)}
      <Vignette id={id} strength={storm ? 0.45 : 0.18} />
    </>
  );
}

// ============ Meadow (wildflowers / lavender / sunflowers) ============
export function Meadow({ p, id, v }: Opts) {
  const [sky1, sky2, sun, h1, h2, f1, f2] = p;
  const kind = v ?? "wild";
  const treeC = kind === "lavender" ? "#5f8f4e" : dk(h1, 0.1);
  const daisy = (x: number, y: number, r: number, c: string, k: number) => (
    <g key={k} {...anim("sc-sway", 3 + R(k, 3) * 2, -R(k, 4) * 3)}>
      <path d={`M${x} ${y} q${(R(k, 5) - 0.5) * 6} ${r * 2} 0 ${r * 4}`} stroke={dk(h2, 0.3)} strokeWidth="1" fill="none" />
      {[0, 60, 120, 180, 240, 300].map((a) => (
        <ellipse key={a} cx={x} cy={y - r * 0.7} rx={r * 0.42} ry={r * 0.75} fill={c} transform={`rotate(${a} ${x} ${y})`} />
      ))}
      <circle cx={x} cy={y} r={r * 0.42} fill="#ffcf4d" />
      <circle cx={x - r * 0.12} cy={y - r * 0.12} r={r * 0.16} fill="#fff3b0" />
    </g>
  );
  const sunflower = (x: number, y: number, r: number, k: number) => (
    <g key={k} {...anim("sc-sway", 4 + R(k, 3) * 2, -R(k, 4) * 3)}>
      <path d={`M${x} ${y} Q${x + 3} ${y + r * 3} ${x} ${H + 10}`} stroke={dk(h2, 0.25)} strokeWidth={r * 0.18} fill="none" />
      <path d={`M${x} ${y + r * 2.4} q${r * 1.2} -${r * 0.6} ${r * 1.6} ${r * 0.2} q-${r * 0.8} ${r * 0.4} -${r * 1.6} -${r * 0.2} Z`} fill={dk(h2, 0.1)} />
      {Array.from({ length: 14 }, (_, i) => (
        <ellipse key={i} cx={x} cy={y - r * 0.85} rx={r * 0.26} ry={r * 0.6} fill={i % 2 ? f1 : f2} transform={`rotate(${i * (360 / 14)} ${x} ${y})`} />
      ))}
      <circle cx={x} cy={y} r={r * 0.55} fill="#5a3410" />
      <circle cx={x} cy={y} r={r * 0.55} fill={url(`${id}seed`)} />
    </g>
  );
  // A row of round lavender bushes: a dashed fat stroke, shaded underside, sunlit tips
  const lavRow = (k: number, y: number, size: number) => {
    const d = `M-40 ${y} Q${W * 0.25} ${y - size * 0.6} ${W / 2} ${y} T${W + 40} ${y}`;
    const dash = `${size * 1.1} ${size * 0.55}`;
    return (
      <g key={k}>
        <path d={d} fill="none" stroke={dk(h2, 0.25)} strokeWidth={size * 1.5} transform={`translate(0 ${size * 0.5})`} />
        <path d={d} fill="none" stroke={dk(f1, 0.35)} strokeWidth={size * 1.4} strokeDasharray={dash} strokeLinecap="round" transform={`translate(0 ${size * 0.25})`} />
        <path d={d} fill="none" stroke={f1} strokeWidth={size * 1.1} strokeDasharray={dash} strokeLinecap="round" />
        <path d={d} fill="none" stroke={lt(f2, 0.2)} strokeWidth={size * 0.45} strokeDasharray={dash} strokeLinecap="round" transform={`translate(-${size * 0.12} -${size * 0.3})`} opacity="0.85" />
      </g>
    );
  };
  return (
    <>
      <Sky id={id} top={sky1} bottom={sky2} horizon={mix(sky2, sun, 0.35)} />
      <defs>
        <LG id={`${id}trunk`} x2={1} y2={0} s={[[0, "#3a2414"], [0.4, "#6b4423"], [1, "#2a1a0e"]]} />
        <RG id={`${id}leaf`} cx={0.35} cy={0.3} r={0.75} s={[[0, lt(treeC, 0.3)], [0.55, treeC], [1, dk(treeC, 0.4)]]} />
        <RG id={`${id}seed`} cx={0.4} cy={0.35} r={0.6} s={[[0, "#8a5a2b", 0.8], [1, "#2a1606", 0.6]]} />
        <LG id={`${id}mill`} x2={1} y2={0} s={[[0, "#f4ece0"], [0.6, "#e0d4c0"], [1, "#b8a890"]]} />
      </defs>
      <Orb id={id} x={420} y={86} r={24} color={sun} rays />
      <CloudDefs id={id} color="#ffffff" shade={mix("#ffffff", sky1, 0.3)} light="#ffffff" />
      <g {...anim("sc-drift", 28)}>
        <Cloud id={id} x={620} y={76} s={0.8} seed={1} />
        <Cloud id={id} x={860} y={70} s={0.6} seed={2} opacity={0.85} />
        <Cloud id={id} x={180} y={74} s={0.7} seed={3} opacity={0.9} />
      </g>
      <Hill id={id} k="h0" y={138} amp={10} seed={0.6} waves={2} color={mix(h1, sky2, 0.45)} />
      {/* Windmill on the far hill */}
      <g transform={`translate(640 ${hillY(640, 138, 10, 0.6, 2) + 2})`}>
        <path d="M-8 0 L-5 -38 L5 -38 L8 0 Z" fill={url(`${id}mill`)} />
        <path d="M-7 -38 L0 -48 L7 -38 Z" fill="#9b4a3a" />
        <rect x="-2" y="-10" width="4" height="10" fill="#6b4423" />
        <g transform="translate(0 -40)">
          <g {...anim("sc-spin", 9)}>
            {[0, 90, 180, 270].map((a) => (
              <g key={a} transform={`rotate(${a})`}>
                <rect x="-1" y="-26" width="2" height="26" fill="#6b4423" />
                <rect x="1" y="-24" width="6" height="18" fill="#f4ece0" stroke="#b8a890" strokeWidth="0.6" />
              </g>
            ))}
            <circle r="2.4" fill="#6b4423" />
          </g>
        </g>
      </g>
      {[200, 260, 820, 880].map((x, i) => (
        <RoundTree key={x} id={id} x={x} base={hillY(x, 138, 10, 0.6, 2) + 6} h={36 + (i % 2) * 10} seed={i} />
      ))}
      <Hill id={id} k="h1" y={160} amp={12} seed={1.6} waves={2.4} color={h1} rim={lt(h1, 0.4)} rimOpacity={0.6} />
      {kind === "lavender" ? (
        <g>
          <rect y="160" width={W} height="60" fill={dk(h2, 0.1)} />
          {[164, 170, 177, 186, 197, 210].map((y, k) => lavRow(k, y, 2.4 + k * 1.9))}
        </g>
      ) : (
        <Hill id={id} k="h2" y={196} amp={8} seed={2.8} waves={3} color={h2} rim={lt(h2, 0.35)} rimOpacity={0.5} />
      )}
      {kind === "lavender"
        ? Array.from({ length: 26 }, (_, i) => {
            const x = R(i, 131) * W;
            const y = 190 + R(i, 132) * 20;
            return (
              <g key={i} {...anim("sc-sway", 3 + R(i, 133) * 2, -R(i, 134) * 3)}>
                <path d={`M${x} ${y + 30} Q${x + 2} ${y + 10} ${x} ${y}`} stroke={dk(h2, 0.2)} strokeWidth="1.2" fill="none" />
                {Array.from({ length: 6 }, (_, k) => (
                  <ellipse key={k} cx={x + (k % 2 ? 1.8 : -1.8)} cy={y - k * 4} rx="2.4" ry="3.2" fill={k % 2 ? f1 : f2} />
                ))}
              </g>
            );
          })
        : kind === "sunflower"
          ? [sunflower(280, 168, 13, 1), sunflower(350, 176, 10, 2), sunflower(450, 160, 15, 3), sunflower(560, 172, 11, 4), sunflower(650, 162, 14, 5), sunflower(730, 176, 10, 6), sunflower(180, 178, 9, 7), sunflower(840, 170, 12, 8)]
          : Array.from({ length: 60 }, (_, i) => {
              const x = R(i, 121) * W;
              const y = 168 + R(i, 122) * 40;
              return daisy(x, y, 2.6 + R(i, 125) * 2.4 + (y - 168) * 0.06, i % 3 === 0 ? "#ffffff" : i % 2 ? f1 : f2, i);
            })}
      {/* Grass blades in front */}
      {Array.from({ length: 70 }, (_, i) => {
        const x = R(i, 141) * W;
        const h = 8 + R(i, 142) * 14;
        return <path key={i} d={`M${x} ${H} q${(R(i, 143) - 0.5) * 8} ${-h / 2} ${(R(i, 144) - 0.5) * 10} ${-h}`} stroke={dk(h2, 0.2 + R(i, 145) * 0.2)} strokeWidth="1.4" fill="none" />;
      })}
      {/* Butterflies and a bee */}
      {[0, 1].map((i) => (
        <g key={i} {...anim("sc-flutter", 9 + i * 3, -i * 4)}>
          <g transform={`translate(${380 + i * 200} ${110 + i * 14})`}>
            <g {...anim("sc-flap", 0.25)}>
              <path d="M0 0 C-8 -10 -12 -2 -8 2 C-11 6 -5 9 0 2 Z" fill={i ? f1 : "#ff9a3c"} />
              <path d="M0 0 C8 -10 12 -2 8 2 C11 6 5 9 0 2 Z" fill={i ? f1 : "#ff9a3c"} />
              <path d="M-7 -4 Q-5 -2 -3 -3 M7 -4 Q5 -2 3 -3" stroke="#000" strokeWidth="0.6" opacity="0.3" fill="none" />
            </g>
            <ellipse cx="0" cy="1" rx="0.9" ry="3.2" fill="#2a1a0e" />
          </g>
        </g>
      ))}
      <g {...anim("sc-flutter", 6, -2)}>
        <g transform="translate(520 140)">
          <ellipse cx="0" cy="0" rx="4.5" ry="3.2" fill="#ffd23f" />
          <path d="M-1.5 -3 V3 M1.5 -3 V3" stroke="#2a1a0e" strokeWidth="1.2" />
          <g {...anim("sc-flap", 0.12)}>
            <ellipse cx="-1" cy="-4" rx="2.5" ry="3" fill="#fff" opacity="0.75" />
            <ellipse cx="2" cy="-4" rx="2.5" ry="3" fill="#fff" opacity="0.75" />
          </g>
        </g>
      </g>
      <Vignette id={id} strength={0.2} />
    </>
  );
}

// ============ Snowy village ============
export function Village({ p, id }: Opts) {
  const [sky1, sky2, snowC, house, roof, win, tree] = p;
  const home = (x: number, w: number, h: number, k: number, steeple = false) => {
    const base = 186;
    const top = base - h;
    const side = w * 0.32;
    const peak = top - w * 0.42;
    return (
      <g key={k}>
        <ellipse cx={x + w / 2} cy={base + 4} rx={w * 1.1} ry="9" fill={url(`${id}spill`)} {...anim("sc-flicker", 4 + k, -k)} />
        <path d={`M${x + w} ${top} L${x + w + side} ${top - 6} L${x + w + side} ${base - 4} L${x + w} ${base} Z`} fill={dk(house, 0.35)} />
        <rect x={x} y={top} width={w} height={h} fill={url(`${id}wall`)} />
        <path d={`M${x - 3} ${top + 1} L${x + w / 2} ${peak} L${x + w + 3} ${top + 1} Z`} fill={url(`${id}wall`)} />
        <path d={`M${x + w / 2} ${peak} L${x + w / 2 + side} ${peak - 6} L${x + w + side + 4} ${top - 5} L${x + w + 4} ${top + 2} Z`} fill={roof} />
        <path d={`M${x + w / 2} ${peak} L${x + w / 2 + side} ${peak - 6} L${x + w + side + 4} ${top - 5} L${x + w + side + 4} ${top - 1} L${x + w + 4} ${top + 5} Z`} fill={mix(roof, sky2, 0.35)} opacity="0.6" />
        <path d={`M${x - 5} ${top + 3} L${x + w / 2} ${peak - 3} L${x + w + 5} ${top + 3} L${x + w + 2} ${top + 6} L${x + w / 2} ${peak + 2} L${x - 2} ${top + 6} Z`} fill={snowC} />
        {Array.from({ length: Math.floor(w / 7) }, (_, i) => (
          <path key={i} d={`M${x + 2 + i * 7} ${top + 6 + Math.abs(i - w / 14) * 0.2} l1.2 ${3 + R(i, k) * 4} l1.2 ${-3 - R(i, k) * 4} Z`} fill={lt(snowC, 0.3)} opacity="0.85" />
        ))}
        {steeple ? (
          <g>
            <rect x={x + w / 2 - 7} y={peak - 30} width="14" height="30" fill={url(`${id}wall`)} />
            <path d={`M${x + w / 2 - 10} ${peak - 29} L${x + w / 2} ${peak - 56} L${x + w / 2 + 10} ${peak - 29} Z`} fill={roof} />
            <path d={`M${x + w / 2 - 10} ${peak - 29} L${x + w / 2} ${peak - 56} L${x + w / 2} ${peak - 29} Z`} fill={snowC} opacity="0.85" />
            <circle cx={x + w / 2} cy={peak - 18} r="4" fill={win} {...anim("sc-flicker", 3.5)} />
          </g>
        ) : (
          <g>
            <rect x={x + w + side * 0.4} y={top - 24} width="7" height="16" fill={dk(house, 0.2)} />
            <rect x={x + w + side * 0.4 - 1} y={top - 26} width="9" height="3" fill={snowC} />
            {[0, 1, 2].map((s) => (
              <circle key={s} cx={x + w + side * 0.4 + 3.5} cy={top - 28} r={3 + s} fill={lt(sky2, 0.6)} opacity="0.35" {...anim("sc-smoke", 4.5, -s * 1.5 - k)} />
            ))}
          </g>
        )}
        {[0.18, 0.62].map((t, i) => (
          <g key={i}>
            <rect x={x + w * t} y={top + h * 0.25} width={w * 0.2} height={h * 0.28} fill={url(`${id}win`)} {...(i === k % 2 ? anim("sc-flicker", 3 + k, -k) : {})} />
            <path d={`M${x + w * (t + 0.1)} ${top + h * 0.25} v${h * 0.28} M${x + w * t} ${top + h * 0.39} h${w * 0.2}`} stroke={dk(house, 0.3)} strokeWidth="1.2" />
            <rect x={x + w * t - 1} y={top + h * 0.53} width={w * 0.2 + 2} height="2.5" fill={snowC} />
          </g>
        ))}
        <rect x={x + w * 0.42} y={base - h * 0.4} width={w * 0.16} height={h * 0.4} rx="2" fill={dk(house, 0.5)} />
        <circle cx={x + w * 0.5} cy={base - h * 0.48} r="3.4" fill="none" stroke="#2f7a3f" strokeWidth="2" />
        {/* String lights along the eaves */}
        {Array.from({ length: 7 }, (_, i) => {
          const t = i / 6;
          const lx = x - 3 + t * (w + 6);
          const ly = top + 6 + Math.sin(t * Math.PI) * 4;
          return <circle key={i} cx={lx} cy={ly} r="1.6" fill={["#ff5e5e", "#ffd166", "#5ee7ff", "#7dff9b"][i % 4]} {...anim("sc-tw", 1.2 + (i % 3) * 0.4, -i * 0.3)} />;
        })}
      </g>
    );
  };
  return (
    <>
      <Sky id={id} top={sky1} bottom={sky2} horizon={mix(sky2, win, 0.15)} />
      <defs>
        <LG id={`${id}wall`} x2={1} y2={0.4} s={[[0, lt(house, 0.12)], [1, dk(house, 0.12)]]} />
        <LG id={`${id}win`} s={[[0, lt(win, 0.4)], [1, win]]} />
        <RG id={`${id}spill`} s={[[0, win, 0.4], [1, win, 0]]} />
        <LG id={`${id}snow`} s={[[0, snowC], [1, mix(snowC, sky2, 0.4)]]} />
        <RG id={`${id}lamp`} s={[[0, win, 0.7], [1, win, 0]]} />
      </defs>
      <Stars n={70} top={110} seed={37} />
      <Orb id={id} x={660} y={84} r={18} color="#fffbe6" moon />
      <MountainLayerLite id={id} color={mix(sky2, snowC, 0.25)} snow={snowC} />
      {Array.from({ length: 24 }, (_, i) => (
        <Pine key={i} x={10 + i * 42 + R(i, 131) * 14} base={164 + Math.sin(i * 1.7) * 4} h={36 + R(i, 132) * 20} color={tree} light={lt(tree, 0.12)} snow={snowC} />
      ))}
      <path d={`M-20 168 Q240 156 500 166 T${W + 20} 162 V${H} H-20 Z`} fill={url(`${id}snow`)} />
      {home(250, 54, 40, 1)}
      {home(360, 66, 50, 2, true)}
      {home(490, 58, 42, 3)}
      {home(610, 70, 52, 4)}
      {/* Lamp posts */}
      {[330, 590].map((x) => (
        <g key={x}>
          <circle cx={x} cy="152" r="16" fill={url(`${id}lamp`)} {...anim("sc-breathe", 3)} />
          <rect x={x - 1.2} y="152" width="2.4" height="40" fill={dk(tree, 0.4)} />
          <rect x={x - 4} y="146" width="8" height="8" rx="1" fill={win} />
          <path d={`M${x - 5} 146 L${x} 141 L${x + 5} 146 Z`} fill={dk(tree, 0.4)} />
        </g>
      ))}
      {/* Snowman */}
      <g transform="translate(740 196)">
        <ellipse cx="0" cy="4" rx="16" ry="4" fill={mix(snowC, sky2, 0.5)} />
        <circle cx="0" cy="-6" r="12" fill={url(`${id}ball`)} />
        <circle cx="0" cy="-22" r="8.5" fill={url(`${id}ball`)} />
        <circle cx="0" cy="-34" r="6.5" fill={url(`${id}ball`)} />
        <defs>
          <RG id={`${id}ball`} cx={0.35} cy={0.3} r={0.75} s={[[0, "#ffffff"], [0.6, snowC], [1, mix(snowC, sky2, 0.45)]]} />
        </defs>
        <rect x="-6" y="-48" width="12" height="9" fill="#1d1d24" />
        <rect x="-8.5" y="-40" width="17" height="2.4" fill="#1d1d24" />
        <circle cx="-2.4" cy="-35.5" r="0.9" fill="#1d1d24" />
        <circle cx="2.4" cy="-35.5" r="0.9" fill="#1d1d24" />
        <path d="M0 -33.5 L7 -32 L0 -31.5 Z" fill="#ff8c32" />
        <path d="M-7 -28 Q0 -25 7 -28 L8 -24 Q0 -21 -8 -24 Z" fill="#e5484d" />
        <path d="M5 -25 l3 9 l-4 0 Z" fill="#c43d42" />
        <path d="M-8 -22 L-20 -30 M8 -22 L19 -28" stroke="#5a3a2e" strokeWidth="1.4" strokeLinecap="round" />
        <circle cx="0" cy="-20" r="0.9" fill="#1d1d24" />
        <circle cx="0" cy="-15" r="0.9" fill="#1d1d24" />
      </g>
      <path d={`M-20 196 Q300 188 600 198 T${W + 20} 194 V${H} H-20 Z`} fill={snowC} />
      {Array.from({ length: 16 }, (_, i) => (
        <circle key={i} cx={R(i, 151) * W} cy={198 + R(i, 152) * 18} r="0.9" fill="#fff" {...anim("sc-tw", 1.4 + R(i, 153) * 2, -R(i, 154) * 2)} />
      ))}
      {Array.from({ length: 40 }, (_, i) => {
        const near = i % 3 === 0;
        return (
          <g key={i} transform={`translate(${R(i, 141) * W} -6)`}>
            <circle r={near ? 2 + R(i, 142) : 0.8 + R(i, 142) * 0.8} fill="#fff" opacity={near ? 0.9 : 0.7} {...anim("sc-snow", (near ? 5 : 9) + R(i, 143) * 5, -R(i, 144) * 12)} />
          </g>
        );
      })}
      <Vignette id={id} strength={0.4} />
    </>
  );
}

function MountainLayerLite({ id, color, snow }: { id: string; color: string; snow: string }) {
  const pts: [number, number][] = [[-20, 150], [80, 110], [150, 130], [230, 96], [320, 132], [420, 104], [520, 136], [640, 100], [740, 128], [840, 94], [940, 124], [1020, 110], [1020, 170], [-20, 170]];
  return (
    <g>
      <defs>
        <LG id={`${id}mtn`} s={[[0, lt(color, 0.2)], [1, color]]} />
      </defs>
      <polygon points={pts.map((q) => q.join(",")).join(" ")} fill={url(`${id}mtn`)} />
      {pts.slice(1, -3).map(([x, y], i) =>
        i % 2 === 0 ? <path key={i} d={`M${x} ${y} l-14 12 l6 -2 l4 6 l5 -5 l8 3 Z`} fill={snow} opacity="0.85" /> : null,
      )}
    </g>
  );
}

// ============ Volcano ============
export function Lava({ p, id }: Opts) {
  const [bg1, bg2, rock1, rock2, l1, l2, ember] = p;
  const cx = 500;
  const rim = 104;
  const baseL = 150;
  const baseR = 870;
  const cone = `M${baseL} ${H} C${baseL + 120} 186 ${cx - 120} ${rim + 30} ${cx - 40} ${rim + 2} L${cx - 26} ${rim - 4} L${cx - 12} ${rim} L${cx + 2} ${rim - 5} L${cx + 18} ${rim} L${cx + 40} ${rim + 1} C${cx + 120} ${rim + 30} ${baseR - 120} 186 ${baseR} ${H} Z`;
  // Gullies running down the slopes give the cone its form
  const gullies = Array.from({ length: 14 }, (_, i) => {
    const t = (i + 0.5) / 14;
    const sx = cx - 36 + t * 72;
    const ex = baseL + 20 + t * (baseR - baseL - 40);
    const mx = (sx + ex) / 2 + (R(i, 3) - 0.5) * 30;
    return { d: `M${sx} ${rim + 4} Q${mx} ${(rim + H) / 2 + 10} ${ex} ${H}`, lit: t < 0.45, i };
  });
  const river = (d: string, k: number) => (
    <g key={k}>
      <path d={d} fill="none" stroke={l1} strokeWidth="22" strokeLinecap="round" opacity="0.35" filter={url(`${id}bl`)} />
      <path d={d} fill="none" stroke={dk(l1, 0.25)} strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
      <path d={d} fill="none" stroke={l1} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
      <path d={d} fill="none" stroke={l2} strokeWidth="3.4" strokeLinecap="round" strokeDasharray="18 9" {...anim("sc-flow", 2.2 + k * 0.5)} />
      <path d={d} fill="none" stroke={lt(l2, 0.7)} strokeWidth="1.2" strokeLinecap="round" strokeDasharray="3 24" {...anim("sc-flow", 1.5 + k * 0.4)} />
    </g>
  );
  // The ash column: puffs that widen and drift as they climb
  const plume = Array.from({ length: 16 }, (_, i) => {
    const t = i / 15;
    return { x: cx + Math.sin(t * 3) * 16 + t * 120 + (R(i, 41) - 0.5) * 40 * t, y: rim - 10 - t * 120, r: 20 + t * 58 + R(i, 42) * 10, i };
  });
  return (
    <>
      <Sky id={id} top={bg1} bottom={bg2} horizon={mix(bg2, l1, 0.55)} glowY={0.75} />
      <defs>
        <LG id={`${id}cone`} x2={1} y2={0} s={[[0, mix(rock1, l1, 0.22)], [0.3, lt(rock1, 0.06)], [0.55, rock1], [1, dk(rock1, 0.5)]]} />
        <LG id={`${id}coneV`} s={[[0, l1, 0.25], [0.15, "#000", 0], [1, "#000", 0.3]]} />
        <RG id={`${id}crater`} s={[[0, lt(l2, 0.5), 1], [0.25, l2, 0.75], [0.6, l1, 0.3], [1, l1, 0]]} />
        <RG id={`${id}ash`} cx={0.4} cy={0.3} r={0.75} s={[[0, mix(rock2, "#b8a8ae", 0.3)], [0.55, rock2], [1, mix(dk(rock2, 0.2), l1, 0.45)]]} />
        <LG id={`${id}lake`} s={[[0, lt(l2, 0.35)], [0.35, l2], [1, l1]]} />
        <LG id={`${id}rock`} s={[[0, mix(rock2, l1, 0.35)], [0.15, rock2], [1, dk(rock2, 0.55)]]} />
        <RG id={`${id}bomb`} s={[[0, "#fff"], [0.4, l2], [1, l1, 0]]} />
        <RG id={`${id}pool`} s={[[0, l2, 0.6], [1, l1, 0]]} />
        <filter id={`${id}bl`} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="4" />
        </filter>
      </defs>
      <Stars n={30} top={90} seed={61} color={lt(l2, 0.6)} />
      {/* Far ridges */}
      <path d={`M-20 176 L60 140 L120 156 L190 128 L260 166 L300 180 L-20 180 Z`} fill={mix(rock2, bg2, 0.45)} />
      <path d={`M700 180 L760 136 L820 152 L890 120 L950 146 L${W + 20} 134 L${W + 20} 180 Z`} fill={mix(rock2, bg2, 0.45)} />
      <ellipse cx={cx} cy={rim + 10} rx="230" ry="100" fill={url(`${id}crater`)} opacity="0.55" {...anim("sc-breathe", 2.6)} />
      {/* Ash column lit from below */}
      <g {...anim("sc-sway", 9)}>
        {plume
          .slice()
          .reverse()
          .map(({ x, y, r, i }) => (
            <circle key={i} cx={x} cy={y} r={r} fill={url(`${id}ash`)} />
          ))}
      </g>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <g key={i} transform={`translate(${cx + (i - 2.5) * 6} ${rim - 6})`}>
          <circle r={10 + (i % 3) * 3} fill={url(`${id}ash`)} {...anim("sc-plume", 5, -i * 0.85, { "--sx": `${30 + (i - 2.5) * 10}px` })} />
        </g>
      ))}
      <g {...anim("sc-flash", 7, -2)}>
        <path d={`M${cx + 70} 40 L${cx + 58} 58 L${cx + 68} 58 L${cx + 54} 82`} fill="none" stroke="#b9c8ff" strokeWidth="6" opacity="0.4" filter={url(`${id}bl`)} />
        <path d={`M${cx + 70} 40 L${cx + 58} 58 L${cx + 68} 58 L${cx + 54} 82`} fill="none" stroke="#f1f5ff" strokeWidth="1.6" />
      </g>
      {/* The cone */}
      <path d={cone} fill={url(`${id}cone`)} />
      <path d={cone} fill={url(`${id}coneV`)} />
      {gullies.map(({ d, lit, i }) => (
        <path key={i} d={d} fill="none" stroke={lit ? lt(rock1, 0.14) : dk(rock1, 0.35)} strokeWidth={lit ? 1.4 : 2} opacity={lit ? 0.5 : 0.55} />
      ))}
      <path d={`M${cx - 40} ${rim + 2} C${cx - 120} ${rim + 30} ${baseL + 120} 186 ${baseL} ${H}`} fill="none" stroke={mix(rock1, l1, 0.7)} strokeWidth="2.2" opacity="0.55" />
      {/* Crater */}
      <ellipse cx={cx} cy={rim + 1} rx="42" ry="8" fill={dk(rock1, 0.4)} />
      <ellipse cx={cx} cy={rim + 1} rx="36" ry="5.5" fill={l1} />
      <ellipse cx={cx} cy={rim} rx="28" ry="3.6" fill={lt(l2, 0.4)} {...anim("sc-flicker", 1.4)} />
      {Array.from({ length: 10 }, (_, i) => (
        <g key={i} transform={`translate(${cx + (i - 4.5) * 4} ${rim - 2})`}>
          <g {...anim("sc-bx", 2 + R(i, 7) * 1.2, -R(i, 8) * 3, { "--sx": `${(R(i, 9) - 0.5) * 180}px` })}>
            <circle r={2 + R(i, 10) * 2.4} fill={url(`${id}bomb`)} {...anim("sc-by", 2 + R(i, 7) * 1.2, -R(i, 8) * 3, { "--sy": `${-36 - R(i, 11) * 40}px`, "--dy": `${50 + R(i, 12) * 40}px` })} />
          </g>
        </g>
      ))}
      {/* Glowing cracks */}
      <g stroke={l2} strokeWidth="1.3" fill="none" strokeLinecap="round" {...anim("sc-flicker", 2.2)}>
        <path d={`M${cx - 80} 150 l10 -6 l6 5 l12 -8`} />
        <path d={`M${cx + 90} 166 l-8 -6 l-10 4 l-6 -9`} />
        <path d={`M${cx - 150} 190 l12 -4 l8 6`} />
      </g>
      {river(`M${cx - 14} ${rim + 4} C${cx - 26} ${rim + 30} ${cx - 8} ${rim + 50} ${cx - 40} ${rim + 72} S${cx - 70} ${H - 10} ${cx - 92} ${H + 6}`, 0)}
      {river(`M${cx + 16} ${rim + 4} C${cx + 32} ${rim + 32} ${cx + 16} ${rim + 56} ${cx + 50} ${rim + 80} S${cx + 70} ${H - 6} ${cx + 84} ${H + 6}`, 1)}
      {/* Lava lake with drifting crust */}
      <ellipse cx={cx} cy={H} rx="420" ry="40" fill={url(`${id}pool`)} {...anim("sc-flicker", 3.4)} />
      <path d={`M80 ${H} C200 198 360 202 500 199 S800 198 920 ${H} Z`} fill={url(`${id}lake`)} />
      <g {...anim("sc-drift", 16)}>
        {[[200, 212, 26], [300, 207, 18], [410, 213, 30], [560, 208, 22], [670, 212, 28], [790, 210, 18]].map(([x, y, w], i) => (
          <path key={i} d={`M${x - w} ${y} l${w * 0.3} -3 l${w * 0.6} -1 l${w * 0.6} 2 l${w * 0.5} 2 l-${w * 0.4} 3 l-${w} 0 Z`} fill={dk(rock1, 0.3)} stroke={l2} strokeWidth="0.8" />
        ))}
      </g>
      {Array.from({ length: 6 }, (_, i) => (
        <circle key={i} cx={180 + i * 120 + R(i, 71) * 40} cy={206 + R(i, 72) * 8} r="3" fill={lt(l2, 0.5)} {...anim("sc-twinkle", 1.6 + R(i, 73), -R(i, 74) * 2)} />
      ))}
      {/* Foreground rocks rim-lit by the lava */}
      <path d={`M-20 ${H} L-20 186 L40 170 L90 180 L140 164 L190 190 L210 ${H} Z`} fill={url(`${id}rock`)} />
      <path d="M-20 186 L40 170 L90 180 L140 164 L190 190" fill="none" stroke={l1} strokeWidth="1.6" opacity="0.7" />
      <path d={`M800 ${H} L820 182 L870 172 L920 184 L970 164 L${W + 20} 176 L${W + 20} ${H} Z`} fill={url(`${id}rock`)} />
      <path d={`M820 182 L870 172 L920 184 L970 164 L${W + 20} 176`} fill="none" stroke={l1} strokeWidth="1.6" opacity="0.7" />
      {Array.from({ length: 34 }, (_, i) => (
        <circle key={i} cx={200 + R(i, 151) * 600} cy={H + 4} r={0.8 + R(i, 152) * 1.6} fill={i % 3 ? ember : l2} {...anim("sc-ember", 3.5 + R(i, 153) * 4, -R(i, 154) * 6)} />
      ))}
      <Mist id={id} k="heat" y={160} h={60} color={l1} opacity={0.12} dur={8} />
      <Vignette id={id} strength={0.5} />
    </>
  );
}
