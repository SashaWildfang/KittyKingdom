"use client";

import { useEffect, useState } from "react";
import type { BadgeEarned } from "../../lib/badge-history";
import type { BadgeShowcase } from "../../lib/badges";
import type { CustomBadge, CustomTitle } from "../../lib/cosmetics";
import { ShowcaseBadges } from "./badge-tip";

/** Fired by the stats page when the showcase is saved, so the profile card updates right away. */
export const BADGES_EVENT = "kk-badges";

/** The profile card's badge title and pinned badges; hover one to see what it is and when it was earned. */
export function ProfileBadges({
  initial,
  earned,
  customTitle,
  customBadges,
}: {
  initial: BadgeShowcase | null;
  earned?: Record<string, BadgeEarned>;
  customTitle?: CustomTitle | null;
  customBadges?: CustomBadge[];
}) {
  const [showcase, setShowcase] = useState<BadgeShowcase | null>(initial);
  useEffect(() => {
    const on = (e: Event) => setShowcase((e as CustomEvent<BadgeShowcase>).detail);
    window.addEventListener(BADGES_EVENT, on);
    return () => window.removeEventListener(BADGES_EVENT, on);
  }, []);
  return <ShowcaseBadges showcase={showcase} earned={earned} customTitle={customTitle} customBadges={customBadges} />;
}
