"use client";

// The page backdrop behind every page: a sky, a landscape and drifting particles for the season
// (leaves in autumn, snow in winter, butterflies and petals in spring, bubbles and a crab in summer).
// Colors come from app/seasons.css; Admin → Overview → Seasons turns the scenery/particles down or off.

import "./seasons.css";
import { useEffect, useRef, type CSSProperties } from "react";
import { useSeason } from "./season-context";
import type { SeasonKey } from "../lib/seasons";

// ---------------------------------------------------------------- landscapes (1440×400 viewBox, bottom-anchored)
/** A round, layered autumn tree: trunk, branches and three tones of foliage. */
function AutumnTree({ x, y, s, tone }: { x: number; y: number; s: number; tone: number }) {
  const fills = [
    ["var(--sb-accent-3)", "var(--sb-accent-1)", "var(--sb-accent-2)"],
    ["var(--sb-accent-1)", "var(--sb-accent-2)", "var(--sb-accent-3)"],
    ["var(--sb-accent-2)", "var(--sb-accent-3)", "var(--sb-accent-1)"],
  ][tone % 3];
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M-5 0 C-4 -18 -3 -34 -2 -50 L2 -50 C3 -34 4 -18 5 0Z" fill="var(--sb-near)" />
      <path d="M-1 -30 C-8 -38 -14 -42 -20 -50 M1 -36 C8 -44 14 -48 18 -56" stroke="var(--sb-near)" strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M-34 -58 C-40 -78 -22 -96 -4 -92 C6 -108 32 -102 34 -84 C48 -80 46 -58 32 -54 C26 -42 -24 -40 -34 -58Z" fill={fills[0]} />
      <path d="M-26 -64 C-30 -80 -14 -92 0 -88 C10 -98 28 -92 28 -78 C38 -74 36 -60 24 -58 C16 -50 -18 -50 -26 -64Z" fill={fills[1]} opacity="0.9" />
      <path d="M-10 -80 C-8 -90 6 -94 12 -86 C20 -86 22 -76 14 -72 C6 -68 -12 -70 -10 -80Z" fill={fills[2]} opacity="0.85" />
    </g>
  );
}

function FallLand() {
  return (
    <svg viewBox="0 0 1440 400" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
      <path d="M0 210 C180 150 320 190 480 160 C650 130 760 200 940 170 C1120 140 1260 180 1440 150 V400 H0Z" fill="var(--sb-far)" />
      {[120, 260, 410, 980, 1130, 1290].map((x, i) => (
        <AutumnTree key={x} x={x} y={182 - (i % 3) * 8} s={0.45 + (i % 2) * 0.12} tone={i} />
      ))}
      <path d="M0 280 C200 230 380 270 560 250 C760 225 900 290 1100 260 C1260 238 1360 250 1440 240 V400 H0Z" fill="var(--sb-mid)" />
      {[60, 330, 700, 860, 1210, 1380].map((x, i) => (
        <AutumnTree key={x} x={x} y={268 - (i % 2) * 10} s={0.8 + (i % 3) * 0.18} tone={i + 1} />
      ))}
      <path d="M0 340 C240 310 420 350 640 330 C860 310 1060 360 1260 335 C1350 324 1400 330 1440 326 V400 H0Z" fill="var(--sb-near)" />
      {/* A few fallen leaves on the ground */}
      {Array.from({ length: 18 }, (_, i) => (
        <ellipse key={i} cx={40 + i * 80 + ((i * 37) % 30)} cy={352 + ((i * 13) % 26)} rx="5" ry="2.5" fill={i % 2 ? "var(--sb-accent-1)" : "var(--sb-accent-2)"} opacity="0.7" transform={`rotate(${(i * 47) % 60 - 30} ${40 + i * 80} ${352 + ((i * 13) % 26)})`} />
      ))}
    </svg>
  );
}

