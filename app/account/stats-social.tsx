"use client";

import { ArrowDownLeft, ArrowUpRight, ArrowLeftRight, ChevronDown, Headphones, Search, Users } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { MemberStats } from "../../lib/member-stats";

type SocialPerson = MemberStats["social"]["everyone"][number];

const fmt = (n: number) => Math.round(n).toLocaleString();
function duration(seconds: number) {
  const s = Math.max(0, Math.round(seconds));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d) return `${d}d ${h}h`;
  if (h) return `${h}h ${m}m`;
  return m ? `${m}m` : s ? `${s}s` : "0m";
}

const BALANCE: Record<string, { label: string; color: string; icon: typeof ArrowLeftRight }> = {
  mutual: { label: "Mutual", color: "#ec4899", icon: ArrowLeftRight },
  you: { label: "You reach out", color: "#f59b2a", icon: ArrowUpRight },
  them: { label: "They reach out", color: "#5865f2", icon: ArrowDownLeft },
  none: { label: "Hanging out", color: "#9ca3af", icon: Users },
};

function Face({ p, size }: { p: { name: string; avatar: string | null }; size: number }) {
  return p.avatar ? (
    <img className="st-avatar" src={p.avatar} alt="" width={size} height={size} />
  ) : (
    <span className="st-avatar st-avatar--letter" style={{ width: size, height: size }} aria-hidden="true">
      {p.name.charAt(0).toUpperCase()}
    </span>
  );
}

// ---------- Friendship map: you in the middle, closer friends nearer to you ----------
// Closeness bands (closeness = how close someone is compared to your bestie)
const RINGS = [
  { key: "besties", label: "Besties", min: 0.7, color: "#ec4899" },
  { key: "close", label: "Close friends", min: 0.45, color: "#f59b2a" },
  { key: "friends", label: "Friends", min: 0.25, color: "#5865f2" },
  { key: "acq", label: "Acquaintances", min: 0, color: "#9ca3af" },
];

type MapNode = { p: SocialPerson; i: number; x: number; y: number; r: number; closeness: number; ring: number };

const MAP_INNER = 70;
// The strip at the bottom kept free for the ring tags (radians either side), and how far rings sway
const TAG_ZONE = 0.62;
const SWAY = 0.14;
const ringBounds = (ring: number, maxR: number) => {
  const width = (maxR - MAP_INNER) / RINGS.length;
  return [MAP_INNER + ring * width, MAP_INNER + (ring + 1) * width] as const;
};

