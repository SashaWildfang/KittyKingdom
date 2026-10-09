"use client";

import { Eye, RotateCcw, Trash2, Users, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { LeafEmote } from "../ui-icons";
import { Confetti } from "./games-client";
import { useCurrency } from "../season-context";

// European wheel order, clockwise from zero
const WHEEL = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
const RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
const colorOf = (n: number) => (n === 0 ? "green" : RED.has(n) ? "red" : "black");
const POCKET = 360 / 37;
const pocketAngle = (n: number) => WHEEL.indexOf(n) * POCKET;
const WHEEL_SPEED = 0.024; // deg per ms, the rotor's slow constant turn

// The ball's run, in ms after bets close (the spin lasts 7s). It's worked out relative to the rotor and
// backwards from the winning pocket, so wherever it starts it always lands exactly on the number.
const LAUNCH = 350; // lifted out of its pocket onto the outer track
const TRACK_END = 4100; // rolling round the track, slowing down
const DROP_END = 4800; // falls off the track, clips a diamond deflector
const SETTLE = 6400; // bounces across pockets, then sits
const V0 = 0.62; // deg/ms relative to the rotor at launch
const V_TRACK_END = 0.17;
const DECEL = (V0 - V_TRACK_END) / TRACK_END;
const R_POCKET = 118;
const R_TRACK = 158;

/** A small seeded random generator, so every viewer sees the same bounces for a round. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Hop = { at: number; dur: number; pockets: number; height: number };
/** The bounces after the drop: three or four hops over fewer and fewer pockets (sometimes one kicks back). */
function hopsFor(round: number): { drop: number; hops: Hop[] } {
  const r = rng(round * 7919 + 13);
  const count = 3 + Math.floor(r() * 2);
  const hops: Hop[] = [];
  let at = DROP_END;
  const budget = SETTLE - DROP_END;
  const durs = Array.from({ length: count }, (_, i) => 1 / (i + 1.4));
  const sum = durs.reduce((a, b) => a + b, 0);
  for (let i = 0; i < count; i++) {
    const dur = (durs[i] / sum) * budget;
    const big = Math.max(1, Math.round((count - i) * (0.8 + r() * 1.1)));
    const pockets = i > 0 && r() < 0.25 ? -1 : big;
    hops.push({ at, dur, pockets, height: 16 * Math.pow(0.55, i) + 2 });
    at += dur;
  }
  return { drop: 40 + r() * 50, hops };
}

const easeOut = (u: number) => 1 - Math.pow(1 - u, 3);

const CHIPS = [25, 100, 500, 1000, 5000, 10000];
const CHIP_CLASS: Record<number, string> = { 25: "c25", 100: "c100", 500: "c500", 1000: "c1k", 5000: "c5k", 10000: "c10k" };
const short = (n: number) => (n >= 1_000_000 ? `${+(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${+(n / 1000).toFixed(1)}K` : String(n));

type Player = { id: string; name: string; avatar: string | null };
type TableBet = { player: Player; bets: Record<string, number>; total: number };
type State = {
  now: number;
  round: number;
  startAt: number;
  closeAt: number;
  spinEndAt: number;
  endAt: number;
  phase: "betting" | "spinning" | "result";
  number: number | null;
  table: TableBet[];
  mine: Record<string, number>;
  history: { round: number; number: number; color: string }[];
  last: { round: number; number: number; color: string; players: (TableBet & { payout: number; net: number })[] } | null;
  viewers: number;
  balance: number | null;
};

const covers = (key: string, n: number) => {
  if (key.startsWith("n")) return Number(key.slice(1)) === n;
  if (n === 0) return false;
  switch (key) {
    case "red": return RED.has(n);
    case "black": return !RED.has(n);
    case "odd": return n % 2 === 1;
    case "even": return n % 2 === 0;
    case "low": return n <= 18;
    case "high": return n >= 19;
    case "d1": return n <= 12;
    case "d2": return n >= 13 && n <= 24;
    case "d3": return n >= 25;
    case "c1": return n % 3 === 1;
    case "c2": return n % 3 === 2;
    case "c3": return n % 3 === 0;
  }
  return false;
};

function Avatar({ p, size = 24 }: { p: Player; size?: number }) {
  const [failed, setFailed] = useState(false);
  return p.avatar && !failed ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img className="rl-avatar" src={p.avatar} alt="" width={size} height={size} onError={() => setFailed(true)} />
  ) : (
    <span className="rl-avatar is-letter" style={{ width: size, height: size }}>
      {p.name.charAt(0).toUpperCase()}
    </span>
  );
}

