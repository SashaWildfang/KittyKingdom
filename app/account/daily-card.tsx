"use client";

import { Check, Clock, ExternalLink, Flame, Gem, Gift, Lock } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { DailyStatus } from "../../lib/daily";
import { LeafEmote } from "../ui-icons";

function countdown(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${h}:${pad(m)}:${pad(s)}`;
}

function roughly(ms: number) {
  const mins = Math.max(1, Math.round(ms / 60_000));
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  return mins % 60 ? `${h}h ${mins % 60}m` : `${h}h`;
}

const localTime = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

/** Daily leaves on My Account: claim, live cooldown, streak track and the Nitro streak bonus. */
export function DailyCard({ initial, guildId }: { initial: DailyStatus | null; guildId: string | null }) {
  const [status, setStatus] = useState<DailyStatus | null>(initial);
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; tone: "ok" | "error" } | null>(initial ? null : { text: "Couldn't load your daily reward right now.", tone: "error" });
  const [popped, setPopped] = useState<number | null>(null);
  const refreshing = useRef(false);

  const refresh = useCallback(async () => {
    if (refreshing.current) return;
    refreshing.current = true;
    try {
      const res = await fetch("/api/account/daily", { cache: "no-store" });
      const body = await res.json();
      if (res.ok && body.ok) setStatus(body.status);
    } catch {
      // keep showing the last known state
    } finally {
      refreshing.current = false;
    }
  }, []);

  // Tick every second for the countdown; re-check the server every minute (claims made in Discord show up too)
  useEffect(() => {
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    const poll = window.setInterval(() => void refresh(), 60_000);
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(tick);
      window.clearInterval(poll);
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh]);

  const nextClaimMs = status ? new Date(status.nextClaimAt).getTime() - now : 0;
  const claimable = Boolean(status && (!status.claimedToday || nextClaimMs <= 0));

  // When the cooldown runs out, fetch the new state (streak, next reward)
  useEffect(() => {
    if (status?.claimedToday && nextClaimMs <= 0) void refresh();
  }, [status?.claimedToday, nextClaimMs <= 0, refresh]); // eslint-disable-line react-hooks/exhaustive-deps

  async function claim() {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/account/daily", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const body = await res.json().catch(() => ({ ok: false, error: "That didn't work. Try again." }));
      if (!res.ok || !body.ok) {
        setMessage({ text: body.error ?? "That didn't work. Try again.", tone: "error" });
        void refresh();
      } else {
        setStatus(body.status);
        setMessage({ text: body.message, tone: "ok" });
        setPopped(body.reward);
        window.setTimeout(() => setPopped(null), 1800);
      }
    } finally {
      setBusy(false);
    }
  }

  if (!status) return message ? <p className="roles-muted">{message.text}</p> : null;

  const streakEndsMs = status.streakEndsAt ? new Date(status.streakEndsAt).getTime() - now : null;
  const atRisk = !status.claimedToday && status.streak > 0 && streakEndsMs !== null && streakEndsMs > 0;
  const bonus = status.nextReward - status.base;
  const nitroLink = guildId ? `https://discord.com/channels/${guildId}/${status.infoChannelId}` : null;

  return (
    <div className={`daily${status.nitro ? " daily--nitro" : ""}`}>
      <div className="daily-main">
        <div className="daily-reward">
          <span className="daily-label">{claimable ? "Today's reward" : "Next reward"}</span>
          <strong>
            <LeafEmote size={26} /> {status.nextReward.toLocaleString()}
          </strong>
          <small>
            {bonus > 0 ? (
              `${status.base} + ${bonus} day ${status.nextCycleDay} streak bonus`
            ) : (
              <>
                {status.base} <LeafEmote size={14} /> every day
              </>
            )}
          </small>
          {popped ? (
            <span className="daily-pop" aria-hidden="true">
              +{popped.toLocaleString()} <LeafEmote size={20} />
            </span>
          ) : null}
        </div>

        {claimable ? (
          <button type="button" className="daily-claim" onClick={() => void claim()} disabled={busy} aria-label={`Claim ${status.nextReward} leaves`}>
            <Gift size={18} aria-hidden="true" />
            {busy ? (
              "Claiming…"
            ) : (
              <>
                Claim {status.nextReward.toLocaleString()} <LeafEmote size={22} />
              </>
            )}
          </button>
        ) : (
          <div className="daily-timer" role="timer" aria-live="off">
            <span className="daily-label">
              <Check size={14} aria-hidden="true" /> Claimed today · next claim in
            </span>
            <strong>{countdown(nextClaimMs)}</strong>
            <small>Resets at midnight UTC ({localTime(status.nextClaimAt)} your time)</small>
          </div>
        )}
      </div>

      <div className={`daily-streak${atRisk ? " is-risk" : ""}`}>
        <span className="daily-flame" aria-hidden="true">
          <Flame size={20} />
        </span>
        <div>
          <strong>
            {status.streak ? `${status.streak}-day streak` : "No streak yet"}
          </strong>
          <small>
            {atRisk && streakEndsMs !== null
              ? `Claim within ${roughly(streakEndsMs)} to keep it going!`
              : status.claimedToday
                ? "Come back tomorrow to keep it going."
                : status.streak
                  ? "Claim today to keep it going."
                  : "Claim today to start one. Missing a day resets it."}
          </small>
        </div>
      </div>

      <ol className="daily-week" aria-label="7-day streak bonus">
        {Array.from({ length: 7 }, (_, i) => {
          const day = i + 1;
          const done = day <= status.cycleDone;
          const next = !done && day === status.nextCycleDay;
          return (
            <li key={day} className={`${done ? "is-done" : ""}${next ? " is-next" : ""}${status.nitro ? "" : " is-locked"}`}>
              <span className="daily-day">Day {day}</span>
              <span className="daily-dot" aria-hidden="true">
                {done ? <Check size={14} /> : status.nitro ? <LeafEmote size={14} /> : <Lock size={12} />}
              </span>
              <span className="daily-bonus">+{status.step * day}</span>
            </li>
          );
        })}
      </ol>

      {status.nitro ? (
        <p className="daily-nitro-on">
          <Gem size={15} aria-hidden="true" /> Nitro booster: your streak bonus is active. Thanks for boosting!
        </p>
      ) : (
        <div className="daily-nitro">
          <span className="daily-nitro-icon" aria-hidden="true">
            <Gem size={20} />
          </span>
          <div>
            <strong>Unlock streak bonuses with Nitro</strong>
            <p>
              Boost Kitty Kingdom with Discord Nitro to get the <b>🍂 Golden Leaf (Nitro)</b> role. Boosters earn a streak bonus on top of the daily {status.base}: +{status.step} on
              day 1, up to +{status.step * 7} on day 7, then the week starts again. That&apos;s up to <b>{(status.base * 7 + status.step * 28).toLocaleString()}</b> leaves a
              week instead of {(status.base * 7).toLocaleString()}.
            </p>
            <p className="daily-nitro-next">
              Your next claim would pay <b>{status.nextRewardWithNitro.toLocaleString()}</b> instead of {status.nextReward.toLocaleString()}.
            </p>
            {nitroLink ? (
              <a className="daily-nitro-link" href={nitroLink} target="_blank" rel="noreferrer">
                See all perks in #✨nitro-perks <ExternalLink size={13} aria-hidden="true" />
              </a>
            ) : null}
          </div>
        </div>
      )}

      {message ? (
        <p className={message.tone === "ok" ? "daily-msg is-ok" : "daily-msg is-error"} role="status">
          {message.tone === "ok" ? <Check size={14} aria-hidden="true" /> : null} {message.text}
        </p>
      ) : null}
    </div>
  );
}