function WinterLand() {
  const pine = (x: number, y: number, s: number, key: string) => (
    <g key={key} transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M0 -70 L18 -40 L10 -40 L26 -14 L14 -14 L32 12 L-32 12 L-14 -14 L-26 -14 L-10 -40 L-18 -40Z" fill="var(--sb-accent-2)" />
      <path d="M0 -70 L10 -52 L-10 -52Z M-14 -30 L14 -30 L8 -24 L-8 -24Z" fill="var(--sb-accent-1)" opacity="0.85" />
      <rect x="-4" y="12" width="8" height="10" fill="var(--sb-near)" />
    </g>
  );
  return (
    <svg viewBox="0 0 1440 400" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
      <path d="M0 230 L160 120 L260 190 L420 70 L560 200 L700 110 L860 210 L1000 90 L1160 200 L1300 120 L1440 190 V400 H0Z" fill="var(--sb-far)" />
      <path d="M420 70 L470 116 L440 110 L420 128 L398 106 L380 112Z M1000 90 L1046 130 L1020 126 L1000 142 L980 124 L962 128Z M160 120 L200 148 L178 146 L160 158 L144 148Z M1300 120 L1336 146 L1314 144 L1300 156 L1284 146Z" fill="var(--sb-accent-1)" opacity="0.9" />
      <path d="M0 290 C200 250 400 290 620 268 C860 244 1060 296 1260 270 C1360 258 1410 262 1440 260 V400 H0Z" fill="var(--sb-mid)" />
      {[80, 190, 520, 640, 900, 1180, 1330].map((x, i) => pine(x, 280 - (i % 3) * 10, 0.9 + (i % 2) * 0.3, `p${x}`))}
      <path d="M0 345 C260 320 480 356 720 338 C960 320 1180 360 1440 336 V400 H0Z" fill="var(--sb-near)" />
      <path d="M0 345 C260 320 480 356 720 338 C960 320 1180 360 1440 336" stroke="var(--sb-accent-1)" strokeOpacity="0.5" strokeWidth="3" fill="none" />
    </svg>
  );
}

function SpringLand() {
  const tree = (x: number, y: number, s: number, key: string) => (
    <g key={key} transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M-4 0 C-4 -20 -2 -36 0 -48 C2 -36 4 -20 4 0Z" fill="var(--sb-near)" />
      <path d="M0 -36 C-10 -46 -18 -48 -24 -56 M0 -42 C8 -52 18 -54 22 -62" stroke="var(--sb-near)" strokeWidth="3" fill="none" strokeLinecap="round" />
      <circle cx="0" cy="-66" r="24" fill="var(--sb-accent-1)" />
      <circle cx="-22" cy="-56" r="16" fill="var(--sb-accent-2)" />
      <circle cx="22" cy="-58" r="17" fill="var(--sb-accent-3)" opacity="0.85" />
      <circle cx="8" cy="-80" r="13" fill="var(--sb-accent-2)" />
    </g>
  );
  return (
    <svg viewBox="0 0 1440 400" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
      <path d="M0 220 C220 160 400 210 600 180 C820 150 980 210 1180 180 C1300 162 1380 170 1440 166 V400 H0Z" fill="var(--sb-far)" />
      <path d="M0 290 C180 240 360 280 560 262 C780 240 960 300 1160 270 C1300 250 1380 258 1440 256 V400 H0Z" fill="var(--sb-mid)" />
      {[110, 300, 760, 1020, 1300].map((x, i) => tree(x, 270 - (i % 2) * 12, 0.9 + (i % 3) * 0.2, `t${x}`))}
      <path d="M0 350 C220 325 470 360 720 342 C980 324 1200 362 1440 340 V400 H0Z" fill="var(--sb-near)" />
      {Array.from({ length: 26 }, (_, i) => (
        <circle key={i} cx={30 + i * 55} cy={360 + ((i * 7) % 18)} r={3 + (i % 3)} fill={i % 2 ? "var(--sb-accent-1)" : "#fff6b0"} opacity="0.85" />
      ))}
    </svg>
  );
}

