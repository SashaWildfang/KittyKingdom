"use client";

import { ArrowLeft, ChevronDown, Lock, RefreshCw, Sparkles, Wand2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import type { Ticket } from "../../lib/games/scratch";
import { LeafEmote } from "../ui-icons";
import { Confetti, CountUp, type ScratchStatus } from "./games-client";

const TIERS: { key: Ticket["tier"]; label: string; blurb: string }[] = [
  { key: "low", label: "Low Roller", blurb: "10 – 75 leaves" },
  { key: "mid", label: "Mid Roller", blurb: "100 – 750 leaves" },
  { key: "high", label: "High Roller", blurb: "1,000 – 15,000 leaves" },
  { key: "vip", label: "VIP Whale", blurb: "25,000 – 100,000 leaves" },
];
const REVEAL_AT = 0.5; // share of a cell's foil scratched before it pops open
const BRUSH = 26;

type Play = { ticket: Ticket; grid: string[]; winSymbol: string | null; payout: number; balance: number; serial: string };

const topPrize = (t: Ticket) => Math.max(...t.prizes.map((p) => p.payout));
const compact = (n: number) => (n >= 1_000_000 ? `${+(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${+(n / 1000).toFixed(1)}K` : String(n));

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

  // Paint the foil
  useEffect(() => {
    const c = canvas.current;
    const w = wrap.current;
    if (!c || !w) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const { width, height } = w.getBoundingClientRect();
    c.width = Math.round(width * dpr);
    c.height = Math.round(height * dpr);
    const ctx = c.getContext("2d")!;
    ctx.scale(dpr, dpr);
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
  }, [play]);

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
    const ctx = c.getContext("2d")!;
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

  const scratchTo = (x: number, y: number) => {
    const c = canvas.current;
    if (!c) return;
    const ctx = c.getContext("2d")!;
    const dpr = c.width / c.getBoundingClientRect().width;
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
    // A few foil shavings fly off
    if (Math.random() < 0.35) {
      const id = ++shaveId.current;
      setShavings((s) => [...s.slice(-24), { id, x, y, dx: (Math.random() - 0.5) * 60 }]);
    }
  };

  const point = (e: React.PointerEvent) => {
    const r = canvas.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
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
    const rect = c.getBoundingClientRect();
    const cw = rect.width / 3;
    const ch = rect.height / 3;
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
        const ctx = c.getContext("2d")!;
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

export function ScratchOffs({ tickets, balance, onBalance, initialStatus }: { tickets: Ticket[]; balance: number; onBalance: (n: number) => void; initialStatus: ScratchStatus }) {
  const [status, setStatus] = useState(initialStatus);
  const [play, setPlay] = useState<Play | null>(null);
  const [revealed, setRevealed] = useState<boolean[]>(Array(9).fill(false));
  const [finished, setFinished] = useState(false);
  const [auto, setAuto] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [burst, setBurst] = useState(0);
  const [odds, setOdds] = useState(false);

  const left = status.limit === null ? null : Math.max(0, status.limit - status.used);

  const buy = async (t: Ticket) => {
    if (busy) return;
    setBusy(t.id);
    setError(null);
    const res = await fetch("/api/games/scratch", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ticket: t.id }) })
      .then((r) => r.json())
      .catch(() => ({ ok: false, error: "Something went wrong." }));
    setBusy(null);
    if (!res.ok) return setError(res.error ?? "That didn't work.");
    setStatus({ used: res.used, limit: res.limit, nitro: res.nitro });
    // Show the cost now; the prize lands when the ticket is fully revealed
    onBalance(res.balance - res.payout);
    setRevealed(Array(9).fill(false));
    setFinished(false);
    setAuto(0);
    setPlay({ ticket: t, grid: res.grid, winSymbol: res.winSymbol, payout: res.payout, balance: res.balance, serial: Date.now().toString(36).toUpperCase().slice(-6) });
    window.scrollTo({ top: (document.querySelector(".gm-stage") as HTMLElement | null)?.offsetTop ?? 0, behavior: "smooth" });
  };

  const onReveal = useCallback((i: number) => setRevealed((r) => (r[i] ? r : r.map((v, j) => (j === i ? true : v)))), []);

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
      if (play.payout > play.ticket.cost) setBurst(Date.now());
    }
  }, [revealed, play, finished, onBalance]);

  const outcome = !play || !finished ? null : play.payout > play.ticket.cost ? "win" : play.payout === play.ticket.cost ? "free" : "lose";

  return (
    <div className="sc">
      <div className="sc-limit">
        {status.nitro ? (
          <span className="sc-pill is-nitro">
            <Sparkles size={14} aria-hidden="true" /> Nitro: unlimited tickets
          </span>
        ) : (
          <>
            <span className="sc-pill">
              {left} of {status.limit} tickets left today
            </span>
            <span className="sc-meter" aria-hidden="true">
              {Array.from({ length: status.limit ?? 0 }, (_, i) => (
                <i key={i} className={i < status.used ? "is-used" : ""} />
              ))}
            </span>
          </>
        )}
      </div>

      {error ? <p className="gm-error" role="alert">{error}</p> : null}

      {play ? (
        <div className={`sc-stage${outcome ? ` is-${outcome}` : ""}`}>
          <button type="button" className="sc-back" onClick={() => setPlay(null)} disabled={!finished}>
            <ArrowLeft size={16} aria-hidden="true" /> All tickets
          </button>
          <div className="sc-ticket is-live" style={{ "--t1": play.ticket.colors[0], "--t2": play.ticket.colors[1] } as CSSProperties}>
            <div className="sc-ticket-head">
              <span className="sc-ticket-icon">{play.ticket.icon}</span>
              <div>
                <strong>{play.ticket.name}</strong>
                <small>Match 3 to win · Top prize {topPrize(play.ticket).toLocaleString()}</small>
              </div>
              <span className="sc-cost">
                {play.ticket.cost.toLocaleString()} <LeafEmote size={14} />
              </span>
            </div>
            <div className="sc-legend">
              {play.ticket.prizes.map((p) => (
                <span key={p.symbol} className={finished && p.symbol === play.winSymbol ? "is-hit" : ""}>
                  <em>{p.symbol}</em> {compact(p.payout)}
                </span>
              ))}
            </div>
            <div className="sc-grid-wrap">
              <div className="sc-grid">
                {play.grid.map((sym, i) => (
                  <div key={i} className={`sc-cell${revealed[i] ? " is-open" : ""}${finished && sym === play.winSymbol ? " is-win" : ""}`}>
                    <span>{sym}</span>
                  </div>
                ))}
              </div>
              {!finished ? <Foil play={play} revealed={revealed} onReveal={onReveal} auto={auto} /> : null}
            </div>
            <div className="sc-ticket-foot">
              <span>No. {play.serial}-{play.ticket.id.toUpperCase()}</span>
              <span>Kitty Kingdom Lottery</span>
            </div>
            <Confetti burst={burst} big={!!play.winSymbol && play.payout >= play.ticket.cost * 10} />
          </div>

          {finished ? (
            <div className={`sc-result is-${outcome}`} role="status">
              <strong>{outcome === "win" ? "Winner!" : outcome === "free" ? "Free ticket!" : "No luck this time"}</strong>
              <span>
                {outcome === "lose" ? (
                  <>Better luck on the next one.</>
                ) : (
                  <>
                    Three {play.winSymbol} · +<CountUp value={play.payout} /> <LeafEmote size={16} />
                  </>
                )}
              </span>
            </div>
          ) : (
            <p className="sc-tip">Drag across the foil to scratch it off. Find three matching symbols to win.</p>
          )}

          <div className="sc-stage-actions">
            {!finished ? (
              <button type="button" className="sc-btn" onClick={() => setAuto(Date.now())}>
                <Wand2 size={16} aria-hidden="true" /> Scratch it all
              </button>
            ) : (
              <button type="button" className="sc-btn is-primary" disabled={!!busy || balance < play.ticket.cost || left === 0} onClick={() => buy(play.ticket)}>
                <RefreshCw size={16} aria-hidden="true" /> Buy another ({play.ticket.cost.toLocaleString()} <LeafEmote size={14} />)
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="sc-gallery">
          {TIERS.map((tier) => (
            <section key={tier.key} className={`sc-tier is-${tier.key}`}>
              <header>
                <h2>{tier.label}</h2>
                <span>{tier.blurb}</span>
              </header>
              <div className="sc-tickets">
                {tickets
                  .filter((t) => t.tier === tier.key)
                  .map((t, i) => {
                    const locked = t.nitro && !status.nitro;
                    const short = balance < t.cost;
                    const out = left === 0;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        className={`sc-ticket is-card${locked ? " is-locked" : ""}`}
                        style={{ "--t1": t.colors[0], "--t2": t.colors[1], "--i": i } as CSSProperties}
                        disabled={!!busy || locked || short || out}
                        onClick={() => buy(t)}
                        title={locked ? "Nitro boosters only" : short ? "Not enough leaves" : out ? "No tickets left today" : `Buy ${t.name}`}
                      >
                        <span className="sc-card-shine" aria-hidden="true" />
                        <span className="sc-ticket-icon">{t.icon}</span>
                        <strong>{t.name}</strong>
                        <small>
                          Top prize {compact(topPrize(t))} · 1 in {(1 / t.winChance).toFixed(1)}
                        </small>
                        <span className="sc-buy">
                          {busy === t.id ? "Printing…" : locked ? (
                            <>
                              <Lock size={13} aria-hidden="true" /> Nitro
                            </>
                          ) : (
                            <>
                              {t.cost.toLocaleString()} <LeafEmote size={14} />
                            </>
                          )}
                        </span>
                      </button>
                    );
                  })}
              </div>
            </section>
          ))}
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
                · {t.cost.toLocaleString()} leaves · wins {(t.winChance * 100).toFixed(0)}% of the time
                <span>{t.prizes.map((p) => `${p.symbol} ${p.payout.toLocaleString()}`).join("  ·  ")}</span>
              </div>
            ))}
            <p className="gm-fine">
              Everyone gets {initialStatus.limit ?? 5} tickets a day (shared with /scratchoff in Discord); Nitro boosters are unlimited. Most wins are a free ticket (your cost back).
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
