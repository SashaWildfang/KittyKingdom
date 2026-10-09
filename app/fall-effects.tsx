"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { useSeason } from "./season-context";
import type { SeasonKey } from "../lib/seasons";

// ==========================================
// Leaf shapes (100×100 viewBox, stem at the bottom)
// ==========================================
const LEAF_SHAPES = {
  maple:
    "M50 4 L57 21 L68 15 L64 37 L80 29 L76 41 L96 45 L82 55 L88 63 L64 63 L66 76 L53 69 L52 94 L48 94 L47 69 L34 76 L36 63 L12 63 L18 55 L4 45 L24 41 L20 29 L36 37 L32 15 L43 21 Z",
  oak: "M50 4 C58 10 54 18 60 22 C68 20 70 30 64 34 C72 36 74 46 66 50 C74 54 72 64 64 64 C68 72 62 80 54 76 L52 95 L48 95 L46 76 C38 80 32 72 36 64 C28 64 26 54 34 50 C26 46 28 36 36 34 C30 30 32 20 40 22 C46 18 42 10 50 4 Z",
  birch: "M50 5 C74 22 80 52 53 82 L52 95 L48 95 L47 82 C20 52 26 22 50 5 Z",
} as const;

const LEAF_VEINS = {
  maple: "M50 90 L50 12 M50 60 L22 44 M50 60 L78 44 M50 48 L34 24 M50 48 L66 24 M50 70 L36 64 M50 70 L64 64",
  oak: "M50 92 L50 10 M50 30 L40 24 M50 30 L60 24 M50 44 L36 36 M50 44 L64 36 M50 58 L34 52 M50 58 L66 52",
  birch: "M50 92 L50 10 M50 30 L38 22 M50 30 L62 22 M50 46 L34 36 M50 46 L66 36 M50 62 L36 54 M50 62 L64 54",
} as const;

type Shape = keyof typeof LEAF_SHAPES;

const LEAF_COLORS = ["#c0392b", "#e25822", "#f39c12", "#d35400", "#b5651d", "#e1a33b", "#9b2d1a", "#f5b041"];

