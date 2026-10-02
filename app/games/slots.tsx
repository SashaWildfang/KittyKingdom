"use client";

import { ChevronDown, Eye, FastForward, Lock, Sparkles, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { PublicSlots } from "../../lib/games/live";
import { emojiUrl, SLOT_SYMBOLS as symbols, type SlotSymbol } from "../../lib/games/slot-symbols";
import type { SpinResult } from "../../lib/games/slots";
import { LeafEmote } from "../ui-icons";
import { Confetti, CountUp } from "./games-client";

export type SlotsStatus = { nitro: boolean; jackpot: number; maxSpins: number };
type Batch = { key: string; bet: number; results: SpinResult[]; payout: number; balance?: number };

const BET_CHIPS = [50, 100, 250, 500, 1000, 5000];
const SPIN_COUNTS = [1, 5, 10, 25];
const STRIP = 14; // symbols that roll past before the reel stops

const compact = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(n % 1_000_000 ? 1 : 0)}M` : n >= 1000 ? `${(n / 1000).toFixed(n % 1000 ? 1 : 0)}K` : String(n));

function Sym({ s, size }: { s: SlotSymbol | undefined; size?: number }) {
  if (!s) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img className="sl-sym" src={emojiUrl(s)} alt={s.name} width={size} height={size} draggable={false} />;
}

/** One reel: a strip of symbols that rolls down and stops with `final` on the payline. */
function Reel({ final, spinKey, seed, duration, onStop, still }: { final: string | null; spinKey: string; seed: number; duration: number; onStop: () => void; still: boolean }) {
  // The strip, top to bottom: the result sits in the middle row at the top, and the rest rolls past it.
  // Before the first spin it's a fixed set of symbols, so the page renders the same on the server.
  const strip = useMemo(() => {
    const at = (i: number) => symbols[(i * 4 + seed * 3) % symbols.length];
    if (!final) return [at(0), at(1), at(2)];
    const rand = () => symbols[Math.floor(Math.random() * symbols.length)];
    return [rand(), symbols.find((s) => s.id === final)!, ...Array.from({ length: STRIP }, rand)];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spinKey]);
  return (
    <div className="sl-reel">
      <div
        key={spinKey}
        className={`sl-strip${still || !final ? " is-still" : ""}`}
        style={{ "--len": strip.length - 3, "--dur": `${duration}ms` } as CSSProperties}
        onAnimationEnd={(e) => e.target === e.currentTarget && onStop()}
      >
        {strip.map((s, i) => (
          <span key={i} className="sl-cell">
            <Sym s={s} />
          </span>
        ))}
      </div>
    </div>
  );
}

/** The machine: plays back a batch of spins one by one (quickly when there are several). */
function Machine({ batch, jackpot, onSpinShown, onDone, skipSignal }: { batch: Batch | null; jackpot: number; onSpinShown?: (i: number) => void; onDone?: () => void; skipSignal?: number }) {
  const [index, setIndex] = useState(0);
  const [stopped, setStopped] = useState(0);
  const [skipped, setSkipped] = useState(false);
  const many = (batch?.results.length ?? 0) > 1;
  const durations = many ? [420, 560, 700] : [1000, 1400, 1800];

  useEffect(() => {
    setIndex(0);
    setStopped(0);
    setSkipped(false);
  }, [batch?.key]);

  useEffect(() => {
    if (!skipSignal || !batch) return;
    setSkipped(true);
    setIndex(batch.results.length - 1);
    setStopped(3);
    for (let i = 0; i < batch.results.length; i++) onSpinShown?.(i);
    onDone?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skipSignal]);

  const spin = batch?.results[index] ?? null;
  const landed = !!batch && stopped >= 3;

  // A spin finished: report it, then roll the next one
  useEffect(() => {
    if (!batch || !landed || skipped) return;
    onSpinShown?.(index);
    if (index < batch.results.length - 1) {
      const t = setTimeout(() => {
        setStopped(0);
        setIndex((i) => i + 1);
      }, spin && spin.kind !== "loss" && spin.kind !== "pair" ? 900 : 260);
      return () => clearTimeout(t);
    }
    onDone?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [landed, index, batch?.key]);

  const result = landed ? spin : null;
  const spinKey = `${batch?.key ?? "idle"}-${index}`;

  return (
    <div className={`sl-machine${result ? ` is-${result.kind}` : ""}`}>
      <div className="sl-marquee">
        <span className="sl-lights is-top" aria-hidden="true">
          {Array.from({ length: 14 }, (_, i) => (
            <i key={i} style={{ "--i": i } as CSSProperties} />
          ))}
        </span>
        <small>Progressive jackpot</small>
        <strong>
          <CountUp value={jackpot} /> <LeafEmote size={20} />
        </strong>
        <span className="sl-lights is-bottom" aria-hidden="true">
          {Array.from({ length: 14 }, (_, i) => (
            <i key={i} style={{ "--i": 13 - i } as CSSProperties} />
          ))}
        </span>
      </div>
      <div className="sl-window">
        {[0, 1, 2].map((r) => (
          <Reel
            key={r}
            final={spin?.reels[r] ?? null}
            spinKey={spinKey}
            seed={r}
            duration={durations[r]}
            still={!batch || skipped}
            onStop={() => setStopped((n) => n + 1)}
          />
        ))}
        <span className="sl-payline" aria-hidden="true" />
      </div>
      <div className="sl-readout" role="status">
        {!batch ? (
          "Place your bet and pull!"
        ) : !result ? (
          many ? `Spin ${index + 1} of ${batch.results.length}…` : "Spinning…"
        ) : result.kind === "jackpot" ? (
          <b className="is-jackpot">JACKPOT! +{result.payout.toLocaleString()}</b>
        ) : result.kind === "triple" ? (
          <b className="is-win">Three of a kind! +{result.payout.toLocaleString()}</b>
        ) : result.kind === "pair" ? (
          <b className="is-pair">A pair: bet back</b>
        ) : (
          <b className="is-loss">No match</b>
        )}
      </div>
    </div>
  );
}

function Feed({ batch, shown }: { batch: Batch; shown: number }) {
  const byId = new Map(symbols.map((s) => [s.id, s]));
  const rows = batch.results.slice(0, shown).map((r, i) => ({ ...r, i })).reverse();
  return (
    <ol className="sl-feed">
      {rows.map((r) => (
        <li key={r.i} className={`is-${r.kind}`}>
          <span className="sl-feed-n">#{r.i + 1}</span>
          <span className="sl-feed-reels">
            {r.reels.map((id, j) => (
              <Sym key={j} s={byId.get(id)} size={22} />
            ))}
          </span>
          <b>{r.kind === "loss" ? `−${batch.bet.toLocaleString()}` : r.kind === "pair" ? "±0" : `+${(r.payout - batch.bet).toLocaleString()}`}</b>
        </li>
      ))}
    </ol>
  );
}

function Summary({ batch }: { batch: Batch }) {
  const cost = batch.bet * batch.results.length;
  const net = batch.payout - cost;
  return (
    <div className={`sl-summary ${net > 0 ? "is-up" : net < 0 ? "is-down" : ""}`}>
      <span>
        Wagered <b>{cost.toLocaleString()}</b>
      </span>
      <span>
        Returned <b>{batch.payout.toLocaleString()}</b>
      </span>
      <span>
        Net{" "}
        <b>
          {net > 0 ? "+" : ""}
          {net.toLocaleString()}
        </b>{" "}
        <LeafEmote size={14} />
      </span>
    </div>
  );
}

export function Slots({ balance, onBalance, initialStatus, viewers = 0 }: { balance: number; onBalance: (n: number) => void; initialStatus: SlotsStatus; viewers?: number }) {
  const [status, setStatus] = useState(initialStatus);
  const [bet, setBet] = useState(100);
  const [spins, setSpins] = useState(1);
  const [batch, setBatch] = useState<Batch | null>(null);
  const [shown, setShown] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [burst, setBurst] = useState(0);
  const [skip, setSkip] = useState(0);
  const [odds, setOdds] = useState(false);
  const jackpotAfter = useRef<number | null>(null);

  const cost = bet * spins;

  const spin = useCallback(async () => {
    if (busy || playing) return;
    if (bet < 50) return setError("The minimum bet is 50 leaves a spin.");
    if (cost > balance) return setError("You don't have enough leaves for that.");
    setBusy(true);
    setError(null);
    const res = await fetch("/api/games/slots", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ bet, spins }) })
      .then((r) => r.json())
      .catch(() => ({ ok: false, error: "Something went wrong." }));
    setBusy(false);
    if (!res.ok) return setError(res.error ?? "That didn't work.");
    // Show the cost now; winnings land as the reels stop
    onBalance(res.balance - res.payout);
    jackpotAfter.current = res.jackpot;
    setShown(0);
    setPlaying(true);
    setBatch({ key: String(res.batch) + Date.now(), bet: res.bet, results: res.results, payout: res.payout, balance: res.balance });
  }, [busy, playing, bet, cost, balance, spins, onBalance]);

  const onSpinShown = useCallback((i: number) => setShown((n) => Math.max(n, i + 1)), []);
  const onDone = useCallback(() => {
    setPlaying(false);
    setBatch((b) => {
      if (b?.balance !== undefined) onBalance(b.balance);
      if (b && b.payout > b.bet * b.results.length) setBurst(Date.now());
      return b;
    });
    if (jackpotAfter.current !== null) setStatus((s) => ({ ...s, jackpot: jackpotAfter.current! }));
  }, [onBalance]);

  // Space or Enter pulls the lever
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT" || (e.target as HTMLElement)?.tagName === "BUTTON" || e.metaKey || e.ctrlKey) return;
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        void spin();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [spin]);

  // Keep the jackpot fresh while idle (other members feed it too)
  useEffect(() => {
    const t = setInterval(() => {
      if (playing) return;
      fetch("/api/games/slots", { cache: "no-store" })
        .then((r) => r.json())
        .then((r) => r?.ok && setStatus((s) => ({ ...s, jackpot: r.jackpot })))
        .catch(() => undefined);
    }, 20000);
    return () => clearInterval(t);
  }, [playing]);

  const many = (batch?.results.length ?? 0) > 1;

  return (
    <div className="sl">
      <div className="sl-stage">
        {viewers > 0 ? (
          <span className="gm-watching" title={`${viewers} watching`}>
            <Eye size={13} aria-hidden="true" /> {viewers} watching
          </span>
        ) : null}
        <Machine batch={batch} jackpot={status.jackpot} onSpinShown={onSpinShown} onDone={onDone} skipSignal={skip} />
        <Confetti burst={burst} big={batch?.results.some((r) => r.kind === "jackpot")} />
      </div>

      {error ? (
        <p className="gm-error" role="alert">
          {error}
          <button type="button" onClick={() => setError(null)} aria-label="Dismiss">
            <X size={14} />
          </button>
        </p>
      ) : null}

      <div className="sl-panel">
        <div className="sl-field">
          <span className="sl-field-label">Bet per spin</span>
          <div className="sl-stepper">
            <button type="button" onClick={() => setBet((b) => Math.max(50, b >= 1000 ? b - 500 : b - 50))} disabled={bet <= 50} aria-label="Lower the bet">
              −
            </button>
            <label>
              <LeafEmote size={16} />
              <input type="number" min={50} step={50} value={bet} onChange={(e) => setBet(Math.max(0, Math.floor(Number(e.target.value) || 0)))} aria-label="Bet per spin" />
            </label>
            <button type="button" onClick={() => setBet((b) => (b >= 1000 ? b + 500 : b + 50))} aria-label="Raise the bet">
              +
            </button>
          </div>
          <div className="sl-quick" role="group" aria-label="Quick bets">
            {BET_CHIPS.map((c) => (
              <button key={c} type="button" className={bet === c ? "is-on" : ""} onClick={() => setBet(c)} disabled={c > balance}>
                {compact(c)}
              </button>
            ))}
          </div>
        </div>
        <div className="sl-field">
          <span className="sl-field-label">Spins at once</span>
          <div className="sl-seg" role="group" aria-label="Spins at once">
            {SPIN_COUNTS.map((n) => {
              const locked = n > status.maxSpins;
              return (
                <button key={n} type="button" className={spins === n ? "is-on" : ""} disabled={locked} onClick={() => setSpins(n)} title={locked ? "Extra spins are for Nitro boosters" : `${n} spin${n > 1 ? "s" : ""}`}>
                  {locked ? <Lock size={12} aria-hidden="true" /> : null}×{n}
                </button>
              );
            })}
          </div>
          {status.maxSpins <= 1 ? (
            <p className="sl-nitro-note">
              <Lock size={13} aria-hidden="true" /> Extra spins (×5, ×10, ×25) are for <b>Nitro boosters</b> only.
            </p>
          ) : (
            <p className="sl-nitro-note is-on">
              <Sparkles size={13} aria-hidden="true" /> Nitro booster: spin up to 25 times at once.
            </p>
          )}
        </div>
        {playing && many ? (
          <button type="button" className="sl-pull is-skip" onClick={() => setSkip(Date.now())}>
            <FastForward size={18} aria-hidden="true" /> Skip to the end
          </button>
        ) : (
          <button type="button" className="sl-pull" disabled={busy || playing || bet < 50 || cost > balance} onClick={spin}>
            <span>{busy ? "Pulling…" : spins > 1 ? `Spin ×${spins}` : "Spin"}</span>
            <small>
              {spins > 1 ? `${spins} × ${bet.toLocaleString()} = ` : ""}
              {cost.toLocaleString()} <LeafEmote size={13} />
            </small>
          </button>
        )}
      </div>

      {batch && many ? (
        <div className="sl-results">
          {!playing ? <Summary batch={batch} /> : null}
          <Feed batch={batch} shown={shown} />
        </div>
      ) : null}

      <div className={`gm-rules${odds ? " is-open" : ""}`}>
        <button type="button" onClick={() => setOdds((o) => !o)} aria-expanded={odds}>
          Paytable & odds <ChevronDown size={16} aria-hidden="true" />
        </button>
        {odds ? <Paytable /> : null}
      </div>
    </div>
  );
}

function Paytable() {
  const total = symbols.reduce((a, s) => a + s.weight, 0);
  return (
    <div className="gm-rules-body">
      <ul className="sl-paytable">
        {[...symbols].reverse().map((s) => {
          const chance = (s.weight / total) * 0.04;
          return (
            <li key={s.id}>
              <span className="sl-pay-reels">
                <Sym s={s} size={24} />
                <Sym s={s} size={24} />
                <Sym s={s} size={24} />
              </span>
              <b>{s.payout === "jackpot" ? "Jackpot" : `${s.payout}× bet`}</b>
              <small>1 in {Math.round(1 / chance).toLocaleString()}</small>
            </li>
          );
        })}
      </ul>
      <p>
        Any <b>two matching</b> symbols give your bet back (30% of spins). Three different symbols lose (66%). Every losing spin goes into the progressive jackpot, and three gold mice
        win all of it. Minimum bet 50 leaves a spin. Nitro boosters can spin up to 25 times at once. Same machine and jackpot as /slots in Discord.
      </p>
    </div>
  );
}

/** A slot machine as a spectator sees it: each new batch of spins plays back as it happened. */
export function SlotsSpectator({ slots, jackpot }: { slots: PublicSlots | null; jackpot: number }) {
  const [shown, setShown] = useState(0);
  const [first] = useState(slots?.batch ?? null);
  const batch = useMemo<Batch | null>(() => (slots ? { key: String(slots.batch), bet: slots.bet, results: slots.results, payout: slots.payout } : null), [slots]);
  const [done, setDone] = useState(false);
  useEffect(() => {
    setShown(0);
    setDone(false);
  }, [batch?.key]);
  const onSpinShown = useCallback((i: number) => setShown((n) => Math.max(n, i + 1)), []);
  const onDone = useCallback(() => setDone(true), []);
  if (!batch) return <div className="lv-loading">Waiting for the first spin…</div>;
  // The batch already on screen when you arrived is shown as it landed, not replayed
  const skipSignal = first !== null && slots?.batch === first ? 1 : 0;
  return (
    <div className="sl is-watch">
      <div className="sl-stage">
        <Machine batch={batch} jackpot={jackpot} onSpinShown={onSpinShown} onDone={onDone} skipSignal={skipSignal} />
      </div>
      {batch.results.length > 1 ? (
        <div className="sl-results">
          {done ? <Summary batch={batch} /> : null}
          <Feed batch={batch} shown={shown} />
        </div>
      ) : null}
    </div>
  );
}
