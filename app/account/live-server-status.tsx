"use client";

import { Check, Minus, ShieldCheck, UserStar } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { RoleState } from "../../lib/member-roles";

/** Fired by the Server roles section whenever it loads fresh roles, so the profile card follows along. */
export const ROLE_STATE_EVENT = "kk-role-state";

const POLL_MS = 20_000;

/**
 * The profile card's staff and 18+ verified chips (level and XP live on the stats page). Updates live: from the
 * Server roles section's refreshes, plus its own check every 20s and when the tab comes back.
 */
export function LiveServerStatus({
  initial,
  discordLinked,
  fallbackStaff,
}: {
  initial: RoleState | null;
  discordLinked: boolean;
  fallbackStaff: boolean;
}) {
  const [state, setState] = useState<RoleState | null>(initial);
  const lastUpdate = useRef(Date.now());

  useEffect(() => {
    if (!discordLinked) return;
    const onState = (e: Event) => {
      const next = (e as CustomEvent<RoleState>).detail;
      if (next) {
        lastUpdate.current = Date.now();
        setState(next);
      }
    };
    const refresh = async () => {
      try {
        const res = await fetch("/api/account/roles", { cache: "no-store" });
        const body = await res.json();
        if (res.ok && body.ok) {
          lastUpdate.current = Date.now();
          setState(body.state);
        }
      } catch {
        // keep the last known roles
      }
    };
    const timer = window.setInterval(() => {
      // The roles section usually does this already; only fetch if nothing arrived recently
      if (document.visibilityState === "visible" && Date.now() - lastUpdate.current > POLL_MS - 1000) void refresh();
    }, POLL_MS);
    const onVisible = () => document.visibilityState === "visible" && void refresh();
    window.addEventListener(ROLE_STATE_EVENT, onState);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener(ROLE_STATE_EVENT, onState);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [discordLinked]);

  const isStaff = state ? state.isStaff : fallbackStaff;
  // Only what matters on the card: staff, and whether they're 18+ verified
  const adult = state?.status.find((r) => r.key === "adult");

  if (!state?.inServer)
    return (
      <div className="acct-badges">
        {isStaff ? <span className="acct-chip acct-chip--staff"><UserStar size={13} aria-hidden="true" /> Staff Member</span> : null}
        <span className={`acct-badge ${discordLinked ? "acct-badge--discord" : "acct-badge--muted"}`}>{discordLinked ? "Discord linked" : "Discord not linked"}</span>
      </div>
    );
  return (
    <div className="acct-server-status" aria-label="Server status" aria-live="polite">
      <ul>
        {isStaff ? (
          <li className="acct-chip acct-chip--staff">
            <UserStar size={13} aria-hidden="true" /> Staff Member
          </li>
        ) : null}
        {adult ? (
          <li className={`acct-chip${adult.has ? " is-on" : ""}`} title={adult.has ? "You're 18+ verified" : "You're not 18+ verified yet"}>
            <ShieldCheck size={13} aria-hidden="true" /> 18+ Verified {adult.has ? <Check size={13} strokeWidth={3} aria-hidden="true" /> : <Minus size={13} aria-hidden="true" />}
          </li>
        ) : null}
      </ul>
    </div>
  );
}