export function LeafSvg({ shape, color, size = 28 }: { shape: Shape; color: string; size?: number }) {
  return (
    <svg className="fx-leaf-svg" viewBox="0 0 100 100" width={size} height={size} aria-hidden="true" style={{ color }}>
      <path d={LEAF_SHAPES[shape]} fill="currentColor" />
      <path d={LEAF_VEINS[shape]} fill="none" stroke="rgba(60, 20, 5, 0.35)" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

// Seeded random so server and browser render the same leaves
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/** Kept for older pages: the season's particles now drift behind every page (app/season-backdrop.tsx). */
export function FallingLeaves(_props: { foreground?: boolean }) {
  return null;
}

// ==========================================
// Season glyphs: the season's motif as a small SVG (leaf, snowflake, butterfly, crab/shell)
// ==========================================
const SNOWFLAKE =
  "M50 6 V94 M12 28 L88 72 M12 72 L88 28 M50 6 L42 16 M50 6 L58 16 M50 94 L42 84 M50 94 L58 84 M12 28 L24 28 M12 28 L18 38 M88 72 L76 72 M88 72 L82 62 M12 72 L18 62 M12 72 L24 72 M88 28 L82 38 M88 28 L76 28";
const BUTTERFLY =
  "M50 30 C40 8 8 6 10 32 C12 50 34 52 46 48 C30 56 20 76 34 86 C44 92 50 76 50 62 C50 76 56 92 66 86 C80 76 70 56 54 48 C66 52 88 50 90 32 C92 6 60 8 50 30 Z";
const SHELL =
  "M50 10 C24 10 8 36 12 62 L30 86 C38 92 62 92 70 86 L88 62 C92 36 76 10 50 10 Z M50 14 L50 88 M50 14 L30 84 M50 14 L70 84 M50 14 L18 64 M50 14 L82 64";
const CRAB =
  "M30 30 L22 16 M70 30 L78 16 M22 16 m-9 0 a9 9 0 1 0 18 0 a9 9 0 1 0 -18 0 M78 16 m-9 0 a9 9 0 1 0 18 0 a9 9 0 1 0 -18 0 M24 66 L8 78 M30 72 L18 88 M76 66 L92 78 M70 72 L82 88 M20 56 C20 34 80 34 80 56 C80 74 20 74 20 56 Z";

const GLYPH_COLORS: Record<SeasonKey, string[]> = {
  fall: ["#e25822", "#f39c12", "#c0392b"],
  winter: ["#bfe3ff", "#e6f4ff", "#8fc8ff"],
  spring: ["#f472b6", "#c4b5fd", "#fbcfe8"],
  summer: ["#ff7a59", "#ffd166", "#22b8cf"],
};

/** One season motif. `index` picks the variant/color so a row of them looks varied. */
export function SeasonGlyph({ index = 0, size = 28, color }: { index?: number; size?: number; color?: string }) {
  const { key } = useSeason();
  const fill = color ?? GLYPH_COLORS[key][index % 3];
  if (key === "fall") return <LeafSvg shape={(["maple", "oak", "birch"] as const)[index % 3]} color={fill} size={size} />;
  const stroke = key === "winter" || (key === "summer" && index % 2 === 0);
  const d = key === "winter" ? SNOWFLAKE : key === "spring" ? BUTTERFLY : index % 2 === 0 ? CRAB : SHELL;
  return (
    <svg className="fx-leaf-svg" viewBox="0 0 100 100" width={size} height={size} aria-hidden="true" style={{ color: fill }}>
      {stroke && key === "winter" ? (
        <path d={d} fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
      ) : key === "summer" && index % 2 === 0 ? (
        <path d={d} fill="currentColor" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
      ) : (
        <path d={d} fill="currentColor" stroke={key === "summer" ? "rgba(0,0,0,0.2)" : "none"} strokeWidth="2" />
      )}
      {key === "spring" ? <path d="M50 28 V72" stroke="#3b2340" strokeWidth="4" strokeLinecap="round" /> : null}
    </svg>
  );
}

/** The same motif as an SVG string (for click bursts). */
function glyphMarkup(season: SeasonKey, i: number) {
  const color = GLYPH_COLORS[season][i % 3];
  if (season === "fall") {
    const shapes = Object.keys(LEAF_SHAPES) as Shape[];
    return `<svg viewBox="0 0 100 100" width="18" height="18"><path d="${LEAF_SHAPES[shapes[i % shapes.length]]}" fill="${LEAF_COLORS[i % LEAF_COLORS.length]}"/></svg>`;
  }
  if (season === "winter") return `<svg viewBox="0 0 100 100" width="18" height="18"><path d="${SNOWFLAKE}" fill="none" stroke="${color}" stroke-width="7" stroke-linecap="round"/></svg>`;
  if (season === "spring") return `<svg viewBox="0 0 100 100" width="18" height="18"><path d="${BUTTERFLY}" fill="${color}"/></svg>`;
  return `<svg viewBox="0 0 100 100" width="18" height="18"><path d="${i % 2 ? SHELL : CRAB}" fill="${color}" stroke="${color}" stroke-width="4"/></svg>`;
}

/** Warm embers rising behind the hero. */
export function Embers({ count = 14 }: { count?: number }) {
  const rand = seeded(99);
  return (
    <div className="fx-embers" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          style={
            {
              left: `${rand() * 100}%`,
              "--rise": `${7 + rand() * 8}s`,
              "--delay": `${-rand() * 12}s`,
              "--size": `${3 + rand() * 4}px`,
              "--drift": `${-30 + rand() * 60}px`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}

function reducedMotion() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

/**
 * Page-wide effects for the homepage:
 * - fades sections in as they scroll into view ([data-reveal])
 * - bursts a handful of leaves from buttons marked [data-leaf-burst]
 * - lights up cards under the pointer ([data-spotlight])
 */
export function FallEffects() {
  const season = useSeason();
  useEffect(() => {
    // Scroll reveal
    const targets = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
    let observer: IntersectionObserver | null = null;
    if (reducedMotion() || !("IntersectionObserver" in window)) {
      targets.forEach((el) => el.classList.add("is-in"));
    } else {
      observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              entry.target.classList.add("is-in");
              observer?.unobserve(entry.target);
            }
          }
        },
        { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
      );
      targets.forEach((el) => observer?.observe(el));
    }

    // Season burst on click (leaves, snowflakes, butterflies, shells)
    function burst(event: MouseEvent) {
      const target = (event.target as HTMLElement | null)?.closest("[data-leaf-burst]");
      if (!target || reducedMotion() || !season.bursts) return;
      const rect = target.getBoundingClientRect();
      const x = event.clientX || rect.left + rect.width / 2;
      const y = event.clientY || rect.top + rect.height / 2;
      for (let i = 0; i < 12; i += 1) {
        const angle = (Math.PI * 2 * i) / 12 + Math.random() * 0.5;
        const distance = 50 + Math.random() * 70;
        const piece = document.createElement("span");
        piece.className = "fx-burst";
        piece.innerHTML = glyphMarkup(season.key, i);
        piece.style.left = `${x}px`;
        piece.style.top = `${y}px`;
        piece.style.setProperty("--dx", `${Math.cos(angle) * distance}px`);
        piece.style.setProperty("--dy", `${Math.sin(angle) * distance - 30}px`);
        piece.style.setProperty("--rot", `${Math.random() * 540 - 270}deg`);
        document.body.appendChild(piece);
        piece.addEventListener("animationend", () => piece.remove());
      }
    }
    document.addEventListener("click", burst);

    // Spotlight cards follow the pointer
    function spotlight(event: PointerEvent) {
      const card = (event.target as HTMLElement | null)?.closest<HTMLElement>("[data-spotlight]");
      if (!card) return;
      const rect = card.getBoundingClientRect();
      card.style.setProperty("--mx", `${event.clientX - rect.left}px`);
      card.style.setProperty("--my", `${event.clientY - rect.top}px`);
    }
    document.addEventListener("pointermove", spotlight);

    return () => {
      observer?.disconnect();
      document.removeEventListener("click", burst);
      document.removeEventListener("pointermove", spotlight);
    };
  }, [season.key, season.bursts]);

  return null;
}

/** Tilts its content gently towards the pointer. */
export function TiltCard({ className, children }: { className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || reducedMotion() || window.matchMedia("(hover: none)").matches) return;
    let frame = 0;
    function move(event: PointerEvent) {
      const rect = el!.getBoundingClientRect();
      const px = (event.clientX - rect.left) / rect.width - 0.5;
      const py = (event.clientY - rect.top) / rect.height - 0.5;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        el!.style.setProperty("--tilt-x", `${(-py * 8).toFixed(2)}deg`);
        el!.style.setProperty("--tilt-y", `${(px * 10).toFixed(2)}deg`);
        el!.style.setProperty("--glare-x", `${(px + 0.5) * 100}%`);
        el!.style.setProperty("--glare-y", `${(py + 0.5) * 100}%`);
      });
    }
    function leave() {
      cancelAnimationFrame(frame);
      el!.style.setProperty("--tilt-x", "0deg");
      el!.style.setProperty("--tilt-y", "0deg");
    }
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerleave", leave);
    return () => {
      cancelAnimationFrame(frame);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerleave", leave);
    };
  }, []);

  return (
    <div ref={ref} className={className ? `fx-tilt ${className}` : "fx-tilt"}>
      {children}
    </div>
  );
}
