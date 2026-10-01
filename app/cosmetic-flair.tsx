"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import { specOf, type CosmeticSlot, type FrameSpec, type Ornament, type Particle, type ThemeSpec } from "../lib/cosmetics";
import { BannerScene } from "./cosmetic-scenes";

// How store cosmetics are drawn. Recipes come from lib/cosmetics.ts; looks are the .cos-* classes
// in globals.css (driven by CSS variables) plus the SVG ornaments, particles and scenes here.

const R = (i: number, s = 1) => {
  const x = Math.sin(i * 12.9898 + s * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

// ---------- frame ornaments (drawn around an avatar of radius 50) ----------
function Mirror({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <g transform="scale(-1 1)">{children}</g>
    </>
  );
}

function OrnamentArt({ kind, color, glow }: { kind: Ornament; color?: string; glow: string }) {
  switch (kind) {
    case "crown":
      return (
        <g transform="translate(0 -60)">
          <g className="orn-bob">
          <path d="M-24 10 L-28 -12 L-13 -1 L0 -20 L13 -1 L28 -12 L24 10 Z" fill="#ffd24a" stroke="#8a5a00" strokeWidth="2" strokeLinejoin="round" />
          <rect x="-24" y="8" width="48" height="6" rx="2" fill="#e0a526" stroke="#8a5a00" strokeWidth="1.5" />
          <circle cx="0" cy="-20" r="3.5" fill="#ff4d8d" />
          <circle cx="-28" cy="-12" r="3" fill="#4fc3ff" />
          <circle cx="28" cy="-12" r="3" fill="#4fc3ff" />
          <circle cx="0" cy="3" r="3" fill="#ff4d8d" />
          </g>
        </g>
      );
    case "halo":
      return <ellipse className="orn-bob" cx="0" cy="-64" rx="28" ry="7" fill="none" stroke="#fff3b0" strokeWidth="4.5" style={{ filter: `drop-shadow(0 0 6px ${glow})` }} />;
    case "wings":
      return (
        <g className="orn-wing">
          <Mirror>
            <path d="M-46 -8 C-62 -32 -86 -30 -98 -14 C-88 -12 -86 -6 -96 2 C-84 2 -82 8 -92 16 C-80 16 -74 22 -82 30 C-66 26 -56 18 -48 10 Z" fill="#ffffff" stroke="#e8dcb5" strokeWidth="1.5" opacity="0.97" />
          </Mirror>
        </g>
      );
    case "batwings":
      return (
        <g className="orn-wing">
          <Mirror>
            <path d="M-46 -6 C-60 -28 -82 -28 -100 -14 C-92 -9 -92 0 -98 6 C-88 2 -84 8 -88 18 C-78 12 -70 14 -68 22 C-60 12 -54 6 -47 6 Z" fill="#1a0b16" stroke="#5a1424" strokeWidth="1.5" />
          </Mirror>
        </g>
      );
    case "horns":
      return (
        <Mirror>
          <path d="M-24 -42 C-36 -58 -34 -76 -20 -86 C-26 -72 -22 -60 -12 -48 Z" fill="#7a0b12" stroke="#2b0000" strokeWidth="1.6" />
        </Mirror>
      );
    case "ears":
      return (
        <Mirror>
          <path d="M-42 -30 L-38 -74 L-12 -48 Z" fill={color ?? "#ffb3c6"} stroke="rgba(0,0,0,.25)" strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M-35 -38 L-33 -62 L-19 -47 Z" fill="#ffd6e0" />
        </Mirror>
      );
    case "wreath":
      return (
        <g>
          {Array.from({ length: 13 }, (_, i) => {
            const a = ((25 + i * 10.8) * Math.PI) / 180;
            const x = Math.cos(a) * 55;
            const y = Math.sin(a) * 55;
            return <ellipse key={i} cx={x} cy={y} rx="8" ry="3.6" fill={i % 2 ? "#3f8f4f" : "#6cc070"} transform={`rotate(${25 + i * 10.8 + 90 + (i % 2 ? 30 : -30)} ${x} ${y})`} />;
          })}
          <circle cx="0" cy="56" r="3.5" fill="#e5484d" />
          <circle cx="-7" cy="55" r="3" fill="#e5484d" />
        </g>
      );
    case "snow":
      return (
        <g stroke="#e8f8ff" strokeWidth="2" strokeLinecap="round" className="orn-twinkle">
          {[[-48, -36, 1], [52, -22, 0.8], [40, 46, 0.9], [-44, 40, 0.6]].map(([x, y, s], i) => (
            <g key={i} transform={`translate(${x} ${y}) scale(${s})`}>
              {[0, 60, 120].map((a) => (
                <line key={a} x1="-9" y1="0" x2="9" y2="0" transform={`rotate(${a})`} />
              ))}
            </g>
          ))}
        </g>
      );
    case "flames":
      return (
        <g className="orn-flicker">
          {Array.from({ length: 9 }, (_, i) => {
            const deg = -160 + i * 17.5;
            const a = (deg * Math.PI) / 180;
            const s = 0.9 + (i % 3) * 0.3;
            return (
              <path key={i} d="M0 0 C-6 -8 -3 -16 0 -24 C3 -16 6 -8 0 0 Z" fill={i % 2 ? "#ffb300" : "#ff3d00"} transform={`translate(${Math.cos(a) * 50} ${Math.sin(a) * 50}) rotate(${deg + 90}) scale(${s})`} />
            );
          })}
        </g>
      );
    case "hearts":
      return (
        <g className="orn-orbit">
          {[0, 90, 180, 270].map((d) => (
            <path key={d} d="M0 4 C-2 2 -7 -1 -7 -5 A3.6 3.6 0 0 1 0 -6 A3.6 3.6 0 0 1 7 -5 C7 -1 2 2 0 4 Z" fill="#ff4d8d" transform={`rotate(${d}) translate(0 -60) rotate(${-d}) scale(1.3)`} />
          ))}
        </g>
      );
    case "stars":
      return (
        <g className="orn-orbit">
          {[0, 72, 144, 216, 288].map((d, i) => (
            <path key={d} d="M0 -6 L1.8 -1.8 L6 -1.6 L2.7 1.2 L3.8 5.6 L0 3.2 L-3.8 5.6 L-2.7 1.2 L-6 -1.6 L-1.8 -1.8 Z" fill={i % 2 ? "#fff6d6" : "#ffd24a"} transform={`rotate(${d}) translate(0 -60) scale(${i % 2 ? 1 : 1.4})`} />
          ))}
        </g>
      );
    case "blossoms":
      return (
        <g>
          {[[-46, -38, 1.3], [48, 38, 1.1], [56, 20, 0.7], [-30, -54, 0.7]].map(([x, y, s], i) => (
            <g key={i} transform={`translate(${x} ${y}) scale(${s})`}>
              {[0, 72, 144, 216, 288].map((a) => (
                <ellipse key={a} cx="0" cy="-5" rx="4" ry="5.5" fill="#ffc2dc" transform={`rotate(${a})`} />
              ))}
              <circle r="2.5" fill="#ffe08a" />
            </g>
          ))}
        </g>
      );
    case "moon":
      return <path className="orn-bob" d="M52 -66 a16 16 0 1 0 12 26 a13 13 0 1 1 -12 -26 Z" fill="#f4f1ff" style={{ filter: `drop-shadow(0 0 6px ${glow})` }} />;
    case "wisps":
      return (
        <g className="orn-orbit orn-orbit--slow">
          {[0, 120, 240].map((d) => (
            <g key={d} transform={`rotate(${d})`}>
              <path d="M0 -58 c10 -4 18 2 16 10 c-2 6 -10 6 -12 2" fill="none" stroke="#d8ffe9" strokeWidth="4" strokeLinecap="round" opacity="0.85" />
              <circle cx="0" cy="-58" r="5" fill="#f4fff9" />
            </g>
          ))}
        </g>
      );
    case "bolts":
      return (
        <g className="orn-flicker">
          <Mirror>
            <path d="M-60 -20 L-70 0 L-62 0 L-68 18 L-52 -4 L-60 -4 L-54 -20 Z" fill="#fff200" stroke="#b39500" strokeWidth="1" />
          </Mirror>
        </g>
      );
    case "petals":
      return (
        <g>
          {Array.from({ length: 18 }, (_, i) => (
            <ellipse key={i} cx="0" cy="-58" rx="5" ry="11" fill={color ?? "#ffd23f"} stroke="#c98a00" strokeWidth="1" transform={`rotate(${i * 20})`} />
          ))}
        </g>
      );
    default:
      return null;
  }
}

function frameStyle(spec: FrameSpec): CSSProperties {
  const c = spec.colors;
  return {
    "--f1": c[0],
    "--f2": c[1] ?? c[0],
    "--f3": c[2] ?? c[1] ?? c[0],
    "--f4": c[3] ?? c[2] ?? c[0],
    "--f5": c[4] ?? c[0],
    "--f-glow": spec.glow,
    "--f-speed": `${spec.speed ?? 6}s`,
  } as CSSProperties;
}

/** An avatar or photo with an equipped frame around it (works on any corner radius). */
export function Framed({ frame, children, className }: { frame: string | null | undefined; children: ReactNode; className?: string }) {
  const def = specOf("frame", frame);
  if (!def?.frame) return <>{children}</>;
  const spec = def.frame;
  return (
    <span
      className={`cos-frame cos-frame--${spec.style}${spec.ornaments?.some((o) => o === "wings" || o === "batwings") ? " has-wings" : ""}${className ? ` ${className}` : ""}`}
      style={frameStyle(spec)}
    >
      {children}
      <span className="cos-ring" aria-hidden="true" />
      {spec.style === "dual" ? <span className="cos-ring cos-ring--inner" aria-hidden="true" /> : null}
      {spec.ornaments?.length ? (
        <svg className="cos-orn" viewBox="-72 -72 144 144" aria-hidden="true">
          {spec.ornaments.map((o) => (
            <OrnamentArt key={o} kind={o} color={spec.ornament} glow={spec.glow} />
          ))}
        </svg>
      ) : null}
    </span>
  );
}

/** A name with an equipped name effect. */
export function FlairName({ nameplate, children, text }: { nameplate: string | null | undefined; children: ReactNode; text?: string }) {
  const def = specOf("nameplate", nameplate);
  if (!def?.nameplate) return <>{children}</>;
  const c = def.nameplate.colors;
  const style = { "--n1": c[0], "--n2": c[1] ?? c[0], "--n3": c[2] ?? c[1] ?? c[0], "--n4": c[3] ?? c[0], "--n5": c[4] ?? c[0] } as CSSProperties;
  return (
    <span className={`cos-name cos-name--${def.nameplate.style}`} data-text={text} style={style}>
      {children}
    </span>
  );
}

/** A banner scene layer: put it first inside a positioned card. */
export function FlairBanner({ banner, className, children }: { banner: string | null | undefined; className?: string; children?: ReactNode }) {
  const def = specOf("banner", banner);
  if (!def?.banner) return null;
  return (
    <span className={`cos-banner${className ? ` ${className}` : ""}`} aria-hidden="true">
      <BannerScene spec={def.banner} />
      {children}
    </span>
  );
}

// ---------- particles ----------
const SHAPES: Partial<Record<Particle, (c: string) => ReactNode>> = {
  petal: (c) => <path d="M12 2 C18 8 17 16 12 22 C7 16 6 8 12 2 Z" fill={c} />,
  heart: (c) => <path d="M12 21 C11 20 3 15 2.5 9.5 A5 5 0 0 1 12 7 A5 5 0 0 1 21.5 9.5 C21 15 13 20 12 21 Z" fill={c} />,
  sparkle: (c) => <path d="M12 1 L14 10 L23 12 L14 14 L12 23 L10 14 L1 12 L10 10 Z" fill={c} />,
  star: (c) => <path d="M12 2 L14.9 8.9 L22 9.5 L16.6 14.2 L18.3 21.2 L12 17.3 L5.7 21.2 L7.4 14.2 L2 9.5 L9.1 8.9 Z" fill={c} />,
  leaf: (c) => (
    <>
      <path d="M4 20 C4 9 11 4 21 3 C20 13 14 20 4 20 Z" fill={c} />
      <path d="M4 20 L14 10" stroke="rgba(0,0,0,.25)" strokeWidth="1.2" />
    </>
  ),
  bubble: (c) => (
    <>
      <circle cx="12" cy="12" r="9" fill="none" stroke={c} strokeWidth="1.6" />
      <circle cx="9" cy="8.5" r="2" fill={c} opacity="0.8" />
    </>
  ),
  confetti: (c) => <rect x="7" y="3" width="10" height="18" rx="2" fill={c} />,
  bat: (c) => <path d="M12 9 C10 6 7 6 5 8 C4 5 2 5 0 7 C2 9 2 12 4 14 C6 12 9 13 11 15 L12 13 L13 15 C15 13 18 12 20 14 C22 12 22 9 24 7 C22 5 20 5 19 8 C17 6 14 6 12 9 Z" fill={c} />,
  ghost: (c) => (
    <>
      <path d="M5 22 V11 A7 7 0 0 1 19 11 V22 L16.5 19.5 L14 22 L12 19.5 L10 22 L7.5 19.5 Z" fill={c} />
      <circle cx="9.5" cy="11" r="1.5" fill="#123" />
      <circle cx="14.5" cy="11" r="1.5" fill="#123" />
    </>
  ),
  note: (c) => <path d="M9 18 A3 3 0 1 1 7 15.2 V4 L18 2 V14 A3 3 0 1 1 16 11.2 V5.5 L9 6.8 Z" fill={c} />,
  paw: (c) => (
    <g fill={c}>
      <ellipse cx="12" cy="16" rx="5.5" ry="4.5" />
      <circle cx="6" cy="9.5" r="2.4" />
      <circle cx="10" cy="6" r="2.4" />
      <circle cx="14" cy="6" r="2.4" />
      <circle cx="18" cy="9.5" r="2.4" />
    </g>
  ),
};

/** Animated particles (put inside a positioned, overflow-hidden box). */
export function FlairEffect({ effect, count, className }: { effect: string | null | undefined; count?: number; className?: string }) {
  const def = specOf("effect", effect);
  if (!def?.effect) return null;
  const { particle, colors, motion } = def.effect;
  const n = count ?? def.effect.count ?? 20;
  const shape = SHAPES[particle];
  return (
    <span className={`cos-fx cos-fx--${motion} cos-fx--${particle}${className ? ` ${className}` : ""}`} aria-hidden="true">
      {Array.from({ length: n }, (_, i) => {
        const c = colors[i % colors.length];
        const size = particle === "rain" ? 14 + R(i, 3) * 10 : particle === "snow" || particle === "ember" || particle === "firefly" ? 3 + R(i, 3) * 5 : 9 + R(i, 3) * 9;
        const style = {
          left: `${R(i, 1) * 100}%`,
          top: motion === "twinkle" || motion === "float" || motion === "drift" ? `${R(i, 2) * 100}%` : undefined,
          width: particle === "rain" ? 1.5 : size,
          height: size,
          animationDuration: `${(motion === "rain" ? 0.9 : motion === "twinkle" ? 2.4 : 7) + R(i, 4) * (motion === "rain" ? 0.6 : 6)}s`,
          animationDelay: `${-R(i, 5) * 12}s`,
          "--c": c,
          "--sway": `${(R(i, 6) - 0.5) * 80}px`,
          "--spin": `${(R(i, 7) - 0.5) * 720}deg`,
        } as CSSProperties;
        return (
          <span key={i} className="cos-p" style={style}>
            {shape ? <svg viewBox="0 0 24 24">{shape(c)}</svg> : null}
          </span>
        );
      })}
    </span>
  );
}

/** CSS variables for a profile theme. */
export function themeVars(theme: string | null | undefined): CSSProperties | undefined {
  const t = specOf("theme", theme)?.theme;
  if (!t) return undefined;
  return themeStyle(t);
}

function themeStyle(t: ThemeSpec): CSSProperties {
  return { "--th1": t.bg[0], "--th2": t.bg[1], "--th3": t.bg[2], "--th-acc": t.accent, "--th-glow": t.glow } as CSSProperties;
}

/** The full-page backdrop of a profile theme (fixed behind the page). */
export function FlairTheme({ theme, effect }: { theme: string | null | undefined; effect?: string | null }) {
  const t = specOf("theme", theme)?.theme;
  if (!t && !effect) return null;
  return (
    <div className={`cos-theme-bg${t ? "" : " is-plain"}`} style={t ? themeStyle(t) : undefined} aria-hidden="true">
      {t ? (
        <>
          <span className="cos-theme-orb cos-theme-orb--1" />
          <span className="cos-theme-orb cos-theme-orb--2" />
        </>
      ) : null}
      {effect ? <FlairEffect effect={effect} /> : null}
    </div>
  );
}

/** What a cosmetic looks like, for store cards and the Locker. */
export function CosmeticPreview({ slot, cosKey, me, compact }: { slot: CosmeticSlot; cosKey: string; me?: { name: string; avatar: string | null }; compact?: boolean }) {
  const [failed, setFailed] = useState(false);
  const name = me?.name ?? "Your Name";
  const avatar = (
    <span className="cprev-avatar">
      {me?.avatar && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={me.avatar} alt="" onError={() => setFailed(true)} />
      ) : (
        <b>{name.charAt(0).toUpperCase()}</b>
      )}
    </span>
  );
  return (
    <span className={`cprev cprev--${slot}${compact ? " is-compact" : ""}`} style={slot === "theme" ? themeVars(cosKey) : undefined} aria-hidden="true">
      {slot === "banner" ? <FlairBanner banner={cosKey} /> : null}
      {slot === "frame" ? <Framed frame={cosKey}>{avatar}</Framed> : null}
      {slot === "nameplate" ? (
        <span className="cprev-name">
          <FlairName nameplate={cosKey} text={compact ? "Aa" : name}>
            {compact ? "Aa" : name}
          </FlairName>
        </span>
      ) : null}
      {slot === "effect" ? <FlairEffect effect={cosKey} count={compact ? 8 : 14} /> : null}
      {slot === "theme" ? (
        <span className="cprev-theme">
          <span className="cos-theme-orb cos-theme-orb--1" />
          <i />
          <i />
        </span>
      ) : null}
    </span>
  );
}
