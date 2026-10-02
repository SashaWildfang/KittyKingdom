"use client";

import { Dices, Spade, Ticket as TicketIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { PublicTable } from "../../lib/games/blackjack";
import type { Ticket } from "../../lib/games/scratch";
import { LeafEmote } from "../ui-icons";
import { BlackjackTable } from "./blackjack";
import { ScratchOffs } from "./scratch";

export type ScratchStatus = { used: number; limit: number | null; nitro: boolean };

/** Counts smoothly from the last shown value to a new one. */
export function CountUp({ value, duration = 700 }: { value: number; duration?: number }) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(Math.round(a + (value - a) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
      else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      from.current = value;
    };
  }, [value, duration]);
  return <>{shown.toLocaleString()}</>;
}

/** A burst of confetti from the middle of its parent. */
export function Confetti({ burst, big }: { burst: number; big?: boolean }) {
  if (!burst) return null;
  const n = big ? 90 : 40;
  const colors = ["#ffd56a", "#3ddc84", "#ff4d8d", "#4dc3ff", "#b46cff", "#ffffff"];
  return (
    <span key={burst} className="gm-confetti" aria-hidden="true">
      {Array.from({ length: n }, (_, i) => {
        const angle = (i / n) * Math.PI * 2 + (i % 3) * 0.3;
        const dist = 120 + ((i * 37) % 160) * (big ? 1.6 : 1);
        return (
          <i
            key={i}
            style={
              {
                "--x": `${Math.cos(angle) * dist}px`,
                "--y": `${Math.sin(angle) * dist - 80}px`,
                "--r": `${(i * 47) % 720}deg`,
                "--d": `${(i % 7) * 30}ms`,
                background: colors[i % colors.length],
              } as React.CSSProperties
            }
          />
        );
      })}
    </span>
  );
}

export function GamesClient({
  initialGame,
  initialBalance,
  initialTable,
  initialScratch,
  tickets,
  minBet,
  loadError,
}: {
  initialGame: "blackjack" | "scratch";
  initialBalance: number;
  initialTable: PublicTable | null;
  initialScratch: ScratchStatus;
  tickets: Ticket[];
  minBet: number;
  loadError: boolean;
}) {
  const [game, setGame] = useState(initialGame);
  const [balance, setBalance] = useState(initialBalance);

  const pick = (g: "blackjack" | "scratch") => {
    setGame(g);
    const url = new URL(window.location.href);
    url.searchParams.set("game", g);
    window.history.replaceState(null, "", url);
  };

  return (
    <section className="gm">
      <header className="gm-head">
        <div className="gm-title">
          <span className="gm-title-icon">
            <Dices size={26} aria-hidden="true" />
          </span>
          <div>
            <p className="eyebrow">Kitty Kingdom Casino</p>
            <h1>Games</h1>
            <p className="gm-sub">Play with the same leaves you earn in the server. Same tables, same odds as the bot.</p>
          </div>
        </div>
        <div className="gm-balance" aria-live="polite">
          <span>Balance</span>
          <strong>
            <LeafEmote size={20} /> <CountUp value={balance} />
          </strong>
        </div>
      </header>

      <nav className="gm-tabs" role="tablist" aria-label="Games">
        <button type="button" role="tab" aria-selected={game === "blackjack"} className={game === "blackjack" ? "is-on" : ""} onClick={() => pick("blackjack")}>
          <Spade size={16} aria-hidden="true" /> Blackjack
        </button>
        <button type="button" role="tab" aria-selected={game === "scratch"} className={game === "scratch" ? "is-on" : ""} onClick={() => pick("scratch")}>
          <TicketIcon size={16} aria-hidden="true" /> Scratch-offs
        </button>
        <span className="gm-tab-ink" style={{ transform: `translateX(${game === "blackjack" ? 0 : 100}%)` }} aria-hidden="true" />
      </nav>

      {loadError ? <p className="gm-error">Some game data didn&apos;t load. Refresh the page if something looks off.</p> : null}

      <div className="gm-stage">
        {game === "blackjack" ? (
          <BlackjackTable initialTable={initialTable} balance={balance} onBalance={setBalance} minBet={minBet} />
        ) : (
          <ScratchOffs tickets={tickets} balance={balance} onBalance={setBalance} initialStatus={initialScratch} />
        )}
      </div>
    </section>
  );
}
