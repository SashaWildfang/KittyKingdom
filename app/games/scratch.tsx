"use client";

import { ArrowLeft, ChevronDown, Eye, Gem, Lock, RefreshCw, Wand2 } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type MutableRefObject } from "react";
import type { PublicScratch } from "../../lib/games/live";
import type { Ticket } from "../../lib/games/scratch";
import { LeafEmote } from "../ui-icons";
import { Confetti, CountUp, type ScratchStatus } from "./games-client";
import { useCurrency } from "../season-context";
import "./scratch.css";

const TIERS: { key: Ticket["tier"]; label: string; blurb: string }[] = [
  { key: "low", label: "Everyday", blurb: "10 – 75 leaves" },
  { key: "mid", label: "Big Ticket", blurb: "100 – 750 leaves" },
  { key: "high", label: "High Roller", blurb: "1K – 15K leaves" },
  { key: "vip", label: "VIP Whale", blurb: "25K – 100K leaves" },
];
const REVEAL_AT = 0.5; // share of a cell's foil scratched before it pops open
const BRUSH = 26;

type Play = { ticket: Ticket; grid: string[]; winSymbol: string | null; payout: number; balance: number; serial: string };

const topPrize = (t: Ticket) => Math.max(...t.prizes.map((p) => p.payout));
const compact = (n: number) => (n >= 1_000_000 ? `${+(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${+(n / 1000).toFixed(1)}K` : String(n));

// One context for the foil, set up for the frequent pixel reads that check how much is scratched
const ctx2d = (c: HTMLCanvasElement) => c.getContext("2d", { willReadFrequently: true })!;

