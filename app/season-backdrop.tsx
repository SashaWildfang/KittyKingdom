"use client";

// The page backdrop behind every page: soft glows in the season's colors, a faint pattern of Bear Nation
// motifs (paws, crowns, sparkles and the season's own shape) and drifting particles for the season
// (leaves in autumn, snow in winter, butterflies and petals in spring, bubbles in summer).
// Colors and pattern come from app/seasons.css + app/glass.css; Admin → Overview → Seasons turns the particles down or off.

import "./seasons.css";
import { useEffect, useRef } from "react";
import { useSeason } from "./season-context";
import type { SeasonKey } from "../lib/seasons";

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

/** The whole-site backdrop. */
export function SeasonBackdrop() {
  const season = useSeason();
  return (
    <div className="sb" data-season-backdrop={season.key} aria-hidden="true">
      <div className="sb-mesh" />
      <div className="sb-pattern" />
      {season.particles !== "off" ? <Particles season={season.key} amount={season.particles} /> : null}
    </div>
  );
}
