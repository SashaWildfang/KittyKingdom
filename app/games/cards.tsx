// Card faces drawn as SVG: corner indices, the classic pip layouts for 2–10, a big ace and
// double-headed court figures for J, Q and K (in the traditional red, blue and gold).

import type { ReactNode } from "react";
import type { Card } from "../../lib/games/blackjack";

const W = 92;
const H = 130;
const INK = "#1a1a24";
const RED = "#c8202e";
const BLUE = "#2b4a9b";
const GOLD = "#e8b923";
const SKIN = "#f7dcc0";

/** Suit shapes in a 100×100 box. */
function SuitShape({ suit, fill }: { suit: Card["suit"]; fill: string }) {
  if (suit === "H") return <path fill={fill} d="M50 90C22 66 4 48 6 29 8 12 26 4 39 11 45 14 48 19 50 24 52 19 55 14 61 11 74 4 92 12 94 29 96 48 78 66 50 90Z" />;
  if (suit === "D") return <path fill={fill} d="M50 3Q68 30 86 50 68 70 50 97 32 70 14 50 32 30 50 3Z" />;
  if (suit === "S")
    return <path fill={fill} d="M50 4C38 22 8 38 8 60 8 76 22 84 34 80 40 78 44 74 47 69 46 80 41 90 31 96H69C59 90 54 80 53 69 56 74 60 78 66 80 78 84 92 76 92 60 92 38 62 22 50 4Z" />;
  return (
    <g fill={fill}>
      <circle cx="50" cy="27" r="19" />
      <circle cx="27" cy="58" r="19" />
      <circle cx="73" cy="58" r="19" />
      <circle cx="50" cy="52" r="10" />
      <path d="M46 56C46 78 40 89 30 96H70C60 89 54 78 54 56Z" />
    </g>
  );
}

/** A pip centred on (x, y), `size` wide; pips in the lower half are drawn upside down like a real card. */
function Pip({ suit, x, y, size, fill, flip }: { suit: Card["suit"]; x: number; y: number; size: number; fill: string; flip?: boolean }) {
  const s = size / 100;
  return (
    <g transform={`translate(${x} ${y}) rotate(${flip ? 180 : 0}) scale(${s}) translate(-50 -50)`}>
      <SuitShape suit={suit} fill={fill} />
    </g>
  );
}

// Columns and rows for the pips (the standard layouts)
const L = 30;
const C = 46;
const R = 62;
const T = 24;
const B = 106;
const M = (T + B) / 2;
const q = (a: number, b: number, f: number) => a + (b - a) * f;

const LAYOUTS: Record<string, [number, number][]> = {
  "2": [[C, T], [C, B]],
  "3": [[C, T], [C, M], [C, B]],
  "4": [[L, T], [R, T], [L, B], [R, B]],
  "5": [[L, T], [R, T], [C, M], [L, B], [R, B]],
  "6": [[L, T], [R, T], [L, M], [R, M], [L, B], [R, B]],
  "7": [[L, T], [R, T], [C, q(T, M, 0.5)], [L, M], [R, M], [L, B], [R, B]],
  "8": [[L, T], [R, T], [C, q(T, M, 0.5)], [L, M], [R, M], [C, q(M, B, 0.5)], [L, B], [R, B]],
  "9": [[L, T], [R, T], [L, q(T, B, 1 / 3)], [R, q(T, B, 1 / 3)], [C, M], [L, q(T, B, 2 / 3)], [R, q(T, B, 2 / 3)], [L, B], [R, B]],
  "10": [[L, T], [R, T], [C, q(T, B, 1 / 6)], [L, q(T, B, 1 / 3)], [R, q(T, B, 1 / 3)], [L, q(T, B, 2 / 3)], [R, q(T, B, 2 / 3)], [C, q(T, B, 5 / 6)], [L, B], [R, B]],
};

function Corner({ card, color, flip }: { card: Card; color: string; flip?: boolean }) {
  const ten = card.rank === "10";
  return (
    <g transform={flip ? `rotate(180 ${W / 2} ${H / 2})` : undefined}>
      <text x="10.5" y="19" textAnchor="middle" fill={color} fontFamily="Georgia, 'Times New Roman', serif" fontWeight="900" fontSize={ten ? 14 : 16} letterSpacing={ten ? -1.5 : 0}>
        {card.rank}
      </text>
      <Pip suit={card.suit} x={10.5} y={28} size={10} fill={color} />
    </g>
  );
}

// ---------- court cards ----------