/** The foil over the 3×3 grid: a canvas you scratch away. */
function Foil({ play, revealed, onReveal, auto }: { play: Play; revealed: boolean[]; onReveal: (i: number) => void; auto: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const [shavings, setShavings] = useState<{ id: number; x: number; y: number; dx: number }[]>([]);
  const last = useRef<{ x: number; y: number } | null>(null);
  const drawing = useRef(false);
  const revealedRef = useRef(revealed);
  revealedRef.current = revealed;
  const shaveId = useRef(0);
  const lastShave = useRef(0);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);

  // Track the grid's layout size (not its on-screen box, which is scaled while the ticket animates in)
  useLayoutEffect(() => {
    const w = wrap.current;
    if (!w) return;
    const measure = () => setSize((s) => (s && s.w === w.offsetWidth && s.h === w.offsetHeight ? s : { w: w.offsetWidth, h: w.offsetHeight }));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(w);
    return () => ro.disconnect();
  }, []);

  // Paint the foil (and open any cells already revealed, if it's repainted after a resize)
  useLayoutEffect(() => {
    const c = canvas.current;
    if (!c || !size) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const { w: width, h: height } = size;
    c.width = Math.round(width * dpr);
    c.height = Math.round(height * dpr);
    const ctx = ctx2d(c);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const [c1] = play.ticket.colors;
    const g = ctx.createLinearGradient(0, 0, width, height);
    g.addColorStop(0, "#e9edf2");
    g.addColorStop(0.35, "#a7b0bd");
    g.addColorStop(0.5, "#f4f6f9");
    g.addColorStop(0.7, "#8e98a6");
    g.addColorStop(1, "#d6dbe3");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, width, height);
    // Tint with the ticket's colour
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = c1;
    ctx.fillRect(0, 0, width, height);
    ctx.globalAlpha = 1;
    // Fine grain
    for (let i = 0; i < (width * height) / 22; i++) {
      ctx.fillStyle = Math.random() > 0.5 ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.12)";
      ctx.fillRect(Math.random() * width, Math.random() * height, 1, 1);
    }
    // Each cell: an embossed tile with the ticket's icon
    const cw = width / 3;
    const ch = height / 3;
    for (let i = 0; i < 9; i++) {
      const x = (i % 3) * cw;
      const y = Math.floor(i / 3) * ch;
      ctx.strokeStyle = "rgba(0,0,0,0.18)";
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 5.5, y + 5.5, cw - 11, ch - 11);
      ctx.strokeStyle = "rgba(255,255,255,0.55)";
      ctx.strokeRect(x + 6.5, y + 6.5, cw - 13, ch - 13);
      ctx.globalAlpha = 0.28;
      ctx.font = `${Math.round(Math.min(cw, ch) * 0.34)}px system-ui, "Apple Color Emoji", "Segoe UI Emoji"`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#000";
      ctx.fillText(play.ticket.icon, x + cw / 2, y + ch / 2 - 6);
      ctx.globalAlpha = 0.55;
      ctx.font = `800 ${Math.round(Math.min(cw, ch) * 0.1)}px system-ui`;
      ctx.fillStyle = "#3a3f48";
      ctx.fillText("SCRATCH", x + cw / 2, y + ch * 0.78);
      ctx.globalAlpha = 1;
    }
    // A diagonal sheen
    const sheen = ctx.createLinearGradient(0, 0, width, height);
    sheen.addColorStop(0.42, "rgba(255,255,255,0)");
    sheen.addColorStop(0.5, "rgba(255,255,255,0.45)");
    sheen.addColorStop(0.58, "rgba(255,255,255,0)");
    ctx.fillStyle = sheen;
    ctx.fillRect(0, 0, width, height);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    revealedRef.current.forEach((open, i) => {
      if (!open) return;
      const r = cellRect(i);
      ctx.clearRect(r.x, r.y, r.w, r.h);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [play, size]);

  const cellRect = (i: number) => {
    const c = canvas.current!;
    const cw = c.width / 3;
    const ch = c.height / 3;
    return { x: (i % 3) * cw, y: Math.floor(i / 3) * ch, w: cw, h: ch };
  };

  /** How much of each hidden cell is scratched; open the ones past the threshold. */
  const check = useCallback(() => {
    const c = canvas.current;
    if (!c) return;
    const ctx = ctx2d(c);
    for (let i = 0; i < 9; i++) {
      if (revealedRef.current[i]) continue;
      const r = cellRect(i);
      const data = ctx.getImageData(r.x, r.y, r.w, r.h).data;
      let clear = 0;
      let total = 0;
      for (let p = 3; p < data.length; p += 4 * 8) {
        total++;
        if (data[p] < 40) clear++;
      }
      if (total && clear / total >= REVEAL_AT) {
        ctx.clearRect(r.x, r.y, r.w, r.h);
        onReveal(i);
      }
    }
  }, [onReveal]);

  /** Scratch a line to (x, y), in the grid's layout pixels. */
  const scratchTo = (x: number, y: number) => {
    const c = canvas.current;
    if (!c || !c.offsetWidth) return;
    const ctx = ctx2d(c);
    const dpr = c.width / c.offsetWidth;
    ctx.globalCompositeOperation = "destination-out";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = BRUSH * dpr;
    ctx.beginPath();
    const from = last.current ?? { x, y };
    ctx.moveTo(from.x * dpr, from.y * dpr);
    ctx.lineTo(x * dpr, y * dpr);
    ctx.stroke();
    ctx.globalCompositeOperation = "source-over";
    last.current = { x, y };
    // A few foil shavings fly off (rationed, so scratching stays smooth)
    const now = performance.now();
    if (now - lastShave.current > 70 && Math.random() < 0.6) {
      lastShave.current = now;
      const id = ++shaveId.current;
      setShavings((s) => [...s.slice(-24), { id, x, y, dx: (Math.random() - 0.5) * 60 }]);
    }
  };

  /** The pointer in the grid's layout pixels (correct even while the ticket is scaled or tilted). */
  const point = (e: React.PointerEvent) => {
    const c = canvas.current!;
    const r = c.getBoundingClientRect();
    return { x: ((e.clientX - r.left) * c.offsetWidth) / (r.width || 1), y: ((e.clientY - r.top) * c.offsetHeight) / (r.height || 1) };
  };

  const lastCheck = useRef(0);
  const onMove = (e: React.PointerEvent) => {
    if (!drawing.current) return;
    const p = point(e);
    scratchTo(p.x, p.y);
    const now = performance.now();
    if (now - lastCheck.current > 120) {
      lastCheck.current = now;
      check();
    }
  };

  // Auto-scratch: sweep a brush over every hidden cell, one after another
  useEffect(() => {
    if (!auto) return;
    let cancelled = false;
    const c = canvas.current;
    if (!c) return;
    const cw = c.offsetWidth / 3;
    const ch = c.offsetHeight / 3;
    const hidden = Array.from({ length: 9 }, (_, i) => i).filter((i) => !revealedRef.current[i]);
    const run = async () => {
      for (const i of hidden) {
        if (cancelled) return;
        const x0 = (i % 3) * cw;
        const y0 = Math.floor(i / 3) * ch;
        last.current = null;
        const steps = 14;
        for (let s = 0; s <= steps; s++) {
          if (cancelled) return;
          const t = s / steps;
          const zig = (s % 2 ? 0.85 : 0.15) * cw;
          scratchTo(x0 + zig, y0 + 8 + t * (ch - 16));
          await new Promise((r) => setTimeout(r, 14));
        }
        last.current = null;
        const ctx = ctx2d(c);
        const r = cellRect(i);
        ctx.clearRect(r.x, r.y, r.w, r.h);
        onReveal(i);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto]);

  return (
    <div ref={wrap} className="sc-foil-wrap">
      <canvas
        ref={canvas}
        className="sc-foil"
        onPointerDown={(e) => {
          drawing.current = true;
          last.current = null;
          (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
          const p = point(e);
          scratchTo(p.x, p.y);
        }}
        onPointerMove={onMove}
        onPointerUp={() => {
          drawing.current = false;
          last.current = null;
          check();
        }}
        onPointerCancel={() => {
          drawing.current = false;
          last.current = null;
        }}
        aria-label="Scratch the foil to reveal the symbols"
      />
      {shavings.map((s) => (
        <i key={s.id} className="sc-shaving" style={{ left: s.x, top: s.y, "--dx": `${s.dx}px` } as CSSProperties} onAnimationEnd={() => setShavings((list) => list.filter((x) => x.id !== s.id))} />
      ))}
    </div>
  );
}

type HistoryItem = { id: number; icon: string; name: string; cost: number; payout: number };
const INSTANT_KEY = "kk-scratch-instant";

/** One ticket in the shop: a tall lottery ticket with its art, top prize, odds and price. */
function ShopTicket({ t, locked, short, busy, onBuy, i }: { t: Ticket; locked: boolean; short: boolean; busy: boolean; onBuy: () => void; i: number }) {
  const cur = useCurrency();
  const prizes = [...t.prizes].sort((a, b) => b.payout - a.payout);
  return (
    <button
      type="button"
      className={`sc3-card${locked ? " is-locked" : ""}${short ? " is-short" : ""}`}
      style={{ "--t1": t.colors[0], "--t2": t.colors[1], "--i": i } as CSSProperties}
      disabled={busy || locked || short}
      onClick={onBuy}
      title={locked ? "Nitro boosters and $10+ supporters" : short ? `Not enough ${cur.lower}` : `Buy ${t.name}`}
    >
      <span className="sc3-card-art" aria-hidden="true">
        <span className="sc3-card-glow" />
        <span className="sc3-card-icon">{t.icon}</span>
        {t.nitro ? <span className="sc3-card-badge">Premium</span> : null}
      </span>
      <span className="sc3-card-body">
        <strong>{t.name}</strong>
        <span className="sc3-card-top">
          <small>Win up to</small>
          <b>{compact(topPrize(t))}</b>
        </span>
        <span className="sc3-card-ladder" aria-hidden="true">
          {prizes.map((p) => (
            <i key={p.symbol} title={`${p.symbol} ${p.payout.toLocaleString()}`}>
              {p.symbol}
            </i>
          ))}
        </span>
        <span className="sc3-card-odds">Wins 1 in {(1 / t.winChance).toFixed(1)}</span>
      </span>
      <span className="sc3-card-stub">
        {busy ? (
          "Printing…"
        ) : locked ? (
          <>
            <Lock size={13} aria-hidden="true" /> Nitro only
          </>
        ) : (
          <>
            {t.cost.toLocaleString()} <LeafEmote size={14} />
          </>
        )}
      </span>
    </button>
  );
}

export function ScratchOffs({
  tickets,
  balance,
  onBalance,
  initialStatus,
  viewers = 0,
  onActive,
  control,
}: {
  tickets: Ticket[];
  balance: number;
  onBalance: (n: number) => void;
  initialStatus: ScratchStatus;
  viewers?: number;
  /** Told whether a ticket is being scratched */
  onActive?: (active: boolean) => void;
  /** Lets the page reveal the rest of the ticket when the player leaves */
  control?: MutableRefObject<{ quit: () => Promise<void> } | null>;
}) {
  const cur = useCurrency();
  const [status, setStatus] = useState(initialStatus);
  const [tier, setTier] = useState<Ticket["tier"]>("low");
  const [play, setPlay] = useState<Play | null>(null);
  const [revealed, setRevealed] = useState<boolean[]>(Array(9).fill(false));
  const [finished, setFinished] = useState(false);
  const [auto, setAuto] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [burst, setBurst] = useState(0);
  const [odds, setOdds] = useState(false);
  const [instant, setInstant] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  useEffect(() => {
    try {
      setInstant(localStorage.getItem(INSTANT_KEY) === "1");
    } catch {
      // private mode
    }
  }, []);
  const toggleInstant = (v: boolean) => {
    setInstant(v);
    try {
      if (v) localStorage.setItem(INSTANT_KEY, "1");
      else localStorage.removeItem(INSTANT_KEY);
    } catch {
      // private mode
    }
  };

  const buy = async (t: Ticket) => {
    if (busy) return;
    setBusy(t.id);
    setError(null);
    const res = await fetch("/api/games/scratch", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ticket: t.id }) })
      .then((r) => r.json())
      .catch(() => ({ ok: false, error: "Something went wrong." }));
    setBusy(null);
    if (!res.ok) return setError(res.error ?? "That didn't work.");
    setStatus({ nitro: res.nitro });
    // Show the cost now; the prize lands when the ticket is fully revealed
    onBalance(res.balance - res.payout);
    setRevealed(Array(9).fill(false));
    sent.current = 0;
    setFinished(false);
    setAuto(0);
    setPlay({ ticket: t, grid: res.grid, winSymbol: res.winSymbol, payout: res.payout, balance: res.balance, serial: Date.now().toString(36).toUpperCase().slice(-6) });
    if (instant) setTimeout(() => setAuto(Date.now()), 350);
    // Bring the ticket into view below the site's top bar
    const stage = document.querySelector(".gm-stage") as HTMLElement | null;
    if (stage) window.scrollTo({ top: Math.max(0, stage.getBoundingClientRect().top + window.scrollY - 96), behavior: "smooth" });
  };

  const onReveal = useCallback((i: number) => setRevealed((r) => (r[i] ? r : r.map((v, j) => (j === i ? true : v)))), []);

  // Tell spectators which cells are open (batched, so a fast scratch is one request)
  const sent = useRef(0);
  useEffect(() => {
    if (!play) return;
    const open = revealed.map((v, i) => (v ? i : -1)).filter((i) => i >= 0);
    if (open.length === sent.current) return;
    const t = setTimeout(() => {
      sent.current = open.length;
      void fetch("/api/games/scratch", { method: "POST", headers: { "Content-Type": "application/json", "x-kk-progress": "1" }, body: JSON.stringify({ revealed: open }) }).catch(() => undefined);
    }, 250);
    return () => clearTimeout(t);
  }, [revealed, play]);

  // Finish when everything's revealed, or as soon as the three winning symbols are showing
  useEffect(() => {
    if (!play || finished) return;
    const all = revealed.every(Boolean);
    const winShown = play.winSymbol ? play.grid.filter((s, i) => s === play.winSymbol && revealed[i]).length === 3 : false;
    if (winShown && !all) {
      setAuto(Date.now());
      return;
    }
    if (all) {
      setFinished(true);
      onBalance(play.balance);
      setHistory((h) => [{ id: Date.now(), icon: play.ticket.icon, name: play.ticket.name, cost: play.ticket.cost, payout: play.payout }, ...h].slice(0, 30));
      if (play.payout > play.ticket.cost) setBurst(Date.now());
    }
  }, [revealed, play, finished, onBalance]);

  const scratching = !!play && !finished;
  useEffect(() => onActive?.(scratching), [scratching, onActive]);
  useEffect(() => {
    if (!control) return;
    control.current = {
      quit: async () => {
        // The prize was settled when the ticket was bought; this just uncovers it (and tells spectators)
        setAuto(Date.now());
        await fetch("/api/games/scratch", { method: "POST", headers: { "Content-Type": "application/json", "x-kk-progress": "1" }, body: JSON.stringify({ revealed: [0, 1, 2, 3, 4, 5, 6, 7, 8] }) }).catch(() => undefined);
      },
    };
    return () => {
      control.current = null;
    };
  }, [control]);

  const premium = tickets.filter((t) => t.nitro);
  const outcome = !play || !finished ? null : play.payout > play.ticket.cost ? "win" : play.payout === play.ticket.cost ? "free" : "lose";
  const spent = history.reduce((n, h) => n + h.cost, 0);
  const won = history.reduce((n, h) => n + h.payout, 0);
  const open = revealed.filter(Boolean).length;

  const stats = history.length ? (
    <div className="sc3-session">
      <div className="sc3-session-nums">
        <span>
          <small>Tickets</small>
          <b>{history.length}</b>
        </span>
        <span>
          <small>Spent</small>
          <b>{compact(spent)}</b>
        </span>
        <span>
          <small>Won</small>
          <b>{compact(won)}</b>
        </span>
        <span className={won - spent >= 0 ? "is-up" : "is-down"}>
          <small>Net</small>
          <b>
            {won - spent >= 0 ? "+" : "−"}
            {compact(Math.abs(won - spent))}
          </b>
        </span>
      </div>
      <div className="sc3-history" aria-label="Recent tickets">
        {history.slice(0, 12).map((h) => (
          <span key={h.id} className={h.payout > h.cost ? "is-win" : h.payout === h.cost ? "is-free" : "is-lose"} title={`${h.name}: ${h.payout ? `won ${h.payout.toLocaleString()}` : "no win"}`}>
            {h.icon}
          </span>
        ))}
      </div>
    </div>
  ) : null;

  return (
    <div className="sc sc3">
      {error ? <p className="gm-error" role="alert">{error}</p> : null}

      {play ? (
        <div className={`sc3-play${outcome ? ` is-${outcome}` : ""}`}>
          <div className="sc3-play-main">
            <div className="sc3-ticket" style={{ "--t1": play.ticket.colors[0], "--t2": play.ticket.colors[1] } as CSSProperties}>
              {viewers > 0 ? (
                <span className="gm-watching is-ticket">
                  <Eye size={13} aria-hidden="true" /> {viewers} watching
                </span>
              ) : null}
              <header className="sc3-ticket-head">
                <span className="sc3-ticket-icon">{play.ticket.icon}</span>
                <div>
                  <strong>{play.ticket.name}</strong>
                  <small>Match 3 symbols to win that prize</small>
                </div>
                <span className="sc3-ticket-top">
                  <small>Win up to</small>
                  <b>{compact(topPrize(play.ticket))}</b>
                </span>
              </header>
              <div className="sc-grid-wrap sc3-grid">
                <div className="sc-grid">
                  {play.grid.map((sym, i) => (
                    <div key={i} className={`sc-cell${revealed[i] ? " is-open" : ""}${finished && sym === play.winSymbol ? " is-win" : ""}`}>
                      <span>{sym}</span>
                    </div>
                  ))}
                </div>
                {!finished ? <Foil play={play} revealed={revealed} onReveal={onReveal} auto={auto} /> : null}
                {finished ? (
                  <div className={`sc3-stamp is-${outcome}`} aria-hidden="true">
                    {outcome === "win" ? "Winner!" : outcome === "free" ? "Free ticket" : "No win"}
                  </div>
                ) : null}
              </div>
              <footer className="sc3-ticket-foot">
                <span className="sc3-barcode" aria-hidden="true" />
                <span>
                  No. {play.serial}-{play.ticket.id.toUpperCase()} · {play.ticket.cost.toLocaleString()} {cur.lower}
                </span>
              </footer>
              <Confetti burst={burst} big={!!play.winSymbol && play.payout >= play.ticket.cost * 10} />
            </div>
          </div>

          <aside className="sc3-side">
            <div className="sc3-prizes">
              <h3>Prize key</h3>
              {[...play.ticket.prizes]
                .sort((a, b) => b.payout - a.payout)
                .map((p) => (
                  <div key={p.symbol} className={finished && p.symbol === play.winSymbol ? "is-hit" : ""}>
                    <span>
                      {p.symbol}
                      {p.symbol}
                      {p.symbol}
                    </span>
                    <b>
                      {p.payout.toLocaleString()} <LeafEmote size={13} />
                    </b>
                  </div>
                ))}
            </div>

            {finished ? (
              <div className={`sc3-result is-${outcome}`} role="status">
                <strong>{outcome === "win" ? "You won!" : outcome === "free" ? "Free ticket!" : "Not this time"}</strong>
                <span>
                  {outcome === "lose" ? (
                    "Better luck on the next one."
                  ) : (
                    <>
                      +<CountUp value={play.payout} /> <LeafEmote size={15} />
                    </>
                  )}
                </span>
              </div>
            ) : (
              <div className="sc3-progress" role="status">
                <span>
                  Scratched {open} of 9
                </span>
                <i style={{ "--p": open / 9 } as CSSProperties} />
              </div>
            )}

            <div className="sc3-actions">
              {!finished ? (
                <button type="button" className="sc-btn is-primary" onClick={() => setAuto(Date.now())}>
                  <Wand2 size={16} aria-hidden="true" /> Reveal all
                </button>
              ) : (
                <button type="button" className="sc-btn is-primary" disabled={!!busy || balance < play.ticket.cost} onClick={() => buy(play.ticket)}>
                  <RefreshCw size={16} aria-hidden="true" /> Buy another · {play.ticket.cost.toLocaleString()} <LeafEmote size={14} />
                </button>
              )}
              <button type="button" className="sc-btn" onClick={() => setPlay(null)} disabled={!finished}>
                <ArrowLeft size={16} aria-hidden="true" /> All tickets
              </button>
              <label className="sc3-instant">
                <input type="checkbox" checked={instant} onChange={(e) => toggleInstant(e.target.checked)} /> Instant reveal
              </label>
            </div>
            {!finished ? <p className="sc3-tip">Drag across the foil to scratch it. Three of the same symbol wins that prize.</p> : null}
            {stats}
          </aside>
        </div>
      ) : (
        <div className="sc3-shop">
          <div className="sc3-shop-bar">
            <div className="sc3-tiers" role="tablist" aria-label="Ticket prices">
              {TIERS.map((x) => (
                <button key={x.key} type="button" role="tab" aria-selected={tier === x.key} className={tier === x.key ? "is-on" : undefined} onClick={() => setTier(x.key)}>
                  <b>{x.label}</b>
                  <small>{cur.text(x.blurb)}</small>
                </button>
              ))}
            </div>
            <label className="sc3-instant">
              <input type="checkbox" checked={instant} onChange={(e) => toggleInstant(e.target.checked)} /> Instant reveal
            </label>
          </div>
          {stats}
          {tickets.some((t) => t.tier === tier && t.nitro) ? (
            <div className={`gm-note${status.nitro ? " is-nitro" : ""}`}>
              <Gem size={16} aria-hidden="true" />
              <span>
                {status.nitro
                  ? `Premium tickets are unlocked for you (${premium.length} in all, 💎 Black Diamond and up).`
                  : "Premium tickets (💎 Black Diamond and up) unlock when you boost the server or support on Patreon as a Prince or Princess ($10)."}
              </span>
            </div>
          ) : null}
          <div className="sc3-grid-shop">
            {tickets
              .filter((t) => t.tier === tier)
              .map((t, i) => (
                <ShopTicket key={t.id} t={t} i={i} locked={!!t.nitro && !status.nitro} short={balance < t.cost} busy={busy === t.id || (!!busy && busy !== t.id)} onBuy={() => buy(t)} />
              ))}
          </div>
        </div>
      )}

      <div className={`gm-rules${odds ? " is-open" : ""}`}>
        <button type="button" onClick={() => setOdds((o) => !o)} aria-expanded={odds}>
          Odds & prizes <ChevronDown size={16} aria-hidden="true" />
        </button>
        {odds ? (
          <div className="gm-rules-body sc-odds">
            {tickets.map((t) => (
              <div key={t.id}>
                <b>
                  {t.icon} {t.name}
                </b>{" "}
                · {t.cost.toLocaleString()} {cur.lower} · wins {(t.winChance * 100).toFixed(0)}% of the time
                <span>{t.prizes.map((p) => `${p.symbol} ${p.payout.toLocaleString()}`).join("  ·  ")}</span>
              </div>
            ))}
            <p className="gm-fine">
              The same tickets and odds as /scratchoff in Discord. Each ticket is settled the moment you buy it, so scratching only reveals it. No daily limit. Black Diamond and every ticket above it are
              for Nitro boosters and Prince / Princess+ supporters. Most wins are a free ticket (your cost back).
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** A ticket as a spectator sees it: only cells the player has scratched are shown. */
export function ScratchSpectator({ scratch }: { scratch: PublicScratch | null }) {
  const [burst, setBurst] = useState(0);
  const wasDone = useRef(scratch?.finished ?? false);
  useEffect(() => {
    if (scratch?.finished && !wasDone.current && (scratch.payout ?? 0) > scratch.ticket.cost) setBurst(Date.now());
    wasDone.current = Boolean(scratch?.finished);
  }, [scratch]);
  if (!scratch) return <p className="sc-tip">Waiting for the next ticket…</p>;
  const t = scratch.ticket;
  const outcome = !scratch.finished ? null : (scratch.payout ?? 0) > t.cost ? "win" : scratch.payout === t.cost ? "free" : "lose";
  return (
    <div className={`sc-stage${outcome ? ` is-${outcome}` : ""}`}>
      <div className="sc-ticket is-live is-watch" style={{ "--t1": t.colors[0], "--t2": t.colors[1] } as CSSProperties}>
        <div className="sc-ticket-head">
          <span className="sc-ticket-icon">{t.icon}</span>
          <div>
            <strong>{t.name}</strong>
            <small>Match 3 to win</small>
          </div>
          <span className="sc-cost">
            {t.cost.toLocaleString()} <LeafEmote size={14} />
          </span>
        </div>
        <div className="sc-legend">
          {t.prizes.map((p) => (
            <span key={p.symbol} className={scratch.finished && p.symbol === scratch.winSymbol ? "is-hit" : ""}>
              <em>{p.symbol}</em> {compact(p.payout)}
            </span>
          ))}
        </div>
        <div className="sc-grid-wrap">
          <div className="sc-grid">
            {scratch.cells.map((sym, i) =>
              sym ? (
                <div key={`${i}-open`} className={`sc-cell is-open${scratch.finished && sym === scratch.winSymbol ? " is-win" : ""}`}>
                  <span>{sym}</span>
                </div>
              ) : (
                <div key={`${i}-foil`} className="sc-cell is-foil">
                  <span>{t.icon}</span>
                </div>
              ),
            )}
          </div>
        </div>
        <Confetti burst={burst} />
      </div>
      {scratch.finished ? (
        <div className={`sc-result is-${outcome}`} role="status">
          <strong>{outcome === "win" ? "Winner!" : outcome === "free" ? "Free ticket!" : "No luck this time"}</strong>
          {outcome !== "lose" ? (
            <span>
              Three {scratch.winSymbol} · +{(scratch.payout ?? 0).toLocaleString()} <LeafEmote size={16} />
            </span>
          ) : null}
        </div>
      ) : (
        <p className="sc-tip">Scratching… {scratch.cells.filter(Boolean).length}/9 revealed</p>
      )}
    </div>
  );
}
