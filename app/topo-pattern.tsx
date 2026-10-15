// The site background: faint topographic contour lines (a seamless tile, public/topo.svg, made by
// scripts/make-topo.py: python3 scripts/make-topo.py public/topo.svg) used as a mask, so the lines take the theme's colors (bear pride flag by default,
// the season's otherwise; light and dark). Every fourth line is a little stronger, like a trail map's index lines.

import "./topo-pattern.css";

export function TopoPattern() {
  return (
    <div className="tp-wrap" aria-hidden="true">
      <div className="tp" />
    </div>
  );
}