/** Puts each person in their closeness band, spread evenly around it, and nudges overlaps apart. */
function layout(people: SocialPerson[], W: number, H: number): MapNode[] {
  const cx = W / 2;
  const cy = H / 2;
  const maxR = Math.min(W, H) / 2 - 30;
  const xStretch = 1.3;
  const top = Math.max(1, people[0]?.score ?? 1);
  const withRing = people.map((p, i) => {
    const closeness = Math.sqrt(Math.max(0, p.score) / top);
    return { p, i, closeness, ring: RINGS.findIndex((r) => closeness >= r.min) };
  });
  const nodes: MapNode[] = [];
  RINGS.forEach((_, ring) => {
    const members = withRing.filter((n) => n.ring === ring);
    const [r0, r1] = ringBounds(ring, maxR);
    members.forEach((n, k) => {
      // Spread around the band, leaving the bottom free for the rings' name tags
      const wedge = 1.3;
      const angle = Math.PI / 2 + wedge / 2 + ((k + 0.5) / Math.max(1, members.length)) * (Math.PI * 2 - wedge);
      // Closer within the band sits nearer its inner edge; alternate a little so neighbours don't touch
      const within = members.length > 6 ? (k % 2 ? 0.35 : 0.65) : 0.5;
      const dist = r0 + (r1 - r0) * within;
      nodes.push({ ...n, r: 13 + n.closeness * 11, x: cx + Math.cos(angle) * dist * xStretch, y: cy + Math.sin(angle) * dist });
    });
  });
  for (let pass = 0; pass < 50; pass++) {
    for (let a = 0; a < nodes.length; a++) {
      for (let b = a + 1; b < nodes.length; b++) {
        const A = nodes[a];
        const B = nodes[b];
        const dx = B.x - A.x;
        const dy = B.y - A.y;
        const d = Math.hypot(dx, dy) || 0.01;
        const need = A.r + B.r + 18;
        if (d < need) {
          // Slide along the band (tangentially) rather than out of it
          const push = (need - d) / 2;
          A.x -= (dx / d) * push;
          A.y -= (dy / d) * push;
          B.x += (dx / d) * push;
          B.y += (dy / d) * push;
        }
      }
    }
    // Keep everyone inside their own band, off the name tags at the bottom, and inside the frame
    for (const n of nodes) {
      const at = Math.atan2(n.y - cy, (n.x - cx) / xStretch);
      if (Math.abs(at - Math.PI / 2) < TAG_ZONE) {
        const target = at >= Math.PI / 2 ? Math.PI / 2 + TAG_ZONE : Math.PI / 2 - TAG_ZONE;
        const dd = Math.hypot((n.x - cx) / xStretch, n.y - cy);
        n.x = cx + Math.cos(target) * dd * xStretch;
        n.y = cy + Math.sin(target) * dd;
      }
      const [r0, r1] = ringBounds(n.ring, maxR);
      const ex = (n.x - cx) / xStretch;
      const ey = n.y - cy;
      const d = Math.hypot(ex, ey) || 0.01;
      const clamped = Math.min(r1 - 4, Math.max(r0 + 4, d));
      n.x = cx + (ex / d) * clamped * xStretch;
      n.y = cy + (ey / d) * clamped;
      n.x = Math.min(W - n.r - 40, Math.max(n.r + 40, n.x));
      n.y = Math.min(H - n.r - 18, Math.max(n.r + 4, n.y));
    }
  }
  return nodes.sort((x, y) => x.i - y.i);
}

