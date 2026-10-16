"use client";

// Interactive and season-aware pieces of the homepage (app/page.tsx).

import { useEffect, useRef, useState } from "react";
import { useSeason } from "./season-context";
import { LeafEmote } from "./ui-icons";

function reducedMotion() {
  return typeof window !== "undefined" && (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false);
}

/** "Find your ___": cycles through a few words. */
export function RotatingWord({ words }: { words: string[] }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (reducedMotion()) return;
    const t = window.setInterval(() => setI((n) => (n + 1) % words.length), 2600);
    return () => window.clearInterval(t);
  }, [words.length]);
  return (
    <span className="lp-rotate" aria-live="off">
      {/* The longest word keeps the line from jumping */}
      <span className="lp-rotate-ghost" aria-hidden="true">
        {words.reduce((a, b) => (b.length > a.length ? b : a))}
      </span>
      <span key={words[i]} className="lp-rotate-word">
        {words[i]}
      </span>
    </span>
  );
}

/** Counts up to a number the first time it scrolls into view. */
export function CountUp({ value, decimals = 0, suffix = "" }: { value: number; decimals?: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [shown, setShown] = useState(value);
  useEffect(() => {
    const el = ref.current;
    if (!el || reducedMotion() || !("IntersectionObserver" in window)) return;
    setShown(0);
    let frame = 0;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        io.disconnect();
        const start = performance.now();
        const tick = (now: number) => {
          const p = Math.min(1, (now - start) / 1100);
          setShown(value * (1 - Math.pow(1 - p, 3)));
          if (p < 1) frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [value]);
  return (
    <span ref={ref}>
      {shown.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
      {suffix}
    </span>
  );
}

/** The floating "this season" card in the hero. */
export function SeasonBadge() {
  const s = useSeason();
  return (
    <div className="lp-float lp-float--season">
      <LeafEmote size={26} />
      <span>
        <b>{s.name} season</b>
        <small>Earn {s.many.toLowerCase()} as you chat</small>
      </span>
    </div>
  );
}

/** A store preview with prices in the season's currency. */
export function StorePreview() {
  const s = useSeason();
  const items = [
    { name: "Color role", price: 2500, tone: "a" },
    { name: "2x XP Booster", price: 5000, tone: "b" },
    { name: "Cozy coffee gift", price: 150, tone: "c" },
  ];
  return (
    <ul className="lp-mini-store">
      {items.map((it) => (
        <li key={it.name} className={`is-${it.tone}`}>
          <i aria-hidden="true" />
          <span>{it.name}</span>
          <b>
            {it.price.toLocaleString()} <LeafEmote size={14} />
          </b>
        </li>
      ))}
      <li className="lp-mini-store-foot">
        Balance shown in <b>{s.many}</b> this season
      </li>
    </ul>
  );
}


/** A date and time in the visitor's own time zone (rendered after load to avoid a server/browser mismatch). */
export function LocalTime({ iso }: { iso: string }) {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    setText(new Date(iso).toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" }));
  }, [iso]);
  return <time dateTime={iso}>{text ?? "\u00a0"}</time>;
}

/** The month/day box for an event, in the visitor's time zone. */
export function LocalDateBlock({ iso }: { iso: string }) {
  const [d, setD] = useState<Date | null>(null);
  useEffect(() => setD(new Date(iso)), [iso]);
  return (
    <span className="lp-event-date" aria-hidden="true">
      <small>{d ? d.toLocaleDateString([], { month: "short" }) : "\u00a0"}</small>
      <b>{d ? d.getDate() : "\u00a0"}</b>
    </span>
  );
}
