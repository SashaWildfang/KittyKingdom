"use client";

// Interactive and season-aware pieces of the homepage (app/page.tsx).

import { useEffect, useRef, useState } from "react";
import { SEASONS, nextSeason, seasonWindow } from "../lib/seasons";
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

/** The level roles for this season (a few, or the whole ladder). */
export function LevelLadder({ compact = false }: { compact?: boolean }) {
  const { levels } = useSeason();
  const shown = compact ? [levels[0], levels[5], levels[10]] : levels;
  return (
    <ol className={`lp-ladder${compact ? " is-compact" : ""}`}>
      {shown.map((r, i) => (
        <li key={r.range} style={{ ["--role" as string]: r.color, ["--i" as string]: i }}>
          <span className="lp-ladder-emoji" aria-hidden="true">
            {r.emoji}
          </span>
          <span className="lp-ladder-name">{r.name}</span>
          <small>Lv {r.range}</small>
        </li>
      ))}
    </ol>
  );
}

/** "This season in the kingdom": name, currency, countdown and the level ladder. */
export function SeasonFeature() {
  const s = useSeason();
  const info = SEASONS[s.key];
  const next = SEASONS[nextSeason(s.key)];
  const [days, setDays] = useState<number | null>(null);
  useEffect(() => {
    const w = seasonWindow(s.key, new Date());
    setDays(Math.max(0, Math.ceil((new Date(`${w.end}T00:00:00`).getTime() - Date.now()) / 86_400_000)));
  }, [s.key]);
  return (
    <div className="lp-season">
      <div className="lp-season-copy">
        <p className="lp-eyebrow">This season</p>
        <h2>
          <span aria-hidden="true">{info.icon}</span> {info.name} in the kingdom
        </h2>
        <p className="lp-lead">{info.blurb}. The whole server dresses up for it: the website, the currency, channel emojis and the level roles all change with the seasons.</p>
        <ul className="lp-season-facts">
          <li>
            <LeafEmote size={22} />
            <span>
              <b>{s.many}</b>
              <small>this season&apos;s currency</small>
            </span>
          </li>
          <li>
            <span className="lp-season-icon" aria-hidden="true">
              {next.icon}
            </span>
            <span>
              <b>{days === null ? "Soon" : `${days} days`}</b>
              <small>until {next.name}</small>
            </span>
          </li>
        </ul>
      </div>
      <div className="lp-season-ladder">
        <p className="lp-eyebrow">{info.name} level roles</p>
        <LevelLadder />
      </div>
    </div>
  );
}
