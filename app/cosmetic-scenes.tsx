"use client";

import { useId, type ReactNode } from "react";
import type { BannerSpec } from "../lib/cosmetics";
import { H, W } from "./scene-kit";
import { Aurora, City, Forest, Mountains, Ocean, Pumpkins, Sakura, Space, type Opts } from "./scenes-a";
import { Candy, Clouds, Desert, Meadow, Retro, Underwater, Village } from "./scenes-b";
import { Highlands, Tropical, Volcano } from "./scenes-c";
import { AutumnPath, BlacksmithForge, LavenderRows, SunflowerField, WisteriaGarden, WitchingHour } from "./scenes-e";

// Illustrated, hand-shaded banner scenes. Each scene takes a palette, so one drawing makes several
// banners. Drawn on a wide 1000×220 canvas and cropped from the bottom-middle, so the focal point shows in
// every placement. Movement uses the .sc-* animation classes in globals.css.

const SCENES: Record<BannerSpec["scene"], (o: Opts) => ReactNode> = {
  pumpkins: (o) => (o.v === "graveyard" ? WitchingHour(o) : Pumpkins(o)),
  mountains: (o) => (o.v === "highlands" ? Highlands(o) : Mountains(o)),
  ocean: (o) => (o.v === "tropical" ? Tropical(o) : Ocean(o)),
  forest: (o) => (o.v === "autumn" ? AutumnPath(o) : Forest(o)),
  city: City,
  space: Space,
  aurora: Aurora,
  sakura: (o) => (o.v === "wisteria" ? WisteriaGarden(o) : Sakura(o)),
  candy: Candy,
  desert: Desert,
  underwater: Underwater,
  retro: Retro,
  clouds: Clouds,
  meadow: (o) => (o.v === "lavender" ? LavenderRows(o) : o.v === "sunflower" ? SunflowerField(o) : Meadow(o)),
  village: Village,
  lava: (o) => (o.v === "emberforge" ? BlacksmithForge(o) : Volcano(o)),
};

/** A banner scene filling its box. */
export function BannerScene({ spec, className }: { spec: BannerSpec; className?: string }) {
  const raw = useId();
  const id = `s${raw.replace(/[^a-zA-Z0-9]/g, "")}`;
  const Scene = SCENES[spec.scene];
  return (
    <svg className={`sc${className ? ` ${className}` : ""}`} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false">
      {Scene({ ...spec, id })}
    </svg>
  );
}
