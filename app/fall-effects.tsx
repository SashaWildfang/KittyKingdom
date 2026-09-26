"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";

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

type LeafSpec = { shape: Shape; color: string; left: number; size: number; fall: number; delay: number; sway: number; swayX: number; spin: number; opacity: number };

function makeLeaves(count: number, seed: number, sizeRange: [number, number]): LeafSpec[] {
  const rand = seeded(seed);
  const shapes = Object.keys(LEAF_SHAPES) as Shape[];
  return Array.from({ length: count }, (_, i) => {
    const fall = 13 + rand() * 13;
    return {
      shape: shapes[Math.floor(rand() * shapes.length)],
      color: LEAF_COLORS[Math.floor(rand() * LEAF_COLORS.length)],
      left: ((i + rand()) / count) * 100,
      size: sizeRange[0] + rand() * (sizeRange[1] - sizeRange[0]),
      fall,
      delay: -rand() * fall,
      sway: 2.6 + rand() * 2.4,
      swayX: 30 + rand() * 70,
      spin: 3 + rand() * 4,
      opacity: 0.7 + rand() * 0.3,
    };
  });
}

const BACK_LEAVES = makeLeaves(22, 42, [16, 30]);
const FRONT_LEAVES = makeLeaves(4, 7, [46, 64]);

function Leaf({ leaf }: { leaf: LeafSpec }) {
  return (
    <span
      className="fx-leaf"
      style={
        {
          left: `${leaf.left}%`,
          "--fall": `${leaf.fall}s`,
          "--delay": `${leaf.delay}s`,
          "--sway": `${leaf.sway}s`,
          "--sway-x": `${leaf.swayX}px`,
          "--spin": `${leaf.spin}s`,
          opacity: leaf.opacity,
        } as CSSProperties
      }
    >
      <span className="fx-leaf-sway">
        <span className="fx-leaf-spin">
          <LeafSvg shape={leaf.shape} color={leaf.color} size={Math.round(leaf.size)} />
        </span>
      </span>
    </span>
  );
}

/** Real leaf shapes drifting down the page: a layer behind the content and a few big blurred ones in front. */
export function FallingLeaves({ foreground = true }: { foreground?: boolean }) {
  return (
    <>
      <div className="fx-leaves" aria-hidden="true">
        {BACK_LEAVES.map((leaf, i) => (
          <Leaf key={i} leaf={leaf} />
        ))}
      </div>
      {foreground ? (
        <div className="fx-leaves fx-leaves--front" aria-hidden="true">
          {FRONT_LEAVES.map((leaf, i) => (
            <Leaf key={i} leaf={leaf} />
          ))}
        </div>
      ) : null}
    </>
  );
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

    // Leaf burst on click
    const shapes = Object.keys(LEAF_SHAPES) as Shape[];
    function burst(event: MouseEvent) {
      const target = (event.target as HTMLElement | null)?.closest("[data-leaf-burst]");
      if (!target || reducedMotion()) return;
      const rect = target.getBoundingClientRect();
      const x = event.clientX || rect.left + rect.width / 2;
      const y = event.clientY || rect.top + rect.height / 2;
      for (let i = 0; i < 12; i += 1) {
        const angle = (Math.PI * 2 * i) / 12 + Math.random() * 0.5;
        const distance = 50 + Math.random() * 70;
        const piece = document.createElement("span");
        piece.className = "fx-burst";
        const shape = shapes[i % shapes.length];
        piece.innerHTML = `<svg viewBox="0 0 100 100" width="18" height="18"><path d="${LEAF_SHAPES[shape]}" fill="${LEAF_COLORS[i % LEAF_COLORS.length]}"/></svg>`;
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
  }, []);

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