/** The top half of a court figure, in a 56×46 box; the card shows it twice, the second turned upside down. */
function CourtHalf({ rank, suit, red }: { rank: "J" | "Q" | "K"; suit: Card["suit"]; red: boolean }) {
  const robe = red ? RED : BLUE;
  const trim = red ? BLUE : RED;
  const hair = rank === "J" ? "#8a5a2b" : GOLD;
  const body: ReactNode[] = [];
  const parts: ReactNode[] = [];

  // Robe and shoulders
  body.push(<path key="robe" d="M2 46V36C2 30 8 26 16 25L28 30 40 25C48 26 54 30 54 36V46Z" fill={robe} stroke={INK} strokeWidth="0.8" />);
  // Robe panels and pattern
  body.push(<path key="panel" d="M20 46V30L28 34 36 30V46Z" fill={GOLD} stroke={INK} strokeWidth="0.6" />);
  for (let i = 0; i < 3; i++) body.push(<path key={`dot${i}`} d={`M28 ${36 + i * 3.6}l1.6 1.6-1.6 1.6-1.6-1.6Z`} fill={trim} />);
  body.push(<path key="lpat" d="M6 38h10M6 42h10M40 38h10M40 42h10" stroke={GOLD} strokeWidth="1.2" />);
  // Collar
  body.push(<path key="collar" d="M15 25.5C20 30 36 30 41 25.5L38 23H18Z" fill="#fff" stroke={INK} strokeWidth="0.6" />);
  body.push(<path key="collar2" d="M18 25l2 2.4 2-2.4 2 2.6 2-2.6 2 2.6 2-2.6 2 2.6 2-2.6 2 2.4 2-2.4" fill="none" stroke={trim} strokeWidth="0.7" />);

  // Hair behind the face
  if (rank === "Q") parts.push(<path key="hair" d="M18 11C17 4 39 4 38 11L40 24H16Z" fill={hair} stroke={INK} strokeWidth="0.6" />);
  else parts.push(<path key="hair" d="M19 10C19 5 37 5 37 10L38 18H18Z" fill={hair} stroke={INK} strokeWidth="0.6" />);
  // Face
  parts.push(<ellipse key="face" cx="28" cy="14" rx="7.2" ry="8.4" fill={SKIN} stroke={INK} strokeWidth="0.7" />);
  parts.push(<path key="eyes" d="M24.6 13.2h2M29.4 13.2h2" stroke={INK} strokeWidth="0.9" strokeLinecap="round" />);
  parts.push(<path key="nose" d="M28 14v3.2h1" fill="none" stroke={INK} strokeWidth="0.5" />);
  if (rank === "K") {
    // Beard and moustache
    parts.push(<path key="beard" d="M21.4 15.5C22 23 26 25.5 28 25.5S34 23 34.6 15.5C33 18.6 31 19.2 28 19.2S23 18.6 21.4 15.5Z" fill={GOLD} stroke={INK} strokeWidth="0.6" />);
    parts.push(<path key="mou" d="M25 18.6C26.5 17.6 29.5 17.6 31 18.6" fill="none" stroke={INK} strokeWidth="0.7" />);
  } else {
    parts.push(<path key="mouth" d="M26.4 19.2c1 .7 2.2.7 3.2 0" fill="none" stroke={RED} strokeWidth="0.9" strokeLinecap="round" />);
    parts.push(<circle key="ch1" cx="24.4" cy="16.6" r="1.1" fill="#f2a3a3" opacity="0.7" />);
    parts.push(<circle key="ch2" cx="31.6" cy="16.6" r="1.1" fill="#f2a3a3" opacity="0.7" />);
  }

  // Headwear
  if (rank === "K")
    parts.push(
      <g key="crown">
        <path d="M19.5 7.5 18 -1 22.5 3.5 25 -3 28 2.5 31 -3 33.5 3.5 38 -1 36.5 7.5Z" fill={GOLD} stroke={INK} strokeWidth="0.6" />
        <rect x="19.5" y="5.4" width="17" height="2.6" fill={trim} stroke={INK} strokeWidth="0.5" />
        <circle cx="28" cy="1.6" r="1.1" fill={RED} />
      </g>,
    );
  else if (rank === "Q")
    parts.push(
      <g key="crown">
        <path d="M21 7.5C21 3 23 2 24.5 4.5 25.6 0.8 30.4 0.8 31.5 4.5 33 2 35 3 35 7.5Z" fill={GOLD} stroke={INK} strokeWidth="0.6" />
        <circle cx="24.4" cy="3.8" r="0.9" fill="#fff" />
        <circle cx="28" cy="1.6" r="1" fill={trim} />
        <circle cx="31.6" cy="3.8" r="0.9" fill="#fff" />
      </g>,
    );
  else
    parts.push(
      <g key="cap">
        <path d="M19 9C18 2 38 2 37 9Z" fill={robe} stroke={INK} strokeWidth="0.6" />
        <rect x="18.5" y="7.4" width="19" height="2.4" rx="1" fill={GOLD} stroke={INK} strokeWidth="0.5" />
        <path d="M34 4C40 -2 46 0 47 4 42 3 38 5 35 7Z" fill={trim} stroke={INK} strokeWidth="0.5" />
      </g>,
    );

  // What they hold: a sword for the king, a flower for the queen, a halberd for the jack
  if (rank === "K")
    parts.push(
      <g key="sword">
        <path d="M47 4V30" stroke="#cfd6e0" strokeWidth="2.2" />
        <path d="M47 4V30" stroke={INK} strokeWidth="0.4" />
        <path d="M43 30h8" stroke={GOLD} strokeWidth="2" strokeLinecap="round" />
        <path d="M47 31v6" stroke={INK} strokeWidth="1.6" />
      </g>,
    );
  else if (rank === "Q")
    parts.push(
      <g key="flower">
        <path d="M9 34C10 26 11 20 10 14" fill="none" stroke="#2f7a3a" strokeWidth="1" />
        <path d="M10 22c-3-1-4-3-4-5 3 0 4 2 4 5Z" fill="#2f7a3a" />
        {[0, 72, 144, 216, 288].map((a) => (
          <ellipse key={a} cx="10" cy="10" rx="1.8" ry="3.2" fill={trim} transform={`rotate(${a} 10 12.4)`} />
        ))}
        <circle cx="10" cy="12.4" r="1.4" fill={GOLD} />
      </g>,
    );
  else
    parts.push(
      <g key="halberd">
        <path d="M8 2V38" stroke="#8a5a2b" strokeWidth="1.6" />
        <path d="M8 3C13 4 14 9 13 12L8 10Z" fill="#cfd6e0" stroke={INK} strokeWidth="0.5" />
        <path d="M8 1 6.6 4H9.4Z" fill="#cfd6e0" stroke={INK} strokeWidth="0.4" />
      </g>,
    );

  // The suit beside the head
  const held = parts.splice(parts.length - 1, 1);
  return (
    <>
      <g transform="translate(0 5)">{body}</g>
      {/* The head is drawn larger than the box it was laid out in, like the big heads on a real deck */}
      <g transform="translate(28 20.5) scale(1.22) translate(-28 -14)">{parts}</g>
      {held}
      <Pip suit={suit} x={rank === "K" ? 8.5 : 47.5} y={rank === "Q" ? 7 : rank === "J" ? 21 : 8} size={9} fill={red ? RED : INK} />
    </>
  );
}