// ---------- the wheel ----------

/** Cubic Hermite between two angles with given speeds (deg/ms), for the ball slowing into its pocket. */
const hermite = (p0: number, v0: number, p1: number, v1: number, T: number, s: number) => {
  const s2 = s * s;
  const s3 = s2 * s;
  return (2 * s3 - 3 * s2 + 1) * p0 + (s3 - 2 * s2 + s) * T * v0 + (-2 * s3 + 3 * s2) * p1 + (s3 - s2) * T * v1;
};

function Wheel({ state, clock }: { state: State | null; clock: () => number }) {
  const rotor = useRef<SVGGElement>(null);
  const ball = useRef<SVGGElement>(null);
  const shadow = useRef<SVGGElement>(null);
  const plan = useRef<{ round: number; tk: number; a0: number; aEnd: number } | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    let raf = 0;
    const frame = () => {
      raf = requestAnimationFrame(frame);
      const s = stateRef.current;
      const t = clock();
      const wheel = (t * WHEEL_SPEED) % 360;
      rotor.current?.setAttribute("transform", `rotate(${wheel} 200 200)`);
      if (!s || !ball.current) return;
      const rest = s.history[0]?.number ?? 0;
      const e = t - s.closeAt; // ms into the spin
      let rel = pocketAngle(rest); // the ball's angle on the rotor
      let radius = R_POCKET;

      if (e >= 0) {
        // Rolling free on the track: no number needed yet
        const freeRel = (at: number) => pocketAngle(rest) - (V0 * at - 0.5 * DECEL * at * at);
        const freeV = (at: number) => -(V0 - DECEL * at);
        rel = freeRel(Math.min(e, TRACK_END));
        radius = e < LAUNCH ? R_POCKET + (R_TRACK - R_POCKET) * easeOut(e / LAUNCH) : R_TRACK + Math.sin(e / 90) * 0.8;

        if (s.number !== null) {
          const { drop, hops } = hopsFor(s.round);
          const hopTravel = hops.reduce((a, h) => a + h.pockets * POCKET, 0);
          // Plan once: glide on the track from wherever the ball is to where the drop has to start
          if (!plan.current || plan.current.round !== s.round) {
            const tk = Math.min(Math.max(e, LAUNCH), TRACK_END - 200);
            const p0 = freeRel(tk);
            const ideal = p0 - ((V0 - DECEL * tk + V_TRACK_END) / 2) * (TRACK_END - tk);
            const base = pocketAngle(s.number) + drop + hopTravel;
            const k = Math.round((base - ideal) / 360);
            plan.current = { round: s.round, tk, a0: p0, aEnd: base - k * 360 };
          }
          const p = plan.current;
          const atDrop = p.aEnd; // rotor angle where the ball leaves the track
          if (e < p.tk) {
            // still before the plan's start (only on a late join)
          } else if (e < TRACK_END) {
            const u = (e - p.tk) / (TRACK_END - p.tk);
            rel = hermite(p.a0, freeV(p.tk), atDrop, -drop / (DROP_END - TRACK_END), TRACK_END - p.tk, u);
          } else if (e < DROP_END) {
            // Off the track and down the slope, glancing off a deflector on the way
            const u = (e - TRACK_END) / (DROP_END - TRACK_END);
            rel = atDrop - drop * u;
            radius = R_TRACK - (R_TRACK - (R_POCKET + 12)) * u * u + Math.max(0, Math.sin((u - 0.35) * Math.PI * 2.2)) * 9 * (1 - u);
          } else {
            // Rattling across the pockets
            let at = atDrop - drop;
            radius = R_POCKET;
            for (const h of hops) {
              if (e < h.at) break;
              const u = Math.min(1, (e - h.at) / h.dur);
              rel = at - h.pockets * POCKET * easeOut(u);
              radius = R_POCKET + h.height * Math.sin(Math.PI * u);
              at -= h.pockets * POCKET;
            }
            if (e >= SETTLE) {
              rel = pocketAngle(s.number);
              radius = R_POCKET;
            }
          }
        } else if (e >= TRACK_END) {
          // The number hasn't reached us yet: keep rolling slowly
          rel = freeRel(TRACK_END) + freeV(TRACK_END) * (e - TRACK_END);
        }
      }
      ball.current.setAttribute("transform", `rotate(${wheel + rel} 200 200) translate(0 ${-radius})`);
      // The ball's shadow sits a touch further out, so it reads as rolling on the wood
      shadow.current?.setAttribute("transform", `rotate(${wheel + rel + 1.2} 200 200) translate(0 ${-radius + 2})`);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [clock]);

  return (
    <svg className="rl-wheel" viewBox="0 0 400 400" aria-label={state?.number !== null && state?.phase === "result" ? `The ball landed on ${state?.number}` : "Roulette wheel"}>
      <defs>
        <radialGradient id="rl-wood" cx="50%" cy="45%" r="60%">
          <stop offset="0%" stopColor="#8a4b22" />
          <stop offset="100%" stopColor="#3a1a08" />
        </radialGradient>
        <radialGradient id="rl-cone" cx="50%" cy="40%" r="55%">
          <stop offset="0%" stopColor="#f6e2a0" />
          <stop offset="60%" stopColor="#c9a032" />
          <stop offset="100%" stopColor="#7a5a10" />
        </radialGradient>
        <radialGradient id="rl-ball" cx="35%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#b8bcc6" />
        </radialGradient>
      </defs>
      <circle cx="200" cy="200" r="198" fill="url(#rl-wood)" />
      <circle cx="200" cy="200" r="176" fill="#2a1206" stroke="#c9a032" strokeWidth="2" />
      <circle cx="200" cy="200" r="168" fill="#4a2410" />
      <g ref={rotor}>
        {WHEEL.map((n, i) => {
          const a0 = ((i - 0.5) * POCKET - 90) * (Math.PI / 180);
          const a1 = ((i + 0.5) * POCKET - 90) * (Math.PI / 180);
          const R = 150;
          const r = 104;
          const d = `M${200 + R * Math.cos(a0)} ${200 + R * Math.sin(a0)}A${R} ${R} 0 0 1 ${200 + R * Math.cos(a1)} ${200 + R * Math.sin(a1)}L${200 + r * Math.cos(a1)} ${200 + r * Math.sin(a1)}A${r} ${r} 0 0 0 ${200 + r * Math.cos(a0)} ${200 + r * Math.sin(a0)}Z`;
          const fill = n === 0 ? "#1f8a4c" : RED.has(n) ? "#c8202e" : "#15151c";
          return (
            <g key={n}>
              <path d={d} fill={fill} stroke="#c9a032" strokeWidth="1" />
              <text x="200" y="62" transform={`rotate(${i * POCKET} 200 200)`} textAnchor="middle" fill="#fff" fontSize="13" fontWeight="800" fontFamily="Georgia, serif">
                {n}
              </text>
            </g>
          );
        })}
        <circle cx="200" cy="200" r="104" fill="none" stroke="#c9a032" strokeWidth="2" />
        <circle cx="200" cy="200" r="84" fill="url(#rl-cone)" />
        {[0, 45, 90, 135].map((a) => (
          <rect key={a} x="195" y="128" width="10" height="144" rx="5" fill="#d9b44a" stroke="#7a5a10" transform={`rotate(${a} 200 200)`} />
        ))}
        <circle cx="200" cy="200" r="18" fill="#e9c75a" stroke="#7a5a10" strokeWidth="2" />
      </g>
      {/* Diamond deflectors on the bowl */}
      {Array.from({ length: 8 }, (_, i) => (
        <path key={i} d="M200 41l3.5 4.5-3.5 4.5-3.5-4.5z" fill="#e9c75a" stroke="#7a5a10" strokeWidth="0.6" transform={`rotate(${i * 45 + 22.5} 200 200)`} />
      ))}
      <g ref={shadow} opacity="0.35">
        <circle cx="200" cy="200" r="7" fill="#000" />
      </g>
      <g ref={ball}>
        <circle cx="200" cy="200" r="7.5" fill="url(#rl-ball)" stroke="#6b6f78" strokeWidth="0.6" />
        <circle cx="197.6" cy="197.4" r="2.2" fill="#fff" opacity="0.9" />
      </g>
    </svg>
  );
}

