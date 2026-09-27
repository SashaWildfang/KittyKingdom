"use client";

import { Sparkles } from "lucide-react";
import { useEffect, useState, type CSSProperties } from "react";
import { TIER_NAMES, badgeById, type BadgeShowcase } from "../../lib/badges";
import { BadgeMedal } from "./badge-medal";

/** Fired by the stats page when the showcase is saved, so the profile card updates right away. */
export const BADGES_EVENT = "kk-badges";

/** The profile card's badge title and pinned badges. */
export function ProfileBadges({ initial }: { initial: BadgeShowcase | null }) {
  const [showcase, setShowcase] = useState<BadgeShowcase | null>(initial);
  useEffect(() => {
    const on = (e: Event) => setShowcase((e as CustomEvent<BadgeShowcase>).detail);
    window.addEventListener(BADGES_EVENT, on);
    return () => window.removeEventListener(BADGES_EVENT, on);
  }, []);
  const title = showcase?.title ? badgeById(showcase.title.id) : null;
  const pinned = (showcase?.pinned ?? []).map((p) => ({ def: badgeById(p.id), tier: p.tier })).filter((p) => p.def);
  if (!title && !pinned.length) return null;
  return (
    <div className="acct-badges-showcase">
      {title ? (
        <p className="st-title-pill acct-badge-title" style={{ "--hue": title.hue } as CSSProperties}>
          <Sparkles size={12} aria-hidden="true" /> {title.name}
        </p>
      ) : null}
      {pinned.length ? (
        <div className="acct-pinned-badges">
          {pinned.map(({ def, tier }) => (
            <BadgeMedal key={def!.id} icon={def!.icon} shape={def!.shape} hue={def!.hue} tier={tier} size={40} title={`${def!.name} · ${TIER_NAMES[Math.min(tier, 4) - 1] ?? "Special"}`} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
