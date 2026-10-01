"use client";

import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import type { Flair } from "../../lib/cosmetics";
import { FlairBanner, FlairName, Framed } from "../cosmetic-flair";

// Store eye candy: the animated backdrop, a celebration burst, counting numbers, card tilt and
// the "try it on" profile preview. Everything calms down for people who prefer reduced motion.

/** The living backdrop behind the store: drifting color glows and floating sparkles. */
export function StoreBackdrop() {
  // Fixed positions (no randomness on the server) so the page doesn't shift when it loads
  const sparks = Array.from({ length: 22 }, (_, i) => ({ x: (i * 37) % 100, d: 9 + ((i * 7) % 11), delay: -((i * 13) % 17), s: 3 + (i % 4) }));
  return (
    <div className="store-bg" aria-hidden="true">
      <span className="store-orb store-orb--1" />
      <span className="store-orb store-orb--2" />
      <span className="store-orb store-orb--3" />
      <span className="store-grid-glow" />
      {sparks.map((p, i) => (
        <span key={i} className="store-spark" style={{ "--x": `${p.x}%`, "--d": `${p.d}s`, "--delay": `${p.delay}s`, "--s": `${p.s}px` } as CSSProperties} />
      ))}
    </div>
  );
}

/** A burst of confetti from the middle of the screen (after a purchase). */
export function Celebrate({ fire }: { fire: number }) {
  const [pieces, setPieces] = useState<{ id: number; x: number; y: number; r: number; c: string; d: number }[]>([]);
  useEffect(() => {
    if (!fire) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const colors = ["#f59b2a", "#ffd27a", "#ff4d8d", "#b46cff", "#3e9bff", "#46a758"];
    const batch = Array.from({ length: 46 }, (_, i) => {
      const angle = (Math.PI * 2 * i) / 46 + Math.random() * 0.4;
      const dist = 160 + Math.random() * 260;
      return { id: fire * 100 + i, x: Math.cos(angle) * dist, y: Math.sin(angle) * dist - 120, r: Math.random() * 720 - 360, c: colors[i % colors.length], d: 0.9 + Math.random() * 0.7 };
    });
    setPieces(batch);
    const t = window.setTimeout(() => setPieces([]), 1800);
    return () => window.clearTimeout(t);
  }, [fire]);
  if (!pieces.length) return null;
  return (
    <div className="store-confetti" aria-hidden="true">
      {pieces.map((p) => (
        <span key={p.id} style={{ "--x": `${p.x}px`, "--y": `${p.y}px`, "--r": `${p.r}deg`, "--c": p.c, "--d": `${p.d}s` } as CSSProperties} />
      ))}
    </div>
  );
}

/** A number that counts to its new value. */
export function CountUp({ value }: { value: number }) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const start = from.current;
    if (start === value) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      from.current = value;
      setShown(value);
      return;
    }
    const t0 = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / 700);
      const eased = 1 - Math.pow(1 - k, 3);
      setShown(Math.round(start + (value - start) * eased));
      if (k < 1) raf = requestAnimationFrame(tick);
      else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{shown.toLocaleString()}</>;
}

/** Card tilt that follows the pointer (sets --rx/--ry/--mx/--my on the card). */
export function tiltHandlers() {
  return {
    onPointerMove: (e: PointerEvent<HTMLElement>) => {
      if (e.pointerType !== "mouse") return;
      const el = e.currentTarget;
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width;
      const y = (e.clientY - r.top) / r.height;
      el.style.setProperty("--rx", `${(0.5 - y) * 7}deg`);
      el.style.setProperty("--ry", `${(x - 0.5) * 9}deg`);
      el.style.setProperty("--mx", `${x * 100}%`);
      el.style.setProperty("--my", `${y * 100}%`);
    },
    onPointerLeave: (e: PointerEvent<HTMLElement>) => {
      const el = e.currentTarget;
      el.style.setProperty("--rx", "0deg");
      el.style.setProperty("--ry", "0deg");
    },
  };
}

/** A mini profile card wearing the given cosmetics (store previews and the Locker). */
export function MiniProfile({ me, flair, title, compact }: { me: { name: string; avatar: string | null }; flair: Flair; title?: { text: string; hue: string } | null; compact?: boolean }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className={`store-mini${compact ? " is-compact" : ""}${flair.banner ? " has-cos-banner" : ""}`}>
      <FlairBanner banner={flair.banner} />
      <Framed frame={flair.frame} className="store-mini-frame">
        <span className="store-mini-avatar">
          {me.avatar && !failed ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={me.avatar} alt="" onError={() => setFailed(true)} />
          ) : (
            <b>{me.name.charAt(0).toUpperCase()}</b>
          )}
        </span>
      </Framed>
      <strong className="store-mini-name">
        <FlairName nameplate={flair.nameplate} text={me.name}>
          {me.name}
        </FlairName>
      </strong>
      {title ? (
        <span className="st-title-pill acct-badge-title cos-title" style={{ "--hue": title.hue } as CSSProperties}>
          {title.text}
        </span>
      ) : null}
    </div>
  );
}
