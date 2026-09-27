"use client";

import { BadgeCheck, Check, Gem, Image as ImageIcon, Mic, Minus, ShieldCheck, Star, type LucideIcon } from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { RoleState } from "../../lib/member-roles";

/** Fired by the Server roles section whenever it loads fresh roles, so the profile card follows along. */
export const ROLE_STATE_EVENT = "kk-role-state";

const POLL_MS = 20_000;
const STATUS_ICONS: Record<string, LucideIcon> = { adult: ShieldCheck, member: BadgeCheck, media: ImageIcon, vc: Mic, nitro: Gem };

function rankStyle(colors: string[]): CSSProperties {
  // One color for normal roles; Discord's gradient roles have two (or three for holographic)
  const stops = colors.length === 1 ? [colors[0], colors[0]] : colors;
  return { "--rank-gradient": `linear-gradient(90deg, ${stops.join(", ")})` } as CSSProperties;
}

/**
 * The profile card's staff line, top role, level and server status list. Updates live: from the
 * Server roles section's refreshes, plus its own check every 20s and when the tab comes back.
 */
export function LiveServerStatus({
  initial,
  discordLinked,
  fallbackRank,
  fallbackStaff,
}: {
  initial: RoleState | null;
  discordLinked: boolean;
  fallbackRank: { name: string; colors: string[] } | null;
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

  const rank = state ? state.rank : fallbackRank;
  const isStaff = state ? state.isStaff : fallbackStaff;

  return (
    <>
      {isStaff ? <p className="acct-staff-line">Staff Member</p> : null}
      {rank ? (
        <div className="acct-rank-row">
          <span className="acct-rank" style={rankStyle(rank.colors)} title="Your highest Discord role">
            <i aria-hidden="true" />
            <span>{rank.name}</span>
          </span>
        </div>
      ) : null}
      {state?.inServer ? (
        <div className="acct-server-status" aria-label="Server status" aria-live="polite">
          {state.level !== null ? (
            <span className="acct-level" title="Your level in the Discord server">
              <Star size={14} aria-hidden="true" /> Level <strong>{state.level}</strong>
            </span>
          ) : null}
          <ul>
            {state.status
              .filter((r) => r.key !== "nitro" || r.has)
              .map((r) => {
                const Icon = STATUS_ICONS[r.key] ?? BadgeCheck;
                return (
                  <li key={r.key} className={r.has ? "is-on" : undefined} title={r.has ? `You have ${r.label}` : `You don't have ${r.label} yet`}>
                    <Icon className="acct-status-icon" size={14} aria-hidden="true" />
                    <span className="acct-status-label">{r.label}</span>
                    <i aria-hidden="true">{r.has ? <Check size={14} strokeWidth={3} /> : <Minus size={14} />}</i>
                  </li>
                );
              })}
          </ul>
        </div>
      ) : (
        <div className="acct-badges">
          <span className={`acct-badge ${discordLinked ? "acct-badge--discord" : "acct-badge--muted"}`}>{discordLinked ? "Discord linked" : "Discord not linked"}</span>
        </div>
      )}
    </>
  );
}
