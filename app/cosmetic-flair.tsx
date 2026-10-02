"use client";

import { memo, useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { specOf, type CosmeticSlot, type FrameSpec, type Particle, type ThemeSpec } from "../lib/cosmetics";
import { OrnamentArt } from "./cosmetic-ornaments";
import { ThemeArt } from "./cosmetic-themes";
import { BannerScene } from "./cosmetic-scenes";

// How store cosmetics are drawn. Recipes come from lib/cosmetics.ts; looks are the .cos-* classes
// in globals.css (driven by CSS variables) plus the SVG ornaments, particles and scenes here.

const R = (i: number, s = 1) => {
  const x = Math.sin(i * 12.9898 + s * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

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

/** Ornaments that reach out past the sides (the Social photo makes room for them). */
const WIDE = new Set(["wings", "batwings", "phoenix", "foxtail", "whiskers", "vortex"]);

/** An avatar or photo with an equipped frame around it (works on any corner radius). */
export function Framed({ frame, children, className }: { frame: string | null | undefined; children: ReactNode; className?: string }) {
  const uid = `o${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const def = specOf("frame", frame);
  if (!def?.frame) return <>{children}</>;
  const spec = def.frame;
  return (
    <span
      className={`cos-frame cos-frame--${spec.style} cos-fk-${def.key}${spec.ornaments?.some((o) => WIDE.has(o)) ? " has-wings" : ""}${className ? ` ${className}` : ""}`}
      style={frameStyle(spec)}
    >
      {children}
      <span className="cos-ring" aria-hidden="true" />
      {spec.style === "dual" ? <span className="cos-ring cos-ring--inner" aria-hidden="true" /> : null}
      {spec.ornaments?.length ? (
        <svg className="cos-orn" viewBox="-72 -72 144 144" aria-hidden="true">
          {spec.ornaments.map((o) => (
            <OrnamentArt key={o} kind={o} color={spec.ornament} glow={spec.glow} uid={uid} />
          ))}
        </svg>
      ) : null}
    </span>
  );
}

/** Just the animated frame ring, drawn around any positioned box (Social cards, the Discover card). */
export function FrameRing({ frame, className }: { frame: string | null | undefined; className?: string }) {
  const spec = specOf("frame", frame)?.frame;
  if (!spec) return null;
  return (
    <span className={`cos-ringbox cos-frame--${spec.style} cos-fk-${frame}${className ? ` ${className}` : ""}`} style={frameStyle(spec)} aria-hidden="true">
      <span className="cos-ring" />
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
  petal: (c) => (
    <>
      <path d="M12 2 C18 8 17 16 12 22 C7 16 6 8 12 2 Z" fill={c} />
      <path d="M12 2 C9 8 9 16 12 22 C7 16 6 8 12 2 Z" fill="#fff" opacity="0.35" />
      <path d="M12 5 Q11 12 12 20" stroke="#000" strokeOpacity="0.12" strokeWidth="0.8" fill="none" />
    </>
  ),
  heart: (c) => (
    <>
      <path d="M12 21 C11 20 3 15 2.5 9.5 A5 5 0 0 1 12 7 A5 5 0 0 1 21.5 9.5 C21 15 13 20 12 21 Z" fill={c} />
      <path d="M12 21 C13 20 21 15 21.5 9.5 A5 5 0 0 0 17 5 C20 9 18 15 12 21 Z" fill="#000" opacity="0.15" />
      <ellipse cx="7.5" cy="9" rx="2.2" ry="1.4" fill="#fff" opacity="0.75" transform="rotate(-35 7.5 9)" />
    </>
  ),
  sparkle: (c) => (
    <>
      <circle cx="12" cy="12" r="7" fill={c} opacity="0.25" />
      <path d="M12 1 L14 10 L23 12 L14 14 L12 23 L10 14 L1 12 L10 10 Z" fill={c} />
      <path d="M12 4 L13 11 L20 12 L13 13 L12 20 L11 13 L4 12 L11 11 Z" fill="#fff" opacity="0.8" />
    </>
  ),
  star: (c) => (
    <>
      <path d="M12 2 L14.9 8.9 L22 9.5 L16.6 14.2 L18.3 21.2 L12 17.3 L5.7 21.2 L7.4 14.2 L2 9.5 L9.1 8.9 Z" fill={c} />
      <path d="M12 2 L14.9 8.9 L22 9.5 L12 12 Z M2 9.5 L9.1 8.9 L12 2 L12 12 Z" fill="#fff" opacity="0.45" />
      <path d="M12 12 L16.6 14.2 L18.3 21.2 L12 17.3 Z" fill="#000" opacity="0.15" />
    </>
  ),
  leaf: (c) => (
    <>
      <path d="M4 20 C4 9 11 4 21 3 C20 13 14 20 4 20 Z" fill={c} />
      <path d="M4 20 C4 9 11 4 21 3 C14 7 8 13 4 20 Z" fill="#fff" opacity="0.2" />
      <path d="M4 20 L17 7 M9 15 L8 10 M12 12 L15 13 M14 10 L13 6" stroke="#000" strokeOpacity="0.28" strokeWidth="0.9" fill="none" />
    </>
  ),
  bubble: (c) => (
    <>
      <circle cx="12" cy="12" r="9" fill={c} opacity="0.12" />
      <circle cx="12" cy="12" r="9" fill="none" stroke={c} strokeWidth="1.4" />
      <path d="M6.5 9 A6 6 0 0 1 10 5.5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" fill="none" />
      <circle cx="16" cy="16" r="1.2" fill="#fff" opacity="0.6" />
    </>
  ),
  confetti: (c) => (
    <>
      <rect x="7" y="3" width="10" height="18" rx="2" fill={c} />
      <rect x="7" y="3" width="4" height="18" rx="2" fill="#fff" opacity="0.3" />
    </>
  ),
  bat: (c) => (
    <>
      <path className="cos-flap" d="M12 9 C10 6 7 6 5 8 C4 5 2 5 0 7 C2 9 2 12 4 14 C6 12 9 13 11 15 L12 13 L13 15 C15 13 18 12 20 14 C22 12 22 9 24 7 C22 5 20 5 19 8 C17 6 14 6 12 9 Z" fill={c} />
      <circle cx="10.8" cy="10" r="0.8" fill="#ffd75e" />
      <circle cx="13.2" cy="10" r="0.8" fill="#ffd75e" />
    </>
  ),
  ghost: (c) => (
    <>
      <path d="M5 22 V11 A7 7 0 0 1 19 11 V22 L16.5 19.5 L14 22 L12 19.5 L10 22 L7.5 19.5 Z" fill={c} />
      <path d="M15 5.5 A7 7 0 0 1 19 11 V22 L16.5 19.5 Z" fill="#000" opacity="0.08" />
      <ellipse cx="9.5" cy="11" rx="1.3" ry="1.8" fill="#123" />
      <ellipse cx="14.5" cy="11" rx="1.3" ry="1.8" fill="#123" />
      <ellipse cx="8" cy="14" rx="1.4" ry="0.8" fill="#ff9ec7" opacity="0.7" />
      <ellipse cx="16" cy="14" rx="1.4" ry="0.8" fill="#ff9ec7" opacity="0.7" />
      <path d="M10.8 14.5 q1.2 1.2 2.4 0" stroke="#123" strokeWidth="0.8" fill="none" strokeLinecap="round" />
    </>
  ),
  note: (c) => (
    <>
      <path d="M9 18 A3 3 0 1 1 7 15.2 V4 L18 2 V14 A3 3 0 1 1 16 11.2 V5.5 L9 6.8 Z" fill={c} />
      <ellipse cx="5.4" cy="17.4" rx="1.2" ry="0.7" fill="#fff" opacity="0.6" transform="rotate(-30 5.4 17.4)" />
    </>
  ),
  paw: (c) => (
    <g>
      <g fill={c}>
        <ellipse cx="12" cy="16" rx="5.5" ry="4.5" />
        <circle cx="6" cy="9.5" r="2.4" />
        <circle cx="10" cy="6" r="2.4" />
        <circle cx="14" cy="6" r="2.4" />
        <circle cx="18" cy="9.5" r="2.4" />
      </g>
      <g fill="#fff" opacity="0.35">
        <ellipse cx="10.5" cy="14.5" rx="2" ry="1.2" />
        <circle cx="9.4" cy="5.3" r="0.8" />
        <circle cx="13.4" cy="5.3" r="0.8" />
      </g>
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
      {t && theme ? (
        <>
          <ThemeArt themeKey={theme} t={t} />
          <span className="cos-theme-orb cos-theme-orb--1" />
          <span className="cos-theme-orb cos-theme-orb--2" />
        </>
      ) : null}
      {effect ? <FlairEffect effect={effect} /> : null}
    </div>
  );
}

/** True once the element has come near the screen (so long lists only build what people scroll to). */
function useNearScreen<T extends Element>() {
  const ref = useRef<T>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || near) return;
    if (typeof IntersectionObserver === "undefined") return setNear(true);
    const io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && setNear(true), { rootMargin: "300px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [near]);
  return [ref, near] as const;
}

type PreviewProps = { slot: CosmeticSlot; cosKey: string; me?: { name: string; avatar: string | null }; compact?: boolean };

/** What a cosmetic looks like, for store cards and the Locker (built when it scrolls near the screen). */
export const CosmeticPreview = memo(CosmeticPreviewInner, (a, b) => a.slot === b.slot && a.cosKey === b.cosKey && a.compact === b.compact && a.me?.name === b.me?.name && a.me?.avatar === b.me?.avatar);

function CosmeticPreviewInner({ slot, cosKey, me, compact }: PreviewProps) {
  const [failed, setFailed] = useState(false);
  const [ref, near] = useNearScreen<HTMLSpanElement>();
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
    <span ref={ref} className={`cprev cprev--${slot}${compact ? " is-compact" : ""}`} style={slot === "theme" ? themeVars(cosKey) : undefined} aria-hidden="true">
      {!near ? null : (
        <>
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
          {specOf("theme", cosKey)?.theme ? <ThemeArt themeKey={cosKey} t={specOf("theme", cosKey)!.theme!} /> : null}
          <span className="cos-theme-orb cos-theme-orb--1" />
          <i />
          <i />
        </span>
      ) : null}
        </>
      )}
    </span>
  );
}
