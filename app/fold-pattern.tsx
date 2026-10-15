// The site background: a seamless folded-tile pattern (columns in two shades with a folded shadow at the top of each
// row). Drawn as an inline SVG pattern so its colors follow the theme (bear pride flag by default, the season's own
// colors otherwise; light and dark). Styles: app/fold-pattern.css.

import "./fold-pattern.css";

const TILE_W = 180; // two columns
const TILE_H = 90;

export function FoldPattern() {
  return (
    <svg className="fp" aria-hidden="true" width="100%" height="100%">
      <defs>
        <linearGradient id="fp-fold-l" x1="0" y1="0" x2="0.2" y2="1">
          <stop offset="0" className="fp-shade-on" />
          <stop offset="1" className="fp-shade-off" />
        </linearGradient>
        <linearGradient id="fp-fold-r" x1="1" y1="0" x2="0.8" y2="1">
          <stop offset="0" className="fp-shade-on" />
          <stop offset="1" className="fp-shade-off" />
        </linearGradient>
        <pattern id="fp-tile" width={TILE_W} height={TILE_H} patternUnits="userSpaceOnUse">
          <rect className="fp-a" width="90" height={TILE_H} />
          <rect className="fp-b" x="90" width="90" height={TILE_H} />
          {/* The fold: each column's shadow slopes the other way, so the rows read as a zig-zag crease */}
          <path d="M0 0H90L0 30Z" fill="url(#fp-fold-l)" />
          <path d="M90 0H180V30Z" fill="url(#fp-fold-r)" />
          <path className="fp-edge" d="M0 0.5H180" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#fp-tile)" />
    </svg>
  );
}
