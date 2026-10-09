"use client";

import { ChevronDown, Eye, Hand, Plus, RotateCcw, Scissors, Split, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type MutableRefObject } from "react";
import type { Card, HandResult, PublicCard, PublicTable } from "../../lib/games/blackjack";
import { LeafEmote } from "../ui-icons";
import { CardFace } from "./cards";
import { Confetti, CountUp } from "./games-client";
import { useCurrency } from "../season-context";

const SUIT: Record<Card["suit"], { glyph: string; red: boolean; name: string }> = {
  S: { glyph: "♠", red: false, name: "spades" },
  H: { glyph: "♥", red: true, name: "hearts" },
  D: { glyph: "♦", red: true, name: "diamonds" },
  C: { glyph: "♣", red: false, name: "clubs" },
};
const CHIPS = [25, 100, 500, 1000, 5000, 10000];
const CHIP_CLASS: Record<number, string> = { 25: "c25", 100: "c100", 500: "c500", 1000: "c1k", 5000: "c5k", 10000: "c10k" };
const DEAL_GAP = 260; // ms between dealt cards
const RESULT_TEXT: Record<HandResult, string> = { blackjack: "Blackjack!", win: "Win", dealer_bust: "Dealer bust", push: "Push", bust: "Bust", loss: "Loss", timeout: "Timed out" };

const isHidden = (c: PublicCard): c is { hidden: true } => "hidden" in c;
const cardKey = (c: Card) => `${c.rank}${c.suit}`;
const short = (n: number) => (n >= 1000 ? `${n % 1000 === 0 ? n / 1000 : (n / 1000).toFixed(1)}K` : String(n));

/** A playing card with a 3D flip between its back and face. */
function PlayingCard({ card, faceDown, delay, deal }: { card: Card | null; faceDown: boolean; delay: number; deal: boolean }) {
  const s = card ? SUIT[card.suit] : null;
  return (
    <div className={`bj-card${deal ? " is-dealt" : ""}${faceDown ? " is-down" : ""}`} style={{ "--delay": `${delay}ms` } as CSSProperties} aria-label={card && !faceDown ? `${card.rank} of ${s?.name}` : "Face-down card"}>
      <div className="bj-card-inner">
        <div className="bj-face">{card ? <CardFace card={card} /> : null}</div>
        <div className="bj-back" />
      </div>
    </div>
  );
}

/** The bet on the table: one chip in the colour of the biggest denomination it covers, with the exact amount under it. */
function BetChip({ amount }: { amount: number }) {
  if (amount <= 0) return null;
  const top = [...CHIPS].reverse().find((c) => amount >= c) ?? CHIPS[0];
  return (
    <span className="bj-betchip" key={amount}>
      <span className={`bj-chip ${CHIP_CLASS[top]}`}>{short(amount)}</span>
      <span className="bj-betchip-amount">
        {amount.toLocaleString()} <LeafEmote size={12} />
      </span>
    </span>
  );
}

