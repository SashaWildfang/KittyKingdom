"use client";

import { ChevronDown, Rocket, Target } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { PublicCrash } from "../../lib/games/crash";
import { useCurrency } from "../season-context";
import { LeafEmote } from "../ui-icons";
import { Confetti } from "./games-client";
import "./crash.css";

const GROWTH = 0.00006;
const multAt = (ms: number) => Math.exp(GROWTH * Math.max(0, ms));
const timeFor = (x: number) => Math.log(Math.max(1, x)) / GROWTH;
const fmt = (x: number) => `${x.toFixed(2)}x`;
const tone = (x: number) => (x < 2 ? "is-low" : x < 10 ? "is-mid" : "is-high");

type Resp = { round: PublicCrash | null; balance: number; recent: number[]; serverNow: number; limits?: { min: number; max: number } };

/** The graph: the curve so far, the rocket at its tip, and the crash. Drawn on a canvas every frame. */
function Graph({ elapsed, mult, crashed, cashedAt, flying }: { elapsed: number; mult: number; crashed: boolean; cashedAt: number | null; flying: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = c.offsetWidth;
    const h = c.offsetHeight;
    if (c.width !== Math.round(w * dpr)) c.width = Math.round(w * dpr);
    if (c.height !== Math.round(h * dpr)) c.height = Math.round(h * dpr);
    const ctx = c.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const pad = { l: 44, r: 18, t: 18, b: 26 };
    const maxT = Math.max(8000, elapsed * 1.15);
    const maxM = Math.max(2, mult * 1.2);
    const X = (t: number) => pad.l + (t / maxT) * (w - pad.l - pad.r);
    const Y = (m: number) => h - pad.b - ((m - 1) / (maxM - 1)) * (h - pad.t - pad.b);
    const css = getComputedStyle(c);
    const muted = css.getPropertyValue("--cr-axis").trim() || "rgba(255,255,255,0.35)";
    // Grid lines and labels
    ctx.font = "600 11px system-ui";
    ctx.fillStyle = muted;
    ctx.strokeStyle = muted;
    ctx.globalAlpha = 0.5;
    const stepM = maxM <= 3 ? 0.5 : maxM <= 6 ? 1 : maxM <= 15 ? 2 : maxM <= 40 ? 5 : maxM <= 120 ? 20 : 100;
    for (let m = 1; m <= maxM; m += stepM) {
      const y = Y(m);
      ctx.beginPath();
      ctx.moveTo(pad.l, y);
      ctx.lineTo(w - pad.r, y);
      ctx.setLineDash([3, 5]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 0.9;
      ctx.fillText(`${+m.toFixed(1)}x`, 6, y + 4);
      ctx.globalAlpha = 0.5;
    }
    const stepT = maxT <= 15000 ? 2000 : maxT <= 40000 ? 5000 : maxT <= 90000 ? 10000 : 20000;
    for (let t = stepT; t < maxT; t += stepT) ctx.fillText(`${t / 1000}s`, X(t) - 8, h - 8);
    ctx.globalAlpha = 1;
    if (elapsed <= 0) return;

    // The curve, with a soft fill under it
    const color = crashed ? "#e5484d" : cashedAt ? "#3ddc84" : "#ffb21e";
    const pts: [number, number][] = [];
    const n = 80;
    for (let i = 0; i <= n; i++) {
      const t = (elapsed * i) / n;
      pts.push([X(t), Y(Math.min(mult, multAt(t)))]);
    }
    const fill = ctx.createLinearGradient(0, pad.t, 0, h - pad.b);
    fill.addColorStop(0, `${color}55`);
    fill.addColorStop(1, `${color}00`);
    ctx.beginPath();
    ctx.moveTo(pts[0][0], h - pad.b);
    pts.forEach(([x, y]) => ctx.lineTo(x, y));
    ctx.lineTo(pts[pts.length - 1][0], h - pad.b);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.strokeStyle = color;
    ctx.lineWidth = 3.5;
    ctx.lineCap = "round";
    ctx.shadowColor = color;
    ctx.shadowBlur = 14;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Where they cashed out
    if (cashedAt && cashedAt <= mult) {
      const cx = X(timeFor(cashedAt));
      const cy = Y(cashedAt);
      ctx.fillStyle = "#3ddc84";
      ctx.beginPath();
      ctx.arc(cx, cy, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = "800 12px system-ui";
      ctx.fillText(`Cashed ${fmt(cashedAt)}`, Math.min(cx + 10, w - 110), cy - 10);
    }
    // The rocket at the tip (or the explosion)
    const [tx, ty] = pts[pts.length - 1];
    ctx.font = `${crashed ? 34 : 28}px "Apple Color Emoji", "Segoe UI Emoji", system-ui`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    if (crashed) ctx.fillText("💥", tx, ty);
    else {
      ctx.save();
      ctx.translate(tx, ty);
      ctx.rotate(flying ? -0.2 : 0);
      ctx.fillText("🚀", 0, 0);
      ctx.restore();
    }
    ctx.textAlign = "start";
    ctx.textBaseline = "alphabetic";
  });
  return <canvas ref={ref} className="cr-graph" aria-hidden="true" />;
}

export function Crash({ balance, onBalance, active }: { balance: number; onBalance: (n: number) => void; active: boolean }) {
  const cur = useCurrency();
  const [round, setRound] = useState<PublicCrash | null>(null);
  const [recent, setRecent] = useState<number[]>([]);
  const [limits, setLimits] = useState({ min: 10, max: 100_000 });
  const [bet, setBet] = useState(100);
  const [autoOn, setAutoOn] = useState(false);
  const [auto, setAuto] = useState(2);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(0);
  const [burst, setBurst] = useState(0);
  const [rules, setRules] = useState(false);
  const offset = useRef(0); // server clock − browser clock

  const apply = useCallback(
    (r: Resp, sent?: number) => {
      // The server's clock: its time was taken about halfway through the request
      const mid = sent ? (sent + Date.now()) / 2 : Date.now();
      offset.current = r.serverNow - mid;
      setRound((prev) => {
        if (r.round && r.round.status === "cashed" && prev?.status === "playing" && r.round.roundId === prev.roundId) setBurst(Date.now());
        return r.round;
      });
      setRecent(r.recent ?? []);
      if (r.limits) setLimits(r.limits);
      onBalance(r.balance);
    },
    [onBalance],
  );

  useEffect(() => {
    const sent = Date.now();
    fetch("/api/games/crash", { cache: "no-store" })
      .then((r) => r.json())
      .then((r) => r?.ok && apply(r, sent))
      .catch(() => undefined);
  }, [apply]);

  // The clock for the animation, and a check with the server while the round is live
  const live = round?.status === "playing";
  const serverTime = () => Date.now() + offset.current;
  const animating = Boolean(round && (live || (round.crashAt && serverTime() - round.startedAt < timeFor(round.crashAt) + 2500)));
  useEffect(() => {
    if (!animating) return;
    let raf = 0;
    const tick = () => {
      setNow(Date.now() + offset.current);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [animating]);
  useEffect(() => {
    if (!live) return;
    const t = setInterval(() => {
      const sent = Date.now();
      fetch("/api/games/crash", { cache: "no-store" })
        .then((r) => r.json())
        .then((r) => r?.ok && apply(r, sent))
        .catch(() => undefined);
    }, 300);
    return () => clearInterval(t);
  }, [live, apply]);

  const start = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    const sent = Date.now();
    const res = await fetch("/api/games/crash", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "start", bet, auto: autoOn ? auto : null }) })
      .then((r) => r.json())
      .catch(() => ({ ok: false, error: "Something went wrong." }));
    setBusy(false);
    if (!res.ok) return setError(res.error ?? "That didn't work.");
    apply(res, sent);
  };
  const cashOut = async () => {
    if (busy || !live) return;
    setBusy(true);
    const sent = Date.now();
    const res = await fetch("/api/games/crash", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "cashout" }) })
      .then((r) => r.json())
      .catch(() => ({ ok: false, error: "Something went wrong." }));
    setBusy(false);
    if (!res.ok) return setError(res.error ?? "That didn't work.");
    apply(res, sent);
  };

  // Space bar: place a bet, or cash out
  const startRef = useRef(start);
  const cashRef = useRef(cashOut);
  startRef.current = start;
  cashRef.current = cashOut;
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (e.code !== "Space" || (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "BUTTON"))) return;
      e.preventDefault();
      if (live) void cashRef.current();
      else void startRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, live]);

  // What the screen shows right now
  let elapsed = 0;
  let mult = 1;
  let crashed = false;
  if (round) {
    elapsed = Math.max(0, now - round.startedAt);
    if (round.crashAt) {
      const end = timeFor(round.crashAt);
      if (elapsed >= end || round.status === "bust") {
        elapsed = Math.min(elapsed, end);
        if (round.status === "bust") elapsed = end;
        crashed = elapsed >= end;
      }
      mult = crashed ? round.crashAt : multAt(elapsed);
    } else mult = multAt(elapsed);
  }
  const shownMult = Math.floor(mult * 100) / 100;
  const value = live ? Math.floor((round?.bet ?? 0) * shownMult) : 0;
  const clampBet = (n: number) => Math.max(limits.min, Math.min(limits.max, Math.floor(n) || limits.min));
  const result = round && round.status !== "playing" ? round : null;

  return (
    <div className="cr">
      <div className="cr-stage">
        <div className={`cr-screen${crashed ? " is-crashed" : ""}${round?.status === "cashed" ? " is-cashed" : ""}${live ? " is-live" : ""}`}>
          <div className="cr-recent" aria-label="Recent crash points">
            {recent.length ? recent.slice(0, 14).map((p, i) => <span key={`${i}-${p}`} className={tone(p)}>{fmt(p)}</span>) : <span className="is-empty">No rounds yet</span>}
          </div>
          <Graph elapsed={round ? elapsed : 0} mult={round ? mult : 1} crashed={crashed} cashedAt={round?.cashedAt ?? null} flying={live} />
          <div className="cr-readout" aria-live="polite">
            <strong className={crashed ? "is-crashed" : round?.status === "cashed" ? "is-cashed" : ""}>{fmt(round ? shownMult : 1)}</strong>
            <span>
              {!round
                ? "Place a bet to launch"
                : live
                  ? <>Cash out for {value.toLocaleString()} <LeafEmote size={16} /></>
                  : crashed
                    ? round.status === "cashed"
                      ? `Crashed at ${fmt(round.crashAt!)}`
                      : `Crashed at ${fmt(round.crashAt!)}: you lost ${round.bet.toLocaleString()}`
                    : round.status === "cashed"
                      ? `You cashed out at ${fmt(round.cashedAt!)}`
                      : ""}
            </span>
          </div>
          <Confetti burst={burst} />
        </div>

        <aside className="cr-panel">
          <label className="cr-field">
            <span>Bet</span>
            <div className="cr-input">
              <LeafEmote size={16} />
              <input type="number" inputMode="numeric" min={limits.min} max={limits.max} value={bet} disabled={live} onChange={(e) => setBet(Number(e.target.value))} onBlur={() => setBet(clampBet(bet))} />
            </div>
          </label>
          <div className="cr-chips">
            <button type="button" disabled={live} onClick={() => setBet(clampBet(bet / 2))}>½</button>
            <button type="button" disabled={live} onClick={() => setBet(clampBet(bet * 2))}>2×</button>
            <button type="button" disabled={live} onClick={() => setBet(clampBet(100))}>100</button>
            <button type="button" disabled={live} onClick={() => setBet(clampBet(1000))}>1K</button>
            <button type="button" disabled={live} onClick={() => setBet(clampBet(Math.min(balance, limits.max)))}>Max</button>
          </div>
          <div className="cr-field">
            <span className="cr-auto-head">
              <label>
                <input type="checkbox" checked={autoOn} disabled={live} onChange={(e) => setAutoOn(e.target.checked)} /> Auto cash-out
              </label>
              <Target size={14} aria-hidden="true" />
            </span>
            <div className={`cr-input${autoOn ? "" : " is-off"}`}>
              <input type="number" step="0.1" min={1.01} max={1000} value={auto} disabled={!autoOn || live} onChange={(e) => setAuto(Number(e.target.value))} onBlur={() => setAuto(Math.max(1.01, Math.min(1000, Math.round(auto * 100) / 100 || 2)))} />
              <b>x</b>
            </div>
          </div>
          {live ? (
            <button type="button" className="cr-go is-cash" onClick={() => void cashOut()} disabled={busy}>
              Cash out
              <small>
                {value.toLocaleString()} <LeafEmote size={13} />
              </small>
            </button>
          ) : (
            <button type="button" className="cr-go" onClick={() => void start()} disabled={busy || balance < bet}>
              <Rocket size={18} aria-hidden="true" /> {balance < bet ? `Not enough ${cur.lower}` : "Launch"}
              <small>Space bar works too</small>
            </button>
          )}
          {error ? <p className="gm-error" role="alert">{error}</p> : null}
          {result ? (
            <p className={`cr-last is-${result.status}`}>
              {result.status === "cashed" ? (
                <>
                  Won <b>+{((result.payout ?? 0) - result.bet).toLocaleString()}</b> <LeafEmote size={13} /> at {fmt(result.cashedAt!)}
                </>
              ) : (
                <>
                  Lost <b>{result.bet.toLocaleString()}</b> <LeafEmote size={13} /> · crashed at {fmt(result.crashAt!)}
                </>
              )}
            </p>
          ) : null}
          <p className="cr-limits">
            Bets {limits.min.toLocaleString()} to {limits.max.toLocaleString()} <LeafEmote size={14} />
          </p>
        </aside>
      </div>

      <div className={`gm-rules${rules ? " is-open" : ""}`}>
        <button type="button" onClick={() => setRules((o) => !o)} aria-expanded={rules}>
          How Crash works <ChevronDown size={16} aria-hidden="true" />
        </button>
        {rules ? (
          <div className="gm-rules-body">
            <p>Bet, launch, and watch the multiplier climb. Cash out before it crashes to win your bet times the multiplier. If it crashes first, the bet is lost.</p>
            <p>Set an auto cash-out and the server cashes out for you the moment it gets there, even if you close the page.</p>
            <p className="gm-fine">
              The crash point is picked on the server when you launch and kept secret until the round ends. The chance of reaching any multiplier x is 97% ÷ x (a 3% house edge), so about 3 rounds in 100 crash
              instantly at 1.00x. Rounds top out at 1,000x. Lost bets feed the slots jackpot.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