export function FriendshipMap({ me, people, color, onPick, picked }: { me: { name: string; avatar: string }; people: SocialPerson[]; color: string; onPick: (id: string) => void; picked: string | null }) {
  const [count, setCount] = useState(20);
  const [hover, setHover] = useState<string | null>(null);
  // Only people still in the server (no deleted or departed accounts)
  const members = useMemo(() => people.filter((p) => p.inServer && p.score > 0), [people]);
  const shown = members.slice(0, count);
  const W = 760;
  const H = 520;
  const cx = W / 2;
  const cy = H / 2;
  const base = useMemo(() => layout(shown, W, H), [shown]);
  // Gentle motion: each ring sways back and forth at its own pace (paused while hovering)
  const [t, setT] = useState(0);
  const paused = useRef(false);
  useEffect(() => {
    if (typeof window === "undefined" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let frame = 0;
    let last = performance.now();
    let clock = 0;
    const tick = (now: number) => {
      const dt = Math.min(100, now - last);
      last = now;
      if (!paused.current) clock += dt / 1000;
      if (Math.round(clock * 30) !== Math.round((clock - dt / 1000) * 30)) setT(clock);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);
  const nodes = useMemo(
    () =>
      base.map((n) => {
        const ex = (n.x - W / 2) / 1.3;
        const ey = n.y - H / 2;
        const dist = Math.hypot(ex, ey);
        const angle = Math.atan2(ey, ex) + Math.sin(t * (0.22 + n.ring * 0.05) + n.ring * 1.7) * SWAY;
        return { ...n, x: W / 2 + Math.cos(angle) * dist * 1.3, y: H / 2 + Math.sin(angle) * dist };
      }),
    [base, t],
  );
  const maxR = Math.min(W, H) / 2 - 30;
  const active = hover ?? picked;
  const activeNode = nodes.find((n) => n.p.id === active) ?? null;
  const top = shown[0]?.score ?? 1;
  return (
    <div className="st-map">
      <div className="st-map-controls">
        <div className="st-seg st-seg--small" role="tablist" aria-label="How many people">
          {[12, 20, 30].map((n) => (
            <button key={n} type="button" role="tab" aria-selected={count === n} className={count === n ? "is-on" : undefined} onClick={() => setCount(n)} disabled={n === 20 ? members.length <= 12 : n === 30 ? members.length <= 20 : false}>
              Top {n}
            </button>
          ))}
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Your friendship map">
        <defs>
          <radialGradient id="st-map-glow">
            <stop offset="0%" stopColor={color} stopOpacity="0.35" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </radialGradient>
          <clipPath id="st-map-clip-me">
            <circle cx={cx} cy={cy} r={32} />
          </clipPath>
          {nodes.map((n) => (
            <clipPath key={n.p.id} id={`st-map-clip-${n.p.id}`}>
              <circle cx={n.x} cy={n.y} r={n.r} />
            </clipPath>
          ))}
        </defs>
        <circle cx={cx} cy={cy} r={MAP_INNER + 20} fill="url(#st-map-glow)" className="st-map-pulse" />
        {[...RINGS].reverse().map((ring, ri) => {
          const index = RINGS.length - 1 - ri;
          const [, outer] = ringBounds(index, maxR);
          return (
            <ellipse
              key={ring.key}
              cx={cx}
              cy={cy}
              rx={outer * 1.3}
              ry={outer}
              fill={ring.color}
              fillOpacity={0.06}
              stroke={ring.color}
              strokeOpacity={0.45}
              strokeDasharray="4 6"
              className="st-map-band"
            />
          );
        })}
        {RINGS.map((ring, index) => {
          const [inner, outer] = ringBounds(index, maxR);
          const count = nodes.filter((n) => n.ring === index).length;
          const x = cx;
          const y = cy + (inner + outer) / 2;
          return (
            <g key={`label-${ring.key}`} className="st-map-ring-tag">
              <rect x={x - 54} y={y - 10} width={108} height={20} rx={10} fill={ring.color} fillOpacity={0.22} stroke={ring.color} strokeOpacity={0.6} />
              <text x={x} y={y + 4} textAnchor="middle" className="st-map-ring-label" style={{ fill: ring.color, opacity: 1, filter: "brightness(1.35)" }}>
                {ring.label} · {count}
              </text>
            </g>
          );
        })}
        {nodes.map((n) => {
          const b = BALANCE[n.p.balance] ?? BALANCE.none;
          const w = 1 + n.closeness * 6;
          return (
            <line
              key={`l-${n.p.id}`}
              x1={cx}
              y1={cy}
              x2={n.x}
              y2={n.y}
              stroke={b.color}
              strokeWidth={w}
              className={`st-map-link${active === n.p.id ? " is-on" : active ? " is-dim" : ""}`}
              style={{ "--d": `${n.i * 45}ms` } as CSSProperties}
            />
          );
        })}
        <g className="st-map-me">
          <circle cx={cx} cy={cy} r={36} fill={color} className="st-map-me-ring" />
          <image href={me.avatar} x={cx - 32} y={cy - 32} width={64} height={64} clipPath="url(#st-map-clip-me)" preserveAspectRatio="xMidYMid slice" />
        </g>
        {nodes.map((n) => {
          const b = BALANCE[n.p.balance] ?? BALANCE.none;
          const on = active === n.p.id;
          const label = n.p.name.length > 16 ? `${n.p.name.slice(0, 15)}…` : n.p.name;
          return (
            <g
              key={n.p.id}
              className={`st-map-node${on ? " is-on" : active ? " is-dim" : ""}`}
              style={{ "--d": `${150 + n.i * 45}ms`, "--f": `${(n.i % 6) * 0.5}s`, transformOrigin: `${n.x}px ${n.y}px` } as CSSProperties}
              onMouseEnter={() => {
                paused.current = true;
                setHover(n.p.id);
              }}
              onMouseLeave={() => {
                paused.current = false;
                setHover(null);
              }}
              onClick={() => onPick(n.p.id)}
              role="button"
              tabIndex={0}
              aria-label={`${n.p.name}, ${Math.round(n.closeness * 100)}% close`}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onPick(n.p.id)}
            >
              <title>{n.p.name}</title>
              <circle cx={n.x} cy={n.y} r={n.r + 3} fill={b.color} />
              {n.p.avatar ? (
                <image href={n.p.avatar} x={n.x - n.r} y={n.y - n.r} width={n.r * 2} height={n.r * 2} clipPath={`url(#st-map-clip-${n.p.id})`} preserveAspectRatio="xMidYMid slice" />
              ) : (
                <>
                  <circle cx={n.x} cy={n.y} r={n.r} className="st-map-letter-bg" />
                  <text x={n.x} y={n.y + 5} textAnchor="middle" className="st-map-letter">
                    {n.p.name.charAt(0).toUpperCase()}
                  </text>
                </>
              )}
              <text x={n.x} y={n.y + n.r + 15} textAnchor="middle" className={`st-map-name${n.i < 10 || on ? "" : " is-soft"}`}>
                {label}
              </text>
            </g>
          );
        })}
      </svg>
      <p className="st-map-readout">
        {activeNode ? (
          <>
            <b>{activeNode.p.name}</b> · <span style={{ color: (BALANCE[activeNode.p.balance] ?? BALANCE.none).color }}>{(BALANCE[activeNode.p.balance] ?? BALANCE.none).label}</span> ·{" "}
            <b>{Math.round((activeNode.p.score / top) * 100)}%</b> as close as your bestie · {fmt(activeNode.p.conversations)} back-and-forths
            {activeNode.p.voiceSeconds ? ` · ${duration(activeNode.p.voiceSeconds)} in VC` : ""}
          </>
        ) : (
          "Hover or tap someone to see how close you are."
        )}
      </p>
      <div className="st-map-legend">
        {(["mutual", "you", "them"] as const).map((k) => (
          <span key={k}>
            <i style={{ background: BALANCE[k].color }} /> {BALANCE[k].label}
          </span>
        ))}
        <span className="adm-muted">Rings: how close they are compared to your bestie (Besties 70%+, Close 45%+, Friends 25%+)</span>
      </div>
    </div>
  );
}

// ---------- Everyone you talk to ----------
const SORTS = [
  { key: "score", label: "Closest" },
  { key: "conversations", label: "Chats" },
  { key: "replies", label: "Replies" },
  { key: "mentions", label: "Mentions" },
  { key: "reactions", label: "Reactions" },
  { key: "voice", label: "Voice" },
] as const;
type SortKey = (typeof SORTS)[number]["key"];

const sortValue = (p: SocialPerson, key: SortKey) =>
  key === "score"
    ? p.score
    : key === "conversations"
      ? p.conversations
      : key === "voice"
        ? p.voiceSeconds
        : p.out[key] + p.in[key];

function Direction({ p }: { p: SocialPerson }) {
  const rows = [
    { label: "Replies", out: p.out.replies, in: p.in.replies },
    { label: "Mentions", out: p.out.mentions, in: p.in.mentions },
    { label: "Reactions", out: p.out.reactions, in: p.in.reactions },
  ];
  const max = Math.max(1, ...rows.flatMap((r) => [r.out, r.in]));
  return (
    <div className="st-dir">
      <div className="st-dir-head">
        <span>
          <ArrowUpRight size={13} /> You → them
        </span>
        <span />
        <span>
          Them → you <ArrowDownLeft size={13} />
        </span>
      </div>
      {rows.map((r) => (
        <div className="st-dir-row" key={r.label}>
          <span className="st-dir-bar st-dir-bar--out">
            <i style={{ "--w": `${(r.out / max) * 100}%` } as CSSProperties} />
            <b>{fmt(r.out)}</b>
          </span>
          <em>{r.label}</em>
          <span className="st-dir-bar st-dir-bar--in">
            <i style={{ "--w": `${(r.in / max) * 100}%` } as CSSProperties} />
            <b>{fmt(r.in)}</b>
          </span>
        </div>
      ))}
      <p className="st-dir-foot">
        <b>{fmt(p.conversations)}</b> back-and-forths
        {p.voiceSeconds ? (
          <>
            {" "}
            · <Headphones size={13} aria-hidden="true" /> <b>{duration(p.voiceSeconds)}</b> in voice together
          </>
        ) : null}
      </p>
    </div>
  );
}

export function PeopleExplorer({ people, openId, onOpen }: { people: SocialPerson[]; openId: string | null; onOpen: (id: string | null) => void }) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortKey>("score");
  const [filter, setFilter] = useState<"all" | "mutual" | "you" | "them">("all");
  const [limit, setLimit] = useState(15);
  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return people
      .filter((p) => (filter === "all" ? true : p.balance === filter))
      .filter((p) => !needle || p.name.toLowerCase().includes(needle))
      .sort((a, b) => sortValue(b, sort) - sortValue(a, sort));
  }, [people, q, sort, filter]);
  const max = Math.max(1, ...list.map((p) => sortValue(p, sort)));
  return (
    <div className="st-explorer">
      <div className="st-explorer-bar">
        <label className="st-search">
          <Search size={14} aria-hidden="true" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${people.length} people…`} aria-label="Search people" />
        </label>
        <div className="st-seg st-seg--small" role="tablist" aria-label="Sort by">
          {SORTS.map((s) => (
            <button key={s.key} type="button" role="tab" aria-selected={sort === s.key} className={sort === s.key ? "is-on" : undefined} onClick={() => setSort(s.key)}>
              {s.label}
            </button>
          ))}
        </div>
        <div className="st-seg st-seg--small" role="tablist" aria-label="Show">
          {(["all", "mutual", "you", "them"] as const).map((f) => (
            <button key={f} type="button" role="tab" aria-selected={filter === f} className={filter === f ? "is-on" : undefined} onClick={() => setFilter(f)}>
              {f === "all" ? "Everyone" : BALANCE[f].label}
            </button>
          ))}
        </div>
      </div>
      <ol className="st-people-list">
        {list.slice(0, limit).map((p, i) => {
          const b = BALANCE[p.balance] ?? BALANCE.none;
          const BIcon = b.icon;
          const open = openId === p.id;
          const v = sortValue(p, sort);
          return (
            <li key={p.id} className={open ? "is-open" : undefined} style={{ "--d": `${Math.min(i, 14) * 35}ms` } as CSSProperties}>
              <button type="button" onClick={() => onOpen(open ? null : p.id)} aria-expanded={open}>
                <em>{i + 1}</em>
                <Face p={p} size={32} />
                <span className="st-people-name">
                  {p.name}
                  <small style={{ color: b.color }}>
                    <BIcon size={11} aria-hidden="true" /> {b.label}
                    {!p.inServer ? " · left the server" : ""}
                  </small>
                </span>
                <span className="st-people-bar">
                  <i style={{ "--w": `${(v / max) * 100}%`, background: b.color } as CSSProperties} />
                </span>
                <b className="st-people-val">{sort === "voice" ? duration(v) : fmt(v)}</b>
                <ChevronDown size={16} className="st-people-chev" aria-hidden="true" />
              </button>
              {open ? <Direction p={p} /> : null}
            </li>
          );
        })}
      </ol>
      {!list.length ? <p className="st-empty">Nobody matches that.</p> : null}
      {list.length > limit ? (
        <button type="button" className="acct-button acct-button--small acct-button--ghost st-more" onClick={() => setLimit((l) => l + 25)}>
          Show more ({list.length - limit} left)
        </button>
      ) : null}
    </div>
  );
}