// ---------- the layout (betting board) ----------

const SPOT_LABEL: Record<string, string> = {
  red: "Red", black: "Black", odd: "Odd", even: "Even", low: "1–18", high: "19–36",
  d1: "1st 12", d2: "2nd 12", d3: "3rd 12", c1: "Column 1", c2: "Column 2", c3: "Column 3",
};
const spotLabel = (k: string) => (k.startsWith("n") ? k.slice(1) : SPOT_LABEL[k] ?? k);
const spotTone = (k: string) => (k.startsWith("n") ? colorOf(Number(k.slice(1))) : k === "red" ? "red" : k === "black" ? "black" : "outside");

/** What someone has on the table: one small tag per spot, biggest first. */
function BetTags({ bets }: { bets: Record<string, number> }) {
  const cur = useCurrency();
  const list = Object.entries(bets).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  if (!list.length) return null;
  return (
    <span className="rl-tags">
      {list.map(([k, v]) => (
        <span key={k} className={`rl-tag is-${spotTone(k)}`} title={`${spotLabel(k)}: ${v.toLocaleString()} ${cur.lower}`}>
          <i>{spotLabel(k)}</i> {short(v)}
        </span>
      ))}
    </span>
  );
}

function Spot({ k, label, className, mine, others, win, disabled, onBet, style }: { k: string; label: React.ReactNode; className?: string; mine: number; others: Player[]; win: boolean; disabled: boolean; onBet: (k: string) => void; style?: CSSProperties }) {
  const cur = useCurrency();
  return (
    <button type="button" className={`rl-spot ${className ?? ""}${win ? " is-win" : ""}${mine > 0 ? " is-mine" : ""}`} style={style} disabled={disabled} onClick={() => onBet(k)} aria-label={`Bet on ${spotLabel(k)}${mine > 0 ? ` (you have ${mine} on it)` : ""}`} title={mine > 0 ? `Your bet: ${mine.toLocaleString()} ${cur.lower}` : undefined}>
      <span className="rl-spot-label">{label}</span>
      {others.length ? (
        <span className="rl-others" aria-hidden="true">
          {others.slice(0, 3).map((p) => (
            <Avatar key={p.id} p={p} size={14} />
          ))}
        </span>
      ) : null}
      {mine > 0 ? <span className="rl-mybet" aria-hidden="true">{short(mine)}</span> : null}
    </button>
  );
}

