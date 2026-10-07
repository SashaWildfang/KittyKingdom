import { Building2, Home } from "lucide-react";

// A small static map (OpenStreetMap tiles, zoom 15) showing home and the Consumer Direct office.
// Positions are precomputed percentages of a 640×560 view centred between the two points.
const TILES: [number, number, number, number][] = [
  [6003, 11536, -4.28, -4.416], [6003, 11537, -4.28, 41.298], [6003, 11538, -4.28, 87.013],
  [6004, 11536, 35.72, -4.416], [6004, 11537, 35.72, 41.298], [6004, 11538, 35.72, 87.013],
  [6005, 11536, 75.72, -4.416], [6005, 11537, 75.72, 41.298], [6005, 11538, 75.72, 87.013],
];
const HOME = { x: 40.97, y: 15.59 };
const OFFICE = { x: 59.03, y: 84.41 };

export function CommuteMap({ homeLabel, officeLabel }: { homeLabel: string; officeLabel: string }) {
  return (
    <figure className="cm">
      <div className="cm-map" role="img" aria-label={`Map: ${homeLabel} is about 0.8 miles from ${officeLabel}`}>
        {TILES.map(([x, y, left, top]) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={`${x}-${y}`}
            src={`https://tile.openstreetmap.org/15/${x}/${y}.png`}
            alt=""
            className="cm-tile"
            style={{ left: `${left}%`, top: `${top}%` }}
            loading="lazy"
          />
        ))}
        <svg className="cm-route" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <line x1={HOME.x} y1={HOME.y} x2={OFFICE.x} y2={OFFICE.y} />
        </svg>
        <span className="cm-pin is-home" style={{ left: `${HOME.x}%`, top: `${HOME.y}%` }}>
          <Home size={16} aria-hidden="true" />
        </span>
        <span className="cm-label is-home" style={{ left: `${HOME.x}%`, top: `${HOME.y}%` }}>
          {homeLabel}
        </span>
        <span className="cm-pin is-office" style={{ left: `${OFFICE.x}%`, top: `${OFFICE.y}%` }}>
          <Building2 size={16} aria-hidden="true" />
        </span>
        <span className="cm-label is-office" style={{ left: `${OFFICE.x}%`, top: `${OFFICE.y}%` }}>
          {officeLabel}
        </span>
        <span className="cm-badge">≈ 5 min drive</span>
      </div>
      <figcaption>
        Map data ©{" "}
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">
          OpenStreetMap contributors
        </a>
      </figcaption>
    </figure>
  );
}
