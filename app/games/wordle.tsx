"use client";

import { Copy, Delete, Flag, Sparkles, Star, Timer } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Mark, WordleState } from "../../lib/games/wordle";
import { askConfirm } from "../confirm-dialog";
import { useCurrency } from "../season-context";
import { LeafEmote } from "../ui-icons";
import { Confetti } from "./games-client";
import "./wordle.css";

const ROWS = 6;
const LEN = 5;
const KEYS = ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"];
const RANK: Record<Mark, number> = { absent: 1, present: 2, correct: 3 };
const EMOJI: Record<Mark, string> = { correct: "🟩", present: "🟨", absent: "⬛" };

function useCountdown(at: number | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!at) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [at]);
  if (!at) return null;
  const s = Math.max(0, Math.floor((at - now) / 1000));
  return `${Math.floor(s / 3600)}h ${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}m ${String(s % 60).padStart(2, "0")}s`;
}

/**
 * The daily Wordle: the same game as /wordle in Discord (one every 24 hours, shared between both).
 * `active` turns the physical keyboard on (only for the one that's on screen). `compact` is the smaller
 * version on My Account, where typing only goes to the board after you click or tap on it.
 */
export function Wordle({ initial, active = true, compact = false, onBalance }: { initial: WordleState | null; active?: boolean; compact?: boolean; onBalance?: (n: number) => void }) {
  const cur = useCurrency();
  const [state, setState] = useState<WordleState | null>(initial);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const [flipRow, setFlipRow] = useState<number | null>(null);
  const [burst, setBurst] = useState(0);
  const [copied, setCopied] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const engaged = useRef(!compact);
  const countdown = useCountdown(state && (state.status === "won" || state.status === "lost") ? state.nextAt : null);

  useEffect(() => {
    if (initial) return;
    fetch("/api/games/wordle", { cache: "no-store" })
      .then((r) => r.json())
      .then((r) => r?.ok && setState(r.wordle))
      .catch(() => undefined);
  }, [initial]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  const rows = state?.rows ?? [];
  const playing = !state || state.status === "ready" || state.status === "playing";
  const fail = (msg: string) => {
    setToast(msg);
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };

  const submit = useCallback(async () => {
    if (busy || !playing) return;
    if (typed.length < LEN) return fail("Not enough letters");
    setBusy(true);
    const res = await fetch("/api/games/wordle", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "guess", word: typed }) })
      .then((r) => r.json())
      .catch(() => ({ ok: false, error: "Something went wrong. Try again." }));
    setBusy(false);
    if (!res.ok) return fail(res.error ?? "That didn't work.");
    const next = res.wordle as WordleState;
    setFlipRow(next.rows.length - 1);
    setState(next);
    setTyped("");
    if (typeof res.balance === "number") onBalance?.(res.balance);
    // Let the tiles flip before the result shows
    setTimeout(() => {
      setFlipRow(null);
      if (next.status === "won") {
        setBurst(Date.now());
        setToast(["Genius!", "Magnificent!", "Impressive!", "Splendid!", "Great!", "Phew!"][next.rows.length - 1] ?? "Solved!");
      }
    }, 1700);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busy, playing, typed, onBalance]);

  const press = useCallback(
    (key: string) => {
      if (!playing || busy) return;
      if (key === "ENTER") return void submit();
      if (key === "BACK") return setTyped((t) => t.slice(0, -1));
      if (/^[A-Z]$/.test(key)) setTyped((t) => (t.length < LEN ? t + key : t));
    },
    [playing, busy, submit],
  );

  // Physical keyboard, only for the board on screen and never while typing in a field
  useEffect(() => {
    if (!active) return;
    // On My Account the board only takes typing once you've clicked on it (and stops when you click elsewhere)
    const onPointer = (e: PointerEvent) => {
      if (compact) engaged.current = Boolean(root.current?.contains(e.target as Node));
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || !engaged.current) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      if (e.key === "Enter") press("ENTER");
      else if (e.key === "Backspace") press("BACK");
      else if (/^[a-z]$/i.test(e.key)) press(e.key.toUpperCase());
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [active, press, compact]);

  // The keyboard remembers the best colour each letter has had
  const letters = new Map<string, Mark>();
  rows.forEach((r, ri) => {
    if (ri === flipRow) return;
    r.word.split("").forEach((ch, i) => {
      const m = r.marks[i];
      if (!letters.has(ch) || RANK[m] > RANK[letters.get(ch)!]) letters.set(ch, m);
    });
  });

  const giveUp = async () => {
    if (!(await askConfirm("Give up today's Wordle? It counts as a loss and the next one opens in 24 hours.", { danger: true, confirmLabel: "Give up" }))) return;
    const res = await fetch("/api/games/wordle", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "giveup" }) })
      .then((r) => r.json())
      .catch(() => null);
    if (res?.ok) setState(res.wordle);
    else fail(res?.error ?? "That didn't work.");
  };

  const share = async () => {
    const grid = rows.map((r) => r.marks.map((m) => EMOJI[m]).join("")).join("\n");
    const text = `Bear Nation Wordle ${state?.status === "won" ? rows.length : "X"}/${ROWS}\n\n${grid}`;
    await navigator.clipboard?.writeText(text).catch(() => undefined);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const over = state?.status === "won" || state?.status === "lost";
  return (
    <div className={`wd${compact ? " is-compact" : ""}`} ref={root}>
      {!compact ? (
        <header className="wd-head">
          <div>
            <h2>
              <Sparkles size={18} aria-hidden="true" /> Daily Wordle
            </h2>
            <p>Guess the 5-letter word in 6 tries. One word every 24 hours, shared with /wordle in Discord.</p>
          </div>
          {state ? (
            <span className="wd-reward">
              Solve it for <b>+{state.reward.leaves.toLocaleString()}</b> <LeafEmote size={15} /> and <b>+{state.reward.xp.toLocaleString()}</b> <Star size={13} aria-hidden="true" /> XP
            </span>
          ) : null}
        </header>
      ) : null}

      <div className="wd-play">
        <div className={`wd-board${shake ? " is-shake" : ""}`} role="grid" aria-label="Wordle board">
          {Array.from({ length: ROWS }, (_, r) => {
            const row = rows[r];
            const isTyping = !row && r === rows.length && playing;
            return (
              <div key={r} role="row" className={`wd-row${isTyping && shake ? " is-shake" : ""}${state?.status === "won" && r === rows.length - 1 && flipRow === null ? " is-win" : ""}`}>
                {Array.from({ length: LEN }, (_, i) => {
                  const ch = row ? row.word[i] : isTyping ? typed[i] ?? "" : "";
                  const mark = row?.marks[i];
                  return (
                    <span
                      key={i}
                      role="gridcell"
                      className={`wd-tile${mark ? ` is-${mark}` : ch ? " is-filled" : ""}${r === flipRow ? " is-flip" : ""}`}
                      style={{ "--d": `${i * 300}ms`, "--w": `${i * 90}ms` } as React.CSSProperties}
                      aria-label={ch ? `${ch}${mark ? `, ${mark}` : ""}` : "empty"}
                    >
                      {ch}
                    </span>
                  );
                })}
              </div>
            );
          })}
          {toast ? (
            <p className="wd-toast" role="status">
              {toast}
            </p>
          ) : null}
          <Confetti burst={burst} />
        </div>

        {over ? (
          <div className={`wd-result is-${state!.status}`}>
            {state!.status === "won" ? (
              <>
                <strong>Solved in {rows.length}!</strong>
                <span>
                  +{state!.reward.leaves.toLocaleString()} <LeafEmote size={14} /> {cur.lower} and +{state!.reward.xp.toLocaleString()} XP
                </span>
              </>
            ) : (
              <>
                <strong>The word was {state!.answer}</strong>
                <span>Better luck tomorrow!</span>
              </>
            )}
            {countdown ? (
              <span className="wd-next">
                <Timer size={14} aria-hidden="true" /> Next word in {countdown}
              </span>
            ) : null}
            <button type="button" className="wd-btn" onClick={() => void share()}>
              <Copy size={14} aria-hidden="true" /> {copied ? "Copied!" : "Copy result"}
            </button>
          </div>
        ) : (
          <div className="wd-keys" aria-label="Keyboard">
            {KEYS.map((line, li) => (
              <div key={line} className="wd-keyrow">
                {li === 2 ? (
                  <button type="button" className="wd-key is-wide" onClick={() => press("ENTER")} disabled={busy}>
                    Enter
                  </button>
                ) : null}
                {line.split("").map((k) => (
                  <button key={k} type="button" className={`wd-key${letters.get(k) ? ` is-${letters.get(k)}` : ""}`} onClick={() => press(k)} disabled={busy}>
                    {k}
                  </button>
                ))}
                {li === 2 ? (
                  <button type="button" className="wd-key is-wide" onClick={() => press("BACK")} aria-label="Delete letter" disabled={busy}>
                    <Delete size={18} aria-hidden="true" />
                  </button>
                ) : null}
              </div>
            ))}
            {state?.status === "playing" && rows.length ? (
              <button type="button" className="wd-giveup" onClick={() => void giveUp()}>
                <Flag size={13} aria-hidden="true" /> Give up
              </button>
            ) : null}
          </div>
        )}
      </div>
      {state?.status === "playing" && state.fromDiscord ? <p className="wd-note">You started this word in Discord. Guesses here and in Discord count toward the same game.</p> : null}
    </div>
  );
}
