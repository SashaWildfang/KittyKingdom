"use client";

import { Gift } from "lucide-react";
import { useEffect, useState } from "react";

/** Fired by the Daily Reward card after a claim, so every "ready to claim" reminder clears at once. */
export const DAILY_CLAIMED_EVENT = "kk-daily-claimed";

function useReady(initial: boolean) {
  const [ready, setReady] = useState(initial);
  useEffect(() => {
    const done = () => setReady(false);
    window.addEventListener(DAILY_CLAIMED_EVENT, done);
    return () => window.removeEventListener(DAILY_CLAIMED_EVENT, done);
  }, []);
  return ready;
}

/** A dot on the sidebar's Daily Reward link while today's reward is waiting. */
export function DailyReadyDot({ ready }: { ready: boolean }) {
  return useReady(ready) ? <span className="acct-nav-dot acct-nav-dot--gift" title="Your daily reward is ready" /> : null;
}

/** "Daily reward ready" on the profile card, linking to the card. */
export function DailyReadyChip({ ready }: { ready: boolean }) {
  return useReady(ready) ? (
    <a className="acct-daily-chip" href="#daily">
      <Gift size={14} aria-hidden="true" /> Daily reward ready to claim
    </a>
  ) : null;
}