function Board({ state, onBet, disabled, myId }: { state: State | null; onBet: (k: string) => void; disabled: boolean; myId: string | null }) {
  const mine = state?.mine ?? {};
  const winning = state && state.phase === "result" && state.number !== null ? state.number : null;
  const othersOn = useMemo(() => {
    const map = new Map<string, Player[]>();
    for (const t of state?.table ?? []) {
      if (t.player.id === myId) continue;
      for (const [k, v] of Object.entries(t.bets)) if (v > 0) map.set(k, [...(map.get(k) ?? []), t.player]);
    }
    return map;
  }, [state?.table, myId]);
  const props = (k: string) => ({ k, mine: mine[k] ?? 0, others: othersOn.get(k) ?? [], win: winning !== null && covers(k, winning), disabled, onBet });
  // Each spot's place on the wide layout (c, r) and on the tall phone layout (mc, mr)
  const at = (c: string | number, r: string | number, mc: string | number, mr: string | number) => ({ "--c": c, "--r": r, "--mc": mc, "--mr": mr }) as CSSProperties;
  const rows = [3, 2, 1];
  return (
    <div className="rl-board">
      <Spot {...props("n0")} label="0" className="is-green is-zero" style={at(1, "1 / span 3", "3 / span 3", 1)} />
      {rows.map((r, ri) =>
        Array.from({ length: 12 }, (_, c) => {
          const n = c * 3 + r;
          return <Spot key={n} {...props(`n${n}`)} label={String(n)} className={`is-${colorOf(n)}`} style={at(c + 2, ri + 1, ((n - 1) % 3) + 3, Math.ceil(n / 3) + 1)} />;
        }),
      )}
      {rows.map((r, ri) => (
        <Spot key={`c${r}`} {...props(`c${r}`)} label="2:1" className="is-outside" style={at(14, ri + 1, r + 2, 14)} />
      ))}
      {[1, 2, 3].map((d) => (
        <Spot key={`d${d}`} {...props(`d${d}`)} label={["1st 12", "2nd 12", "3rd 12"][d - 1]} className="is-outside is-dozen" style={at(`${(d - 1) * 4 + 2} / span 4`, 4, 2, `${(d - 1) * 4 + 2} / span 4`)} />
      ))}
      {[
        ["low", "1–18"],
        ["even", "Even"],
        ["red", <span key="r" className="rl-diamond is-red" />],
        ["black", <span key="b" className="rl-diamond is-black" />],
        ["odd", "Odd"],
        ["high", "19–36"],
      ].map(([k, label], i) => (
        <Spot key={k as string} {...props(k as string)} label={label} className="is-outside" style={at(`${i * 2 + 2} / span 2`, 5, 1, `${i * 2 + 2} / span 2`)} />
      ))}
    </div>
  );
}

