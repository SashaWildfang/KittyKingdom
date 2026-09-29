"use client";

import { Sparkles } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import type { BadgeEarned } from "../../lib/badge-history";
import { TIER_NAMES, badgeAbout, badgeById, type BadgeShowcase } from "../../lib/badges";
import { BadgeMedal } from "./badge-medal";

const dateFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });

export function tierLabel(tiers: number[], tier: number) {
  if (!tier) return "Locked";
  return tiers.length === 1 ? "Special" : TIER_NAMES[Math.min(tier, 4) - 1];
}

/** "today", "yesterday" or "on Sep 29, 2026" (in the viewer's own calendar). */
function onDay(iso: string) {
  const day = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diff = Math.round((day(new Date()) - day(new Date(iso))) / 86_400_000);
  return diff === 0 ? "today" : diff === 1 ? "yesterday" : `on ${dateFmt.format(new Date(iso))}`;
}

/** "Earned today", "Reached Gold yesterday", "Earned on Sep 29, 2026". */
export function earnedText(earned: BadgeEarned | null | undefined, tiers: number[]) {
  if (!earned) return null;
  const when = onDay(earned.at);
  return tiers.length > 1 && earned.tier > 1 ? `Reached ${TIER_NAMES[Math.min(earned.tier, 4) - 1]} ${when}` : `Earned ${when}`;
}

/** Hover (or focus) a badge to see what it is, its tier and when it was earned. */
export function BadgeTip({ id, tier, earned, children, className }: { id: string; tier: number; earned?: BadgeEarned | null; children: ReactNode; className?: string }) {
  const def = badgeById(id);
  if (!def) return <>{children}</>;
  const when = earnedText(earned, def.tiers);
  const about = badgeAbout(id);
  return (
    <span className={`badge-tip-wrap ${className ?? ""}`} tabIndex={0} aria-label={`${def.name}, ${tierLabel(def.tiers, tier)}. ${about}${when ? ` ${when}.` : ""}`}>
      {children}
      <span className="badge-tip" role="tooltip" style={{ "--hue": def.hue } as CSSProperties}>
        <b>{def.name}</b>
        <span className={`badge-tip-tier badge-tip-tier--${def.tiers.length === 1 ? "special" : tier}`}>{tierLabel(def.tiers, tier)}</span>
        <span className="badge-tip-desc">{about}</span>
        {when ? <span className="badge-tip-when">{when}</span> : null}
      </span>
    </span>
  );
}

/** A member's badge title and pinned badges (profile card, Social profiles), each with its tooltip. */
export function ShowcaseBadges({ showcase, earned, size = 40, className }: { showcase: BadgeShowcase | null; earned?: Record<string, BadgeEarned>; size?: number; className?: string }) {
  const title = showcase?.title ? badgeById(showcase.title.id) : null;
  const pinned = (showcase?.pinned ?? []).map((p) => ({ def: badgeById(p.id), tier: p.tier })).filter((p) => p.def);
  if (!title && !pinned.length) return null;
  return (
    <div className={`acct-badges-showcase ${className ?? ""}`}>
      {title && showcase?.title ? (
        <BadgeTip id={title.id} tier={showcase.title.tier} earned={earned?.[title.id]}>
          <span className="st-title-pill acct-badge-title" style={{ "--hue": title.hue } as CSSProperties}>
            <Sparkles size={12} aria-hidden="true" /> {title.name}
          </span>
        </BadgeTip>
      ) : null}
      {pinned.length ? (
        <div className="acct-pinned-badges">
          {pinned.map(({ def, tier }) => (
            <BadgeTip key={def!.id} id={def!.id} tier={tier} earned={earned?.[def!.id]}>
              <BadgeMedal icon={def!.icon} shape={def!.shape} hue={def!.hue} tier={tier} size={size} />
            </BadgeTip>
          ))}
        </div>
      ) : null}
    </div>
  );
}