async function post(body: Record<string, unknown>) {
  const res = await fetch("/api/games/blackjack", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return (await res.json().catch(() => ({ ok: false, error: "Something went wrong." }))) as { ok: boolean; error?: string; table?: PublicTable | null; balance?: number };
}

/** The table. With `watch`, it's a spectator's view: no controls, kept up to date by polling `watch.url`. */
export function BlackjackTable({
  initialTable,
  balance = 0,
  onBalance = () => undefined,
  minBet,
  watch,
  viewers = 0,
  onActive,
  control,
}: {
  initialTable: PublicTable | null;
  balance?: number;
  onBalance?: (n: number) => void;
  minBet: number;
  watch?: { url: string; onData?: (d: { viewers: number }) => void };
  viewers?: number;
  /** Told whether a hand is in progress */
  onActive?: (active: boolean) => void;
  /** Lets the page stand on every hand when the player leaves mid-hand */
  control?: MutableRefObject<{ quit: () => Promise<void> } | null>;
}) {
  const cur = useCurrency();
  const [table, setTable] = useState<PublicTable | null>(initialTable);
  const [bet, setBet] = useState(Math.max(minBet, 100));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(initialTable?.phase === "done");
  const [burst, setBurst] = useState(0);
  const [rules, setRules] = useState(false);
  const [lastBet, setLastBet] = useState<number | null>(null);
  // The big banner is only for a hand just played (not one that ended before the page loaded)
  const [fresh, setFresh] = useState(false);
  // Which cards have been on the table already (new ones get dealt in with an animation)
  const seen = useRef<Set<string>>(new Set());
  const delays = useRef<Map<string, number>>(new Map());
  const pendingBalance = useRef<number | null>(null);
  // A new hand id means a fresh deal: its four cards come out of the shoe in dealing order
  const lastHand = useRef<number | null>(initialTable?.handId ?? null);

  // Work out deal-in delays for cards that weren't there before
  const order = useMemo(() => {
    if (!table) return { resultDelay: 0 };
    const fresh: string[] = [];
    const isNewDeal = table.handId !== lastHand.current;
    if (isNewDeal) {
      lastHand.current = table.handId;
      seen.current = new Set();
      delays.current = new Map();
      const p = table.hands[0].cards;
      [cardKey(p[0]), "d0", cardKey(p[1]), "d1"].forEach((k, i) => delays.current.set(k, i * DEAL_GAP));
      fresh.push(cardKey(p[0]), "d0", cardKey(p[1]), "d1");
    } else {
      let i = 0;
      for (const h of table.hands) for (const c of h.cards) if (!seen.current.has(cardKey(c))) {
        fresh.push(cardKey(c));
        delays.current.set(cardKey(c), i++ * DEAL_GAP);
      }
      // Dealer: the hole card flips first, then each extra card is drawn one by one
      table.dealer.cards.forEach((c, idx) => {
        const k = `d${idx}`;
        if (idx >= 2 && !seen.current.has(k)) {
          fresh.push(k);
          delays.current.set(k, 520 + (idx - 2) * 560);
        }
      });
    }
    const extraDealer = Math.max(0, table.dealer.cards.length - 2);
    const resultDelay = table.phase === "done" ? (isNewDeal ? 4 * DEAL_GAP + 700 : 700 + extraDealer * 560 + 200) : 0;
    return { resultDelay, fresh };
  }, [table]);

  // Remember what's on the table after it's been drawn
  useEffect(() => {
    if (!table) return;
    const t = setTimeout(() => {
      table.hands.forEach((h) => h.cards.forEach((c) => seen.current.add(cardKey(c))));
      table.dealer.cards.forEach((_, i) => seen.current.add(`d${i}`));
    }, 50);
    return () => clearTimeout(t);
  }, [table]);

  // Reveal the outcome once the dealer has finished drawing
  useEffect(() => {
    if (!table || table.phase !== "done") {
      setShowResult(false);
      return;
    }
    const t = setTimeout(() => {
      setShowResult(true);
      if (pendingBalance.current !== null) {
        onBalance(pendingBalance.current);
        pendingBalance.current = null;
      }
      if ((table.net ?? 0) > 0) setBurst(Date.now());
    }, order.resultDelay);
    return () => clearTimeout(t);
  }, [table, order.resultDelay, onBalance]);

  const act = useCallback(
    async (body: Record<string, unknown>) => {
      if (busy) return;
      setBusy(true);
      setError(null);
      const res = await post(body);
      setBusy(false);
      if (!res.ok) {
        setError(res.error ?? "That didn't work.");
        // Resync with the server (e.g. after playing in another tab)
        const fresh = await fetch("/api/games/blackjack", { cache: "no-store" }).then((r) => r.json()).catch(() => null);
        if (fresh?.ok) {
          setTable(fresh.table);
          onBalance(fresh.balance);
        }
        return;
      }
      if (res.table?.phase === "done") {
        // Hold the balance change back until the cards have played out
        pendingBalance.current = res.balance ?? null;
        if (body.action === "deal") onBalance((res.balance ?? 0) - (res.table.payout ?? 0));
      } else if (typeof res.balance === "number") {
        onBalance(res.balance);
      }
      setFresh(true);
      setTable(res.table ?? null);
    },
    [busy, onBalance],
  );

  const deal = useCallback(
    (amount: number) => {
      if (amount < minBet) return setError(cur.text(`The minimum bet is ${minBet} leaves.`));
      if (amount > balance) return setError(cur.text("You don't have enough leaves for that bet."));
      setLastBet(amount);
      setShowResult(false);
      void act({ action: "deal", bet: amount });
    },
    [act, balance, minBet],
  );

  // Spectating: follow the table; a hand finishing while you watch gets the full reveal
  const watchUrl = watch?.url;
  const onWatchData = watch?.onData;
  useEffect(() => {
    if (!watchUrl) return;
    let stop = false;
    let last = "";
    const tick = async () => {
      const res = await fetch(watchUrl, { cache: "no-store" }).then((r) => r.json()).catch(() => null);
      if (stop || !res?.ok) return;
      onWatchData?.({ viewers: res.table?.viewers ?? 0 });
      const next = res.table?.blackjack as PublicTable | null;
      const key = JSON.stringify(next);
      if (key !== last) {
        if (last && next?.phase === "done") setFresh(true);
        last = key;
        setTable(next);
      }
    };
    void tick();
    const t = setInterval(tick, 1200);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [watchUrl, onWatchData]);

  const playing = table?.phase === "player";

  useEffect(() => {
    if (!watch) onActive?.(playing);
  }, [playing, watch, onActive]);

  // Leaving mid-hand: stand on whatever's left and let the dealer finish
  useEffect(() => {
    if (!control || watch) return;
    control.current = {
      quit: async () => {
        let res: Awaited<ReturnType<typeof post>> | null = null;
        for (let i = 0; i < 3; i++) {
          res = await post({ action: "stand" });
          if (!res.ok || res.table?.phase !== "player") break;
        }
        if (res?.ok) {
          setFresh(false);
          setTable(res.table ?? null);
          if (typeof res.balance === "number") onBalance(res.balance);
        }
      },
    };
    return () => {
      control.current = null;
    };
  }, [control, watch, onBalance]);

  // Keyboard: H hit, S stand, D double, P split, Enter deal
  useEffect(() => {
    if (watch) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT" || e.metaKey || e.ctrlKey) return;
      const k = e.key.toLowerCase();
      if (playing) {
        if (k === "h") void act({ action: "hit" });
        else if (k === "s") void act({ action: "stand" });
        else if (k === "d" && table?.canDouble) void act({ action: "double" });
        else if (k === "p" && table?.canSplit) void act({ action: "split" });
      } else if (k === "enter") deal(bet);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [playing, table, act, deal, bet, watch]);

  const dealt = new Set((order as { fresh?: string[] }).fresh ?? []);
  const dealerCards = table?.dealer.cards ?? [];
  const done = table?.phase === "done";
  const net = table?.net ?? 0;
  const outcome = !done ? null : table!.hands.some((h) => h.result === "blackjack") ? "blackjack" : net > 0 ? "win" : net === 0 ? "push" : "loss";
  const currentBet = table?.hands[table.index]?.bet ?? bet;

  return (
    <div className="bj">
      <div className={`bj-table${done && showResult ? ` is-${outcome}` : ""}`}>
        <div className="bj-rim" aria-hidden="true" />
        {viewers > 0 ? (
          <span className="gm-watching" title={`${viewers} watching`}>
            <Eye size={13} aria-hidden="true" /> {viewers} watching
          </span>
        ) : null}

        {/* Dealer */}
        <div className="bj-row bj-dealer">
          <div className="bj-label">
            Dealer
            {table ? <span className={`bj-total${done && showResult && (table.dealer.value ?? 0) > 21 ? " is-bust" : ""}`}>{done && showResult ? table.dealer.value : done ? "…" : `${table.dealer.shown} + ?`}</span> : null}
          </div>
          <div className="bj-cards">
            {table
              ? dealerCards.map((c, i) => {
                  const k = `d${i}`;
                  const real = isHidden(c) ? null : c;
                  return <PlayingCard key={k} card={real} faceDown={isHidden(c)} delay={delays.current.get(k) ?? 0} deal={dealt.has(k)} />;
                })
              : [0, 1].map((i) => <div key={i} className="bj-slot" />)}
          </div>
        </div>

        <div className="bj-arc" aria-hidden="true">
          <span>Blackjack pays 3 to 2</span>
          <small>Dealer must hit to 17</small>
        </div>

        {/* Player hands */}
        <div className={`bj-row bj-player${table && table.hands.length > 1 ? " is-split" : ""}`}>
          {table ? (
            table.hands.map((h, hi) => (
              <div key={hi} className={`bj-hand${playing && table.hands.length > 1 && hi === table.index ? " is-active" : ""}${done && showResult && h.result ? ` is-${h.result}` : ""}`}>
                <div className="bj-cards">
                  {h.cards.map((c) => (
                    <PlayingCard key={cardKey(c)} card={c} faceDown={false} delay={delays.current.get(cardKey(c)) ?? 0} deal={dealt.has(cardKey(c))} />
                  ))}
                </div>
                <div className="bj-label">
                  {table.hands.length > 1 ? `Hand ${hi + 1}` : "You"}
                  <span className={`bj-total${h.value > 21 ? " is-bust" : h.value === 21 ? " is-21" : ""}`}>{h.value}</span>
                  <span className="bj-bet-pill" title="Bet on this hand">
                    {h.bet.toLocaleString()} <LeafEmote size={12} />
                  </span>
                </div>
                {done && showResult && h.result ? <span className={`bj-ribbon is-${h.result}`}>{RESULT_TEXT[h.result]}</span> : null}
              </div>
            ))
          ) : (
            <div className="bj-hand">
              <div className="bj-cards">
                {[0, 1].map((i) => (
                  <div key={i} className="bj-slot" />
                ))}
              </div>
              <div className="bj-label">You</div>
            </div>
          )}
        </div>

        {/* Bet spot */}
        <div className="bj-spot" aria-hidden="true">
          <BetChip amount={watch ? (table?.totalBet ?? 0) : playing ? table!.totalBet : bet} />
        </div>

        {/* Outcome banner */}
        {done && showResult && fresh ? (
          <div className={`bj-banner is-${outcome}`} role="status">
            <strong>{outcome === "blackjack" ? "Blackjack!" : outcome === "win" ? "You win!" : outcome === "push" ? "Push" : "Dealer wins"}</strong>
            <span>
              {net > 0 ? "+" : ""}
              {net.toLocaleString()} <LeafEmote size={18} />
            </span>
          </div>
        ) : null}
        <Confetti burst={burst} big={outcome === "blackjack"} />
      </div>

      {error ? (
        <p className="gm-error" role="alert">
          {error}
          <button type="button" onClick={() => setError(null)} aria-label="Dismiss">
            <X size={14} />
          </button>
        </p>
      ) : null}

      {/* Controls */}
      {watch ? null : playing ? (
        <div className="bj-actions">
          <button type="button" className="bj-btn is-hit" disabled={busy} onClick={() => act({ action: "hit" })}>
            <Plus size={18} aria-hidden="true" /> Hit <kbd>H</kbd>
          </button>
          <button type="button" className="bj-btn is-stand" disabled={busy} onClick={() => act({ action: "stand" })}>
            <Hand size={18} aria-hidden="true" /> Stand <kbd>S</kbd>
          </button>
          <button type="button" className="bj-btn is-double" disabled={busy || !table?.canDouble || balance < currentBet} onClick={() => act({ action: "double" })} title={`Double your bet (${currentBet.toLocaleString()} more) for exactly one more card`}>
            ×2 Double <kbd>D</kbd>
          </button>
          <button type="button" className="bj-btn is-split" disabled={busy || !table?.canSplit || balance < (table?.hands[0]?.bet ?? 0)} onClick={() => act({ action: "split" })} title="Split into two hands">
            <Split size={18} aria-hidden="true" /> Split <kbd>P</kbd>
          </button>
        </div>
      ) : (
        <div className="bj-betting">
          <div className="bj-rack" role="group" aria-label="Add chips">
            {CHIPS.map((c) => (
              <button key={c} type="button" className={`bj-chip is-btn ${CHIP_CLASS[c]}`} disabled={busy || bet + c > balance} onClick={() => setBet((b) => (done || b < minBet ? 0 : b) + c)} aria-label={`Add ${c}`}>
                {short(c)}
              </button>
            ))}
          </div>
          <div className="bj-bet-row">
            <label className="bj-bet-input">
              <span>Bet</span>
              <LeafEmote size={16} />
              <input type="number" min={minBet} step={25} value={bet} onChange={(e) => setBet(Math.max(0, Math.floor(Number(e.target.value) || 0)))} />
            </label>
            <button type="button" className="bj-mini" onClick={() => setBet((b) => Math.max(minBet, Math.floor(b / 2)))}>½</button>
            <button type="button" className="bj-mini" onClick={() => setBet((b) => Math.min(balance, b * 2))}>×2</button>
            <button type="button" className="bj-mini" onClick={() => setBet(minBet)} title="Reset to the minimum">
              <RotateCcw size={14} aria-hidden="true" />
            </button>
            <button type="button" className="bj-deal" disabled={busy || bet < minBet || bet > balance} onClick={() => deal(bet)}>
              {done ? "Deal again" : "Deal"} <kbd>Enter</kbd>
            </button>
            {done && lastBet && lastBet !== bet ? (
              <button type="button" className="bj-mini is-wide" disabled={busy || lastBet > balance} onClick={() => deal(lastBet)}>
                Rebet {lastBet.toLocaleString()}
              </button>
            ) : null}
          </div>
          <p className="bj-hint">
            Minimum bet {minBet} <LeafEmote size={14} /> · Wins pay 1:1, blackjack pays 3:2, a push returns your bet.
          </p>
        </div>
      )}

      {done && showResult ? (
        <div className="bj-summary">
          {table!.hands.map((h, i) => (
            <span key={i} className={`is-${h.result}`}>
              {table!.hands.length > 1 ? `Hand ${i + 1}: ` : ""}
              {h.result ? RESULT_TEXT[h.result] : ""} · {h.value} vs {table!.dealer.value}
            </span>
          ))}
          <b>
            Paid out <CountUp value={table!.payout ?? 0} /> <LeafEmote size={14} /> on {table!.totalBet.toLocaleString()} wagered
          </b>
        </div>
      ) : null}

      {watch ? null : (
      <div className={`gm-rules${rules ? " is-open" : ""}`}>
        <button type="button" onClick={() => setRules((r) => !r)} aria-expanded={rules}>
          How it works <ChevronDown size={16} aria-hidden="true" />
        </button>
        {rules ? (
          <div className="gm-rules-body">
            <p>
              Get closer to 21 than the dealer without going over. Number cards are worth their number, J/Q/K are 10, and an Ace is 11 or 1. The dealer must hit until they
              reach 17, then stand.
            </p>
            <ul>
              <li>
                <b>Blackjack</b> (21 on your first two cards) pays 3:2. <b>Wins</b> pay 1:1. A <b>push</b> returns your bet.
              </li>
              <li>
                <b>Double down</b> on your first two cards: double the bet and get exactly one more card.
              </li>
              <li>
                <b>Split</b> two cards of the same value into two hands by matching your bet.
              </li>
              <li>Losing bets go into the server&apos;s slots jackpot. Games here count toward your gambling stats in Discord too.</li>
            </ul>
            <p className="gm-fine">
              <Scissors size={12} aria-hidden="true" /> Leave a hand halfway and it waits for you. A hand left untouched for a day is forfeited.
            </p>
          </div>
        ) : null}
      </div>
      )}
    </div>
  );
}
