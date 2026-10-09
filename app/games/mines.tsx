"use client";

import { Bomb, ChevronDown, Dices, Eye, Gem, HandCoins, Play, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type CSSProperties, type MutableRefObject } from "react";
import type { PublicMines } from "../../lib/games/mines";
import { LeafEmote } from "../ui-icons";
import { Confetti, CountUp } from "./games-client";
import { useCurrency } from "../season-context";

const TILES = 25;
const EDGE = 0.01;
const CAP = 1000;
const MINE_PRESETS = [1, 3, 5, 10, 15, 20, 24];
const BET_CHIPS = [25, 100, 500, 1000, 5000];
const short = (n: number) => (n >= 1_000_000 ? `${+(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${+(n / 1000).toFixed(1)}K` : String(n));

/** Same formula as the server (fair odds minus 1%, capped). */
function multiplier(picks: number, mines: number) {
  if (picks <= 0) return 1;
  let fair = 1;
  for (let i = 0; i < picks; i++) fair *= (TILES - i) / (TILES - mines - i);
  return Math.min(CAP, Math.floor((1 - EDGE) * fair * 100) / 100);
}

/** The 5×5 board. `onPick` is left out for spectators. */
function Board({ game, onPick, busy, pending }: { game: PublicMines | null; onPick?: (i: number) => void; busy?: boolean; pending?: number | null }) {
  const over = game && game.status !== "playing";
  const mines = new Set(game?.board ?? []);
  const gems = new Set(game?.revealed ?? []);
  return (
    <div className={`mn-board${over ? ` is-${game!.status}` : ""}`} role="grid" aria-label="Mines board">
      {Array.from({ length: TILES }, (_, i) => {
        const isGem = gems.has(i);
        const isMine = over && mines.has(i);
        const isHit = game?.hit === i;
        const state = isHit ? "hit" : isGem ? "gem" : isMine ? "mine" : over ? "safe" : "hidden";
        return (
          <button
            key={i}
            type="button"
            className={`mn-tile is-${state}${pending === i ? " is-pending" : ""}`}
            style={{ "--i": i } as CSSProperties}
            disabled={!onPick || busy || !game || game.status !== "playing" || isGem}
            onClick={() => onPick?.(i)}
            aria-label={state === "hidden" ? `Tile ${i + 1}` : state === "gem" ? "Gem" : state === "hit" ? "Mine you hit" : state === "mine" ? "Mine" : "Gem you didn't pick"}
          >
            <span className="mn-tile-face">
              {state === "gem" || state === "safe" ? <Gem size={26} aria-hidden="true" /> : state === "mine" || state === "hit" ? <Bomb size={26} aria-hidden="true" /> : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function Readout({ game }: { game: PublicMines }) {
  return (
    <div className="mn-readout">
      <div>
        <small>Gems</small>
        <b>{game.revealed.length}</b>
      </div>
      <div>
        <small>Multiplier</small>
        <b>{game.multiplier.toFixed(2)}x</b>
      </div>
      <div>
        <small>{game.status === "playing" ? "Worth now" : "Paid"}</small>
        <b>
          {(game.status === "playing" ? game.value : game.payout ?? 0).toLocaleString()} <LeafEmote size={14} />
        </b>
      </div>
      {game.next ? (
        <div>
          <small>Next gem</small>
          <b>{game.next.toFixed(2)}x</b>
        </div>
      ) : null}
    </div>
  );
}

async function post(body: Record<string, unknown>) {
  const res = await fetch("/api/games/mines", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return (await res.json().catch(() => ({ ok: false, error: "Something went wrong." }))) as { ok: boolean; error?: string; game?: PublicMines | null; balance?: number };
}

export function Mines({
  initial,
  balance,
  onBalance,
  viewers = 0,
  onActive,
  control,
}: {
  initial: PublicMines | null;
  balance: number;
  onBalance: (n: number) => void;
  viewers?: number;
  onActive?: (active: boolean) => void;
  control?: MutableRefObject<{ quit: () => Promise<void> } | null>;
}) {
  const cur = useCurrency();
  const [game, setGame] = useState<PublicMines | null>(initial);
  const [bet, setBet] = useState(100);
  const [count, setCount] = useState(3);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [burst, setBurst] = useState(0);
  const [rules, setRules] = useState(false);

  const playing = game?.status === "playing";
  useEffect(() => onActive?.(playing), [playing, onActive]);

  const act = useCallback(
    async (body: Record<string, unknown>) => {
      setBusy(true);
      setError(null);
      const res = await post(body);
      setBusy(false);
      setPending(null);
      if (!res.ok) return setError(res.error ?? "That didn't work.");
      if (res.game) {
        setGame(res.game);
        if (res.game.status === "cashed" && (res.game.payout ?? 0) > res.game.bet) setBurst(Date.now());
      }
      if (typeof res.balance === "number") onBalance(res.balance);
    },
    [onBalance],
  );

  // Leaving for the Live tab mid-board: cash out if there's something to cash out (otherwise it waits for you)
  useEffect(() => {
    if (!control) return;
    control.current = {
      quit: async () => {
        if (game?.status === "playing" && game.revealed.length) await act({ action: "cashout" });
      },
    };
    return () => {
      control.current = null;
    };
  }, [control, game, act]);

  const start = () => {
    if (bet < 25) return setError(cur.text("The minimum bet is 25 leaves."));
    if (bet > balance) return setError(cur.text("You don't have enough leaves for that bet."));
    void act({ action: "start", bet, mines: count });
  };
  const pick = (i: number) => {
    if (busy) return;
    setPending(i);
    void act({ action: "reveal", tile: i });
  };
  const randomPick = () => {
    if (!game || !playing) return;
    const open = Array.from({ length: TILES }, (_, i) => i).filter((i) => !game.revealed.includes(i));
    pick(open[Math.floor(Math.random() * open.length)]);
  };

  const preview = useMemo(() => [1, 2, 3, 5, 10].filter((n) => n <= TILES - count).map((n) => ({ n, x: multiplier(n, count) })), [count]);

  return (
    <div className="mn">
      <div className="mn-stage">
        {viewers > 0 ? (
          <span className="gm-watching" title={`${viewers} watching`}>
            <Eye size={13} aria-hidden="true" /> {viewers} watching
          </span>
        ) : null}
        <Board game={game} onPick={pick} busy={busy} pending={pending} />
        {game && game.status !== "playing" ? (
          <div className={`mn-result is-${game.status}`} role="status">
            {game.status === "bust" ? (
              <>
                <strong>💥 Boom!</strong>
                <span>
                  You lost {game.bet.toLocaleString()} <LeafEmote size={16} />
                </span>
              </>
            ) : (
              <>
                <strong>Cashed out {game.multiplier.toFixed(2)}x</strong>
                <span>
                  +<CountUp value={(game.payout ?? 0) - game.bet} /> <LeafEmote size={16} />
                </span>
              </>
            )}
          </div>
        ) : null}
        <Confetti burst={burst} big={(game?.multiplier ?? 0) >= 10} />
      </div>

      {error ? (
        <p className="gm-error" role="alert">
          {error}
          <button type="button" onClick={() => setError(null)} aria-label="Dismiss">
            <X size={14} />
          </button>
        </p>
      ) : null}

      <div className="mn-panel">
        {playing && game ? (
          <>
            <Readout game={game} />
            <div className="mn-actions">
              <button type="button" className="mn-btn" onClick={randomPick} disabled={busy}>
                <Dices size={17} aria-hidden="true" /> Random tile
              </button>
              <button type="button" className="mn-cashout" onClick={() => act({ action: "cashout" })} disabled={busy || !game.revealed.length}>
                <HandCoins size={18} aria-hidden="true" />
                {game.revealed.length ? (
                  <>
                    Cash out {game.value.toLocaleString()} <LeafEmote size={15} />
                  </>
                ) : (
                  "Find a gem to cash out"
                )}
              </button>
            </div>
          </>
        ) : (
          <>
            {game ? <Readout game={game} /> : null}
            <div className="mn-setup">
              <div className="sl-field">
                <span className="sl-field-label">Bet</span>
                <div className="sl-stepper">
                  <button type="button" onClick={() => setBet((b) => Math.max(25, Math.floor(b / 2)))} aria-label="Halve the bet">
                    ½
                  </button>
                  <label>
                    <LeafEmote size={16} />
                    <input type="number" min={25} step={25} value={bet} onChange={(e) => setBet(Math.max(0, Math.floor(Number(e.target.value) || 0)))} aria-label="Bet" />
                  </label>
                  <button type="button" onClick={() => setBet((b) => Math.min(Math.max(25, balance), b * 2))} aria-label="Double the bet">
                    ×2
                  </button>
                </div>
                <div className="mn-chips">
                  {BET_CHIPS.map((c) => (
                    <button key={c} type="button" className={bet === c ? "is-on" : ""} onClick={() => setBet(c)} disabled={c > balance}>
                      {short(c)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="sl-field">
                <span className="sl-field-label">
                  Mines <b className="mn-count">{count}</b>
                </span>
                <input className="mn-range" type="range" min={1} max={24} value={count} onChange={(e) => setCount(Number(e.target.value))} aria-label="Number of mines" />
                <div className="mn-chips">
                  {MINE_PRESETS.map((m) => (
                    <button key={m} type="button" className={count === m ? "is-on" : ""} onClick={() => setCount(m)}>
                      {m}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="mn-preview" aria-label="Multipliers">
              {preview.map((p) => (
                <span key={p.n}>
                  {p.n} gem{p.n === 1 ? "" : "s"} <b>{p.x.toFixed(2)}x</b>
                </span>
              ))}
            </div>
            <button type="button" className="mn-start" onClick={start} disabled={busy || bet < 25 || bet > balance}>
              <Play size={18} aria-hidden="true" /> {game ? "New board" : "Start"} · {bet.toLocaleString()} <LeafEmote size={15} />
            </button>
          </>
        )}
      </div>

      <div className={`gm-rules${rules ? " is-open" : ""}`}>
        <button type="button" onClick={() => setRules((r) => !r)} aria-expanded={rules}>
          How it works <ChevronDown size={16} aria-hidden="true" />
        </button>
        {rules ? (
          <div className="gm-rules-body">
            <p>
              Pick how many mines hide on the 5×5 board and place your bet. Every gem you find raises the multiplier. Cash out whenever you like after your first gem, or hit a mine and lose
              the bet.
            </p>
            <ul>
              <li>More mines means bigger multipliers and more risk.</li>
              <li>Multipliers are the fair odds minus a 1% house edge (a 99% return), up to 1,000x.</li>
              <li>Leave mid-board and it waits for you. Losing bets go into the slots jackpot, and every game counts toward your stats.</li>
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** A board as a spectator sees it: gems found so far, and the mines once it's over. */
export function MinesSpectator({ mines }: { mines: PublicMines | null }) {
  if (!mines) return <div className="lv-loading">Waiting for a board…</div>;
  return (
    <div className="mn is-watch">
      <div className="mn-stage">
        <Board game={mines} />
        {mines.status !== "playing" ? (
          <div className={`mn-result is-${mines.status}`} role="status">
            <strong>{mines.status === "bust" ? "💥 Boom!" : `Cashed out ${mines.multiplier.toFixed(2)}x`}</strong>
            <span>
              {mines.status === "bust" ? `Lost ${mines.bet.toLocaleString()}` : `+${((mines.payout ?? 0) - mines.bet).toLocaleString()}`} <LeafEmote size={16} />
            </span>
          </div>
        ) : null}
      </div>
      <div className="mn-panel">
        <Readout game={mines} />
        <p className="mn-watch-note">
          {mines.mines} mines · {mines.bet.toLocaleString()} <LeafEmote size={13} /> bet
        </p>
      </div>
    </div>
  );
}