function Court({ card }: { card: Card & { rank: "J" | "Q" | "K" } }) {
  const red = card.suit === "H" || card.suit === "D";
  const fx = 18;
  const fy = 18;
  const fw = 56;
  const fh = 94;
  return (
    <g>
      <rect x={fx} y={fy} width={fw} height={fh} rx="2" fill="#fdf6e3" stroke={red ? RED : INK} strokeWidth="1.2" />
      <clipPath id={`court-${card.rank}${card.suit}`}>
        <rect x={fx} y={fy} width={fw} height={fh} rx="2" />
      </clipPath>
      <g clipPath={`url(#court-${card.rank}${card.suit})`}>
        <g transform={`translate(${fx} ${fy + 1})`}>
          <CourtHalf rank={card.rank} suit={card.suit} red={red} />
        </g>
        <g transform={`rotate(180 ${W / 2} ${H / 2}) translate(${fx} ${fy + 1})`}>
          <CourtHalf rank={card.rank} suit={card.suit} red={red} />
        </g>
      </g>
      <path d={`M${fx} ${H / 2}H${fx + fw}`} stroke={red ? RED : INK} strokeWidth="0.6" opacity="0.6" />
    </g>
  );
}

/** The printed face of a playing card. */
export function CardFace({ card }: { card: Card }) {
  const red = card.suit === "H" || card.suit === "D";
  const color = red ? RED : INK;
  const court = card.rank === "J" || card.rank === "Q" || card.rank === "K";
  return (
    <svg className="bj-svg" viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
      {court ? (
        <Court card={card as Card & { rank: "J" | "Q" | "K" }} />
      ) : card.rank === "A" ? (
        <>
          {card.suit === "S" ? <circle cx={W / 2} cy={H / 2} r="27" fill="none" stroke={INK} strokeWidth="0.8" strokeDasharray="2 2" /> : null}
          <Pip suit={card.suit} x={W / 2} y={H / 2} size={card.suit === "S" ? 40 : 34} fill={color} />
        </>
      ) : (
        (LAYOUTS[card.rank] ?? []).map(([x, y], i) => <Pip key={i} suit={card.suit} x={x} y={y} size={15} fill={color} flip={y > M + 0.5} />)
      )}
      <Corner card={card} color={color} />
      <Corner card={card} color={color} flip />
    </svg>
  );
}