function SummerLand() {
  return (
    <svg viewBox="0 0 1440 400" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
      <rect x="0" y="200" width="1440" height="200" fill="var(--sb-far)" />
      <g className="sb-wave">
        <path d="M-60 236 C60 224 180 248 300 236 C420 224 540 248 660 236 C780 224 900 248 1020 236 C1140 224 1260 248 1380 236 C1440 230 1480 236 1500 236 V400 H-60Z" fill="var(--sb-mid)" />
      </g>
      <g className="sb-wave sb-wave--2">
        <path d="M-60 272 C60 262 180 284 300 272 C420 262 540 284 660 272 C780 262 900 284 1020 272 C1140 262 1260 284 1380 272 C1440 266 1480 272 1500 272" stroke="var(--sb-accent-1)" strokeOpacity="0.5" strokeWidth="3" fill="none" />
      </g>
      <path d="M0 330 C240 300 520 318 760 306 C1000 294 1240 316 1440 300 V400 H0Z" fill="var(--sb-near)" />
      <path d="M0 330 C240 300 520 318 760 306 C1000 294 1240 316 1440 300" stroke="#ffffff" strokeOpacity="0.55" strokeWidth="4" fill="none" />
      {/* Palm tree */}
      <g transform="translate(1250 312)">
        <path d="M0 0 C6 -50 18 -100 40 -150" stroke="#7a5230" strokeWidth="11" fill="none" strokeLinecap="round" />
        {[[-80, -40], [-60, 10], [80, -10], [70, 40], [0, -70]].map(([dx, dy], i) => (
          <path key={i} d={`M40 -150 Q${40 + dx / 2} ${-170 + dy / 3} ${40 + dx} ${-150 + dy}`} stroke="var(--sb-accent-2)" strokeWidth="14" fill="none" strokeLinecap="round" />
        ))}
        <circle cx="34" cy="-142" r="7" fill="#5b3a1f" />
        <circle cx="46" cy="-140" r="7" fill="#5b3a1f" />
      </g>
      {/* Beach umbrella and shells */}
      <g transform="translate(220 330)">
        <path d="M0 0 L8 -80" stroke="#fff" strokeWidth="4" />
        <path d="M-52 -66 C-30 -110 50 -110 66 -60 Z" fill="var(--sb-accent-3)" />
        <path d="M8 -96 C0 -82 -6 -70 -10 -64 M8 -96 C16 -82 22 -70 26 -62" stroke="#fff" strokeWidth="3" fill="none" opacity="0.8" />
      </g>
      {[480, 690, 960].map((x, i) => (
        <path key={x} transform={`translate(${x} ${336 + i * 4})`} d="M-9 0 C-9 -12 9 -12 9 0 Z M-6 -2 L0 -10 L6 -2" fill="#ffe2c4" stroke="#e8b48a" strokeWidth="1.5" />
      ))}
    </svg>
  );
}

function Crab() {
  return (
    <div className="sb-crab" aria-hidden="true">
      <svg viewBox="0 0 64 44" width="46" height="32">
        <path d="M14 10 L8 2 M50 10 L56 2" stroke="#e8543e" strokeWidth="3" strokeLinecap="round" />
        <circle cx="8" cy="4" r="6" fill="#ff6b4a" />
        <circle cx="56" cy="4" r="6" fill="#ff6b4a" />
        <path d="M12 30 L2 38 M16 34 L8 42 M52 30 L62 38 M48 34 L56 42" stroke="#e8543e" strokeWidth="3" strokeLinecap="round" />
        <ellipse cx="32" cy="26" rx="20" ry="13" fill="#ff7a59" />
        <circle cx="26" cy="14" r="4" fill="#fff" />
        <circle cx="38" cy="14" r="4" fill="#fff" />
        <circle cx="26" cy="14" r="2" fill="#222" />
        <circle cx="38" cy="14" r="2" fill="#222" />
        <path d="M27 28 Q32 32 37 28" stroke="#9c2f1d" strokeWidth="2" fill="none" strokeLinecap="round" />
      </svg>
    </div>
  );
}

// ---------------------------------------------------------------- particles (one canvas)
/** Path2D only exists in the browser, so the leaf shapes are built on first use. */
function lazyPath(d: string) {
  let p: Path2D | null = null;
  return { get: () => (p ??= new Path2D(d)) };
}
const MAPLE = lazyPath(
  "M50 4 L57 21 L68 15 L64 37 L80 29 L76 41 L96 45 L82 55 L88 63 L64 63 L66 76 L53 69 L52 94 L48 94 L47 69 L34 76 L36 63 L12 63 L18 55 L4 45 L24 41 L20 29 L36 37 L32 15 L43 21 Z",
);
const OAK = lazyPath("M50 5 C74 22 80 52 53 82 L52 95 L48 95 L47 82 C20 52 26 22 50 5 Z");

