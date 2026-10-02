"use client";

import { Cherry, Dices, Radio, Spade, Ticket as TicketIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { PublicTable } from "../../lib/games/blackjack";
import type { Ticket } from "../../lib/games/scratch";
import { LeafEmote } from "../ui-icons";
import { BlackjackTable } from "./blackjack";
import { LiveGames } from "./live";
import { ScratchOffs } from "./scratch";
import { Slots, type SlotsStatus } from "./slots";

export type ScratchStatus = { nitro: boolean };
type Game = "blackjack" | "slots" | "scratch" | "live";
const TABS: Game[] = ["blackjack", "slots", "scratch", "live"];

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

const memberTable = (id: string) => `/api/games/live?table=${encodeURIComponent(id)}`;

export function GamesClient({
  initialGame,
  initialWatch = null,
  initialBalance,
  initialTable,
  initialScratch,
  initialSlots,
  tickets,
  minBet,
  loadError,
}: {
  initialGame: Game;
  initialWatch?: string | null;
  initialBalance: number;
  initialTable: PublicTable | null;
  initialScratch: ScratchStatus;
  initialSlots: SlotsStatus;
  tickets: Ticket[];
  minBet: number;
  loadError: boolean;
}) {
  const [game, setGame] = useState(initialGame);
  const [balance, setBalance] = useState(initialBalance);

  const [liveCount, setLiveCount] = useState<number | null>(null);
  const [audience, setAudience] = useState({ blackjack: 0, scratch: 0, slots: 0 });
  // Games you can't just walk away from mid-play (a blackjack hand, a ticket being scratched)
  const [active, setActive] = useState({ blackjack: false, scratch: false });
  const [leaving, setLeaving] = useState<{ from: "blackjack" | "scratch"; to: Game } | null>(null);
  const [quitting, setQuitting] = useState(false);
  const bjControl = useRef<{ quit: () => Promise<void> } | null>(null);
  const scControl = useRef<{ quit: () => Promise<void> } | null>(null);
  const onBjActive = useCallback((a: boolean) => setActive((s) => (s.blackjack === a ? s : { ...s, blackjack: a })), []);
  const onScActive = useCallback((a: boolean) => setActive((s) => (s.scratch === a ? s : { ...s, scratch: a })), []);

  const go = (g: Game) => {
    setGame(g);
    const url = new URL(window.location.href);
    url.searchParams.set("game", g);
    url.searchParams.delete("watch");
    window.history.replaceState(null, "", url);
  };

  // Going to watch others while you're mid-game asks first (you can't watch your own table)
  const pick = (g: Game) => {
    if (g === game) return;
    if (g === "live" && active.blackjack) return setLeaving({ from: "blackjack", to: g });
    if (g === "live" && active.scratch) return setLeaving({ from: "scratch", to: g });
    go(g);
  };

  const leave = async (quit: boolean) => {
    if (!leaving) return;
    if (quit) {
      setQuitting(true);
      await (leaving.from === "blackjack" ? bjControl : scControl).current?.quit().catch(() => undefined);
      setQuitting(false);
    }
    const to = leaving.to;
    setLeaving(null);
    if (quit) go(to);
    else go(leaving.from);
  };

  // While you play, keep an eye on how many people are watching you
  useEffect(() => {
    if (game === "live") return;
    let stop = false;
    const tick = () =>
      fetch("/api/games/audience", { cache: "no-store" })
        .then((r) => r.json())
        .then((r) => !stop && r?.ok && setAudience({ blackjack: r.blackjack, scratch: r.scratch, slots: r.slots ?? 0 }))
        .catch(() => undefined);
    void tick();
    const t = setInterval(tick, 5000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [game]);

  // The live-table count on the Live tab, even while you're on another tab
  useEffect(() => {
    if (game === "live") return;
    let stop = false;
    const tick = () =>
      fetch("/api/games/live", { cache: "no-store" })
        .then((r) => r.json())
        .then((r) => !stop && r?.ok && setLiveCount(r.live.filter((x: { live: boolean }) => x.live).length))
        .catch(() => undefined);
    void tick();
    const t = setInterval(tick, 15000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [game]);
  const tabIndex = TABS.indexOf(game);

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
        <button type="button" role="tab" aria-selected={game === "slots"} className={game === "slots" ? "is-on" : ""} onClick={() => pick("slots")}>
          <Cherry size={16} aria-hidden="true" /> Slots
        </button>
        <button type="button" role="tab" aria-selected={game === "scratch"} className={game === "scratch" ? "is-on" : ""} onClick={() => pick("scratch")}>
          <TicketIcon size={16} aria-hidden="true" /> Scratch-offs
        </button>
        <button type="button" role="tab" aria-selected={game === "live"} className={game === "live" ? "is-on" : ""} onClick={() => pick("live")}>
          <Radio size={16} aria-hidden="true" /> Live
          {liveCount ? <span className="gm-tab-badge">{liveCount}</span> : null}
        </button>
        <span className="gm-tab-ink" style={{ transform: `translateX(${tabIndex * 100}%)` }} aria-hidden="true" />
      </nav>

      {loadError ? <p className="gm-error">Some game data didn&apos;t load. Refresh the page if something looks off.</p> : null}

      {/* Every game stays mounted while you look at another, so a hand or a ticket is right where you left it */}
      <div className="gm-stage">
        <div hidden={game !== "blackjack"}>
          <BlackjackTable initialTable={initialTable} balance={balance} onBalance={setBalance} minBet={minBet} viewers={audience.blackjack} onActive={onBjActive} control={bjControl} />
        </div>
        <div hidden={game !== "slots"}>
          <Slots balance={balance} onBalance={setBalance} initialStatus={initialSlots} viewers={audience.slots} />
        </div>
        <div hidden={game !== "scratch"}>
          <ScratchOffs tickets={tickets} balance={balance} onBalance={setBalance} initialStatus={initialScratch} viewers={audience.scratch} onActive={onScActive} control={scControl} />
        </div>
        {game === "live" ? <LiveGames listUrl="/api/games/live" tableUrl={memberTable} minBet={minBet} initialWatch={initialWatch} privacy onCount={setLiveCount} /> : null}
      </div>

      {leaving ? (
        <div className="gm-modal" role="dialog" aria-modal="true" aria-labelledby="gm-leave-title">
          <div className="gm-modal-card">
            <h2 id="gm-leave-title">{leaving.from === "blackjack" ? "You're in the middle of a hand" : "You're still scratching a ticket"}</h2>
            <p>
              {leaving.from === "blackjack"
                ? "Finish it before you go watch other tables, or stand on what you have and let the dealer play it out."
                : "Your prize is already locked in. Finish scratching, or reveal the rest of the ticket and go."}
            </p>
            <div className="gm-modal-actions">
              <button type="button" className="sc-btn is-primary" onClick={() => leave(false)} disabled={quitting} autoFocus>
                {leaving.from === "blackjack" ? "Back to my hand" : "Back to my ticket"}
              </button>
              <button type="button" className="sc-btn" onClick={() => leave(true)} disabled={quitting}>
                {quitting ? "Finishing…" : leaving.from === "blackjack" ? "Stand and go to Live" : "Reveal it and go to Live"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