// ---------- the table ----------

/** The live roulette table. `watch` is a spectator's (or staff's) view: no betting. */
export function Roulette({ stateUrl = "/api/games/roulette", watch = false, myId = null, balance = 0, onBalance }: { stateUrl?: string; watch?: boolean; myId?: string | null; balance?: number; onBalance?: (n: number) => void }) {
  const [state, setState] = useState<State | null>(null);
  const [chip, setChip] = useState(100);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(0);
  const [, setTick] = useState(0);
  const [burst, setBurst] = useState(0);
  const offset = useRef(0);
  const celebrated = useRef<number | null>(null);
  const lastMine = useRef<{ round: number; bets: Record<string, number> } | null>(null);
  const clock = useCallback(() => Date.now() + offset.current, []);

  // Follow the table; the server clock keeps everyone's wheel in step
  useEffect(() => {
    let stop = false;
    const tick = async () => {
      const sent = Date.now();
      const res = await fetch(stateUrl, { cache: "no-store" }).then((r) => r.json()).catch(() => null);
      if (stop || !res?.ok) return;
      const got = Date.now();
      offset.current = res.now - (sent + got) / 2;
      setState((prev) => {
        // Keep the chips you just placed if this poll was already on its way
        if (prev && prev.round === res.round && Object.keys(prev.mine).length && !Object.keys(res.mine ?? {}).length && res.phase === "betting") return { ...res, mine: prev.mine };
        return res;
      });
      // Your balance only moves once the ball has landed (the server pays as soon as the number is drawn)
      if (!watch && typeof res.balance === "number" && res.phase !== "spinning") onBalance?.(res.balance);
    };
    void tick();
    const t = setInterval(tick, 1000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [stateUrl, watch, onBalance]);

  // A countdown that ticks between polls
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 250);
    return () => clearInterval(t);
  }, []);

  const now = clock();
  const phase = !state ? "betting" : now < state.closeAt ? "betting" : now < state.spinEndAt ? "spinning" : "result";
  const showResult = phase === "result" && state?.number !== null;
  const last = state?.last ?? null;
  const me = last?.players.find((p) => p.player.id === myId) ?? null;

  // Remember your chips for "Rebet", and celebrate your wins
  useEffect(() => {
    if (state && Object.keys(state.mine).length) lastMine.current = { round: state.round, bets: state.mine };
  }, [state]);
  useEffect(() => {
    if (!last || !me || celebrated.current === last.round) return;
    if (showResult || last.round < (state?.round ?? 0)) {
      celebrated.current = last.round;
      if (me.net > 0 && showResult) setBurst(Date.now());
    }
  }, [last, me, showResult, state?.round]);

  const bet = useCallback(
    async (spot: string, amount = chip) => {
      if (watch) return;
      setError(null);
      setPending((n) => n + 1);
      const res = await fetch(stateUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "bet", spot, amount }) })
        .then((r) => r.json())
        .catch(() => ({ ok: false, error: "Something went wrong." }));
      setPending((n) => n - 1);
      if (!res.ok) return setError(res.error ?? "That chip didn't go down.");
      onBalance?.(res.balance);
      setState((s) => (s ? { ...s, mine: res.mine } : s));
    },
    [chip, stateUrl, watch, onBalance],
  );

  const clear = async () => {
    setError(null);
    const res = await fetch(stateUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "clear" }) })
      .then((r) => r.json())
      .catch(() => ({ ok: false, error: "Something went wrong." }));
    if (!res.ok) return setError(res.error ?? "Couldn't take your chips back.");
    onBalance?.(res.balance);
    setState((s) => (s ? { ...s, mine: {} } : s));
  };

  const rebetFrom = lastMine.current && state && lastMine.current.round < state.round ? lastMine.current.bets : null;
  const rebet = async () => {
    if (!rebetFrom) return;
    for (const [k, v] of Object.entries(rebetFrom)) if (v > 0) await bet(k, v);
  };

  const myTotal = Object.values(state?.mine ?? {}).reduce((a, b) => a + b, 0);
  const secs = state ? Math.max(0, Math.ceil((state.closeAt - now) / 1000)) : 0;
  const betting = phase === "betting";
  const winners = (last?.players ?? []).filter((p) => p.net > 0);
  const losers = (last?.players ?? []).filter((p) => p.net <= 0);
  const resultVisible = last && (showResult || last.round < (state?.round ?? 0));

  return (
    <div className={`rl${watch ? " is-watch" : ""}`}>
      <div className="rl-top">
        <div className="rl-wheel-wrap">
          <Wheel state={state} clock={clock} />
          <div className={`rl-status is-${phase}`} role="status">
            {phase === "betting" ? (
              <>
                <b>{secs}s</b> <span>Place your bets</span>
                <i className="rl-timer" style={{ "--p": state ? Math.max(0, (state.closeAt - now) / (state.closeAt - state.startAt)) : 1 } as CSSProperties} />
              </>
            ) : phase === "spinning" ? (
              <span>No more bets!</span>
            ) : state?.number !== null && state ? (
              <span className={`rl-result is-${colorOf(state.number)}`}>
                {state.number} {colorOf(state.number) === "green" ? "Green" : colorOf(state.number) === "red" ? "Red" : "Black"}
              </span>
            ) : (
              <span>…</span>
            )}
          </div>
          <Confetti burst={burst} big={(me?.net ?? 0) > 2000} />
        </div>

        <aside className="rl-side">
          <div className="rl-meta">
            <span>
              <Users size={14} aria-hidden="true" /> {state?.table.length ?? 0} betting
            </span>
            <span>
              <Eye size={14} aria-hidden="true" /> {state?.viewers ?? 0} at the table
            </span>
          </div>
          <div className="rl-history" aria-label="Recent numbers">
            {(state?.history ?? []).slice(0, 14).map((h) => (
              <span key={h.round} className={`rl-pill is-${h.color}`}>
                {h.number}
              </span>
            ))}
          </div>

          {resultVisible && last ? (
            <div className="rl-results">
              <h3>
                <span className={`rl-pill is-${last.color}`}>{last.number}</span> Round results
              </h3>
              {me ? (
                <p className={`rl-you ${me.net > 0 ? "is-up" : "is-down"}`}>
                  {me.net > 0 ? `You won +${me.net.toLocaleString()}` : `You lost ${Math.abs(me.net).toLocaleString()}`} <LeafEmote size={14} />
                </p>
              ) : null}
              {last.players.length ? (
                <ul>
                  {[...winners, ...losers].map((p) => (
                    <li key={p.player.id} className={p.net > 0 ? "is-up" : "is-down"}>
                      <Avatar p={p.player} />
                      <span>{p.player.name}</span>
                      <b>{p.net > 0 ? `+${p.net.toLocaleString()}` : `−${Math.abs(p.net).toLocaleString()}`}</b>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="rl-quiet">Nobody bet on that spin.</p>
              )}
            </div>
          ) : null}

          <div className="rl-players">
            <h3>On the table this round</h3>
            {state?.table.length ? (
              <ul>
                {state.table
                  .slice()
                  .sort((a, b) => b.total - a.total)
                  .map((t) => (
                    <li key={t.player.id} className={`rl-player${t.player.id === myId ? " is-me" : ""}`}>
                      <span className="rl-player-row">
                        <Avatar p={t.player} />
                        <span>{t.player.id === myId ? "You" : t.player.name}</span>
                        <b>
                          {t.total.toLocaleString()} <LeafEmote size={12} />
                        </b>
                      </span>
                      <BetTags bets={t.bets} />
                    </li>
                  ))}
              </ul>
            ) : (
              <p className="rl-quiet">No chips down yet{betting && !watch ? ". Be the first!" : "."}</p>
            )}
          </div>
        </aside>
      </div>

      <Board state={state} onBet={(k) => void bet(k)} disabled={watch || !betting} myId={myId} />

      {error ? (
        <p className="gm-error" role="alert">
          {error}
          <button type="button" onClick={() => setError(null)} aria-label="Dismiss">
            <X size={14} />
          </button>
        </p>
      ) : null}

      {watch ? null : (
        <div className="rl-controls">
          <div className="bj-rack" role="group" aria-label="Chip size">
            {CHIPS.map((c) => (
              <button key={c} type="button" className={`bj-chip is-btn ${CHIP_CLASS[c]}${chip === c ? " is-picked" : ""}`} disabled={c > balance && chip !== c} onClick={() => setChip(c)} aria-pressed={chip === c} aria-label={`${c} chip`}>
                {short(c)}
              </button>
            ))}
          </div>
          <div className="rl-actions">
            <span className="rl-mytotal">
              Your bets: <b>{myTotal.toLocaleString()}</b> <LeafEmote size={14} />
              {pending ? <i> placing…</i> : null}
            </span>
            {rebetFrom && !myTotal ? (
              <button type="button" className="sc-btn" disabled={!betting} onClick={rebet}>
                <RotateCcw size={15} aria-hidden="true" /> Rebet
              </button>
            ) : null}
            <button type="button" className="sc-btn" disabled={!betting || !myTotal} onClick={clear}>
              <Trash2 size={15} aria-hidden="true" /> Clear
            </button>
          </div>
          <p className="bj-hint">
            Pick a chip, then tap the table. One shared wheel spins every 26 seconds for everyone at once. Numbers pay 35:1, dozens and columns 2:1, red/black, odd/even and
            1–18/19–36 pay 1:1. Zero loses every outside bet. Up to 100K a round.
          </p>
        </div>
      )}
    </div>
  );
}