type P = { x: number; y: number; vx: number; vy: number; size: number; rot: number; vr: number; phase: number; color: string; kind: number; life?: number };

const PALETTES: Record<SeasonKey, string[]> = {
  fall: ["#c0392b", "#e25822", "#f39c12", "#d35400", "#b5651d", "#e1a33b", "#9b2d1a", "#f5b041"],
  winter: ["#ffffff", "#eaf6ff", "#d6ecff", "#ffffff"],
  spring: ["#f9a8d4", "#f472b6", "#c4b5fd", "#fde68a", "#93c5fd", "#fbcfe8"],
  summer: ["#bdf2ff", "#e0fbff", "#ffffff", "#ffe08a"],
};

function spawn(season: SeasonKey, w: number, h: number, initial: boolean): P {
  const r = Math.random;
  const colors = PALETTES[season];
  const base: P = { x: r() * w, y: initial ? r() * h : -30, vx: 0, vy: 0, size: 0, rot: r() * Math.PI * 2, vr: 0, phase: r() * Math.PI * 2, color: colors[Math.floor(r() * colors.length)], kind: 0 };
  if (season === "fall") return { ...base, vx: -0.2 + r() * 0.4, vy: 0.5 + r() * 0.7, size: 14 + r() * 16, vr: (r() - 0.5) * 0.03, kind: r() < 0.6 ? 0 : 1 };
  if (season === "winter") return { ...base, vx: -0.15 + r() * 0.3, vy: 0.3 + r() * 0.8, size: 1.5 + r() * 3.5, vr: (r() - 0.5) * 0.01, kind: r() < 0.12 ? 1 : 0 };
  if (season === "spring") {
    const butterfly = r() < 0.3;
    return butterfly
      ? { ...base, y: initial ? r() * h : h * (0.3 + r() * 0.6), x: initial ? r() * w : -30, vx: 0.4 + r() * 0.6, vy: (r() - 0.5) * 0.3, size: 10 + r() * 8, kind: 1 }
      : { ...base, vx: 0.2 + r() * 0.5, vy: 0.35 + r() * 0.5, size: 5 + r() * 5, vr: (r() - 0.5) * 0.04, kind: 0 };
  }
  // summer: bubbles rise from the bottom; a few sun sparkles hang in the air
  const sparkle = r() < 0.25;
  return sparkle
    ? { ...base, y: r() * h * 0.6, vx: 0, vy: 0, size: 1 + r() * 2, kind: 1, life: r() * 300 }
    : { ...base, y: initial ? r() * h : h + 20, vx: (r() - 0.5) * 0.2, vy: -(0.3 + r() * 0.6), size: 3 + r() * 7, kind: 0 };
}

