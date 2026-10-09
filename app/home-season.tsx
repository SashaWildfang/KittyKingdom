"use client";

// Homepage bits that follow the season (and an admin's season preview).

import { useSeason } from "./season-context";
import { SEASONS, type SeasonKey } from "../lib/seasons";

const COPY: Record<SeasonKey, { subtitle: string; cta: string }> = {
  fall: { subtitle: "A warm, fall-themed community", cta: "Pull up a chair by the fire." },
  winter: { subtitle: "A cozy, snowed-in community", cta: "Come in from the cold." },
  spring: { subtitle: "A bright, blooming community", cta: "Come bloom with us." },
  summer: { subtitle: "A sunny, beachside community", cta: "Grab a towel and join us on the beach." },
};

export function SeasonCopy({ part }: { part: "subtitle" | "cta" }) {
  return <>{COPY[useSeason().key][part]}</>;
}

export function SeasonName() {
  return <>{SEASONS[useSeason().key].name}</>;
}

export function SeasonArt({ kind, className }: { kind: "banner" | "logo"; className?: string }) {
  const s = useSeason();
  // eslint-disable-next-line @next/next/no-img-element
  return <img className={className} src={kind === "banner" ? s.banner : s.logo} alt={kind === "banner" ? `Kitty Kingdom ${s.name.toLowerCase()} banner` : "Kitty Kingdom logo"} />;
}

export function SeasonWord({ one }: { one?: boolean }) {
  const s = useSeason();
  return <>{one ? s.one : s.many}</>;
}