function draw(ctx: CanvasRenderingContext2D, season: SeasonKey, p: P, t: number) {
  ctx.save();
  ctx.translate(p.x, p.y);
  if (season === "fall") {
    ctx.rotate(p.rot);
    const s = p.size / 100;
    ctx.scale(s * Math.cos(t * 0.002 + p.phase), s);
    ctx.translate(-50, -50);
    ctx.fillStyle = p.color;
    ctx.globalAlpha = 0.85;
    ctx.fill((p.kind ? OAK : MAPLE).get());
  } else if (season === "winter") {
    ctx.globalAlpha = 0.85;
    if (p.kind) {
      ctx.rotate(p.rot);
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 1.2;
      const r = p.size * 3;
      for (let i = 0; i < 6; i += 1) {
        ctx.rotate(Math.PI / 3);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, r);
        ctx.moveTo(0, r * 0.6);
        ctx.lineTo(r * 0.25, r * 0.8);
        ctx.moveTo(0, r * 0.6);
        ctx.lineTo(-r * 0.25, r * 0.8);
        ctx.stroke();
      }
    } else {
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, p.size);
      g.addColorStop(0, "rgba(255,255,255,0.95)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (season === "spring") {
    if (p.kind) {
      // Butterfly: two wing pairs that flap
      const flap = Math.abs(Math.sin(t * 0.012 + p.phase));
      ctx.rotate(Math.atan2(p.vy, p.vx) + Math.PI / 2);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = 0.9;
      for (const side of [-1, 1]) {
        ctx.save();
        ctx.scale(side * (0.25 + flap * 0.75), 1);
        ctx.beginPath();
        ctx.ellipse(p.size * 0.55, -p.size * 0.25, p.size * 0.6, p.size * 0.42, -0.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(p.size * 0.42, p.size * 0.35, p.size * 0.38, p.size * 0.3, 0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      ctx.fillStyle = "#3b2340";
      ctx.fillRect(-1, -p.size * 0.5, 2, p.size);
    } else {
      // Petal
      ctx.rotate(p.rot);
      ctx.scale(1, 0.55 + 0.45 * Math.cos(t * 0.003 + p.phase));
      ctx.fillStyle = p.color;
      ctx.globalAlpha = 0.8;
      ctx.beginPath();
      ctx.ellipse(0, 0, p.size, p.size * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    if (p.kind) {
      const a = Math.max(0, Math.sin(((p.life ?? 0) / 300) * Math.PI));
      ctx.globalAlpha = a * 0.9;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.moveTo(0, -p.size * 3);
      ctx.lineTo(p.size * 0.6, 0);
      ctx.lineTo(0, p.size * 3);
      ctx.lineTo(-p.size * 0.6, 0);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.globalAlpha = 0.55;
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(0, 0, p.size, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 0.7;
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(-p.size * 0.35, -p.size * 0.35, p.size * 0.22, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

function Particles({ season, amount }: { season: SeasonKey; amount: "full" | "light" }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    let w = 0;
    let h = 0;
    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const perArea = { fall: 26, winter: 90, spring: 30, summer: 34 }[season];
    const count = Math.round(perArea * Math.min(1.4, (w * h) / (1440 * 900)) * (amount === "light" ? 0.45 : 1));
    const ps: P[] = Array.from({ length: count }, () => spawn(season, w, h, true));
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(3, (now - last) / 16.7);
      last = now;
      ctx.clearRect(0, 0, w, h);
      for (let i = 0; i < ps.length; i += 1) {
        const p = ps[i];
        if (!still) {
          const sway = Math.sin(now * 0.001 + p.phase);
          p.x += (p.vx + (season === "fall" || season === "winter" ? sway * 0.35 : 0)) * dt;
          p.y += (p.vy + (season === "spring" && p.kind ? Math.sin(now * 0.003 + p.phase) * 0.6 : 0)) * dt;
          p.rot += p.vr * dt;
          if (p.life !== undefined) p.life += dt;
        }
        draw(ctx, season, p, now);
        const gone = p.y > h + 40 || p.y < -60 || p.x > w + 60 || p.x < -80 || (p.life !== undefined && p.life > 300);
        if (gone) ps[i] = spawn(season, w, h, false);
      }
      if (!still) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    const onVisible = () => {
      cancelAnimationFrame(frame);
      if (document.visibilityState === "visible" && !still) {
        last = performance.now();
        frame = requestAnimationFrame(tick);
      }
    };
    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [season, amount]);
  return <canvas ref={ref} className="sb-canvas" aria-hidden="true" />;
}

const LANDS: Record<SeasonKey, () => JSX.Element> = { fall: FallLand, winter: WinterLand, spring: SpringLand, summer: SummerLand };

/** The whole-site season backdrop. */
export function SeasonBackdrop() {
  const season = useSeason();
  const Land = LANDS[season.key];
  return (
    <div className="sb" data-season-backdrop={season.key} aria-hidden="true">
      {season.scenery ? (
        <>
          <div className="sb-sky" />
          {season.key === "winter" ? (
            <>
              <div className="sb-stars" />
              <div className="sb-aurora" />
            </>
          ) : null}
          {season.key === "spring" || season.key === "summer"
            ? [12, 34, 58].map((top, i) => (
                <span key={top} className="sb-cloud" style={{ top: `${top}%`, width: `${10 + i * 4}rem`, animationDuration: `${90 + i * 40}s`, animationDelay: `${-i * 37}s` } as CSSProperties} />
              ))
            : null}
          <div className="sb-glow" />
          {season.key !== "winter" ? <div className="sb-sun" /> : null}
          <div className="sb-land">
            <Land />
          </div>
          <div className="sb-mist" />
          {season.key === "summer" ? <Crab /> : null}
          <div className="sb-scrim" />
        </>
      ) : null}
      {season.particles !== "off" ? <Particles season={season.key} amount={season.particles} /> : null}
    </div>
  );
}
