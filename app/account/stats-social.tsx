"use client";

import { ArrowDownLeft, ArrowUpRight, ArrowLeftRight, ChevronDown, Headphones, Search, Users } from "lucide-react";
import { useMemo, useState, type CSSProperties } from "react";
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

// ---------- Friendship map: you in the middle, your closest people around you ----------
export function FriendshipMap({ me, people, color, onPick, picked }: { me: { name: string; avatar: string }; people: SocialPerson[]; color: string; onPick: (id: string) => void; picked: string | null }) {
  const shown = people.slice(0, 14);
  const W = 560;
  const H = 400;
  const cx = W / 2;
  const cy = H / 2;
  const max = Math.max(1, ...shown.map((p) => p.score));
  const [hover, setHover] = useState<string | null>(null);
  const nodes = shown.map((p, i) => {
    const inner = i < 5;
    const ringIndex = inner ? i : i - 5;
    const ringCount = inner ? Math.min(5, shown.length) : Math.max(1, shown.length - 5);
    const angle = (ringIndex / ringCount) * Math.PI * 2 + (inner ? -Math.PI / 2 : -Math.PI / 2 + Math.PI / ringCount);
    const r = inner ? 105 : 170;
    return { p, i, x: cx + Math.cos(angle) * r * 1.25, y: cy + Math.sin(angle) * r * 0.95, size: inner ? 46 : 36 };
  });
  const active = hover ?? picked;
  return (
    <div className="st-map">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Your friendship map">
        <defs>
          <radialGradient id="st-map-glow">
            <stop offset="0%" stopColor={color} stopOpacity="0.35" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </radialGradient>
          <clipPath id="st-map-clip-me">
            <circle cx={cx} cy={cy} r={34} />
          </clipPath>
          {nodes.map((n) => (
            <clipPath key={n.p.id} id={`st-map-clip-${n.p.id}`}>
              <circle cx={n.x} cy={n.y} r={n.size / 2} />
            </clipPath>
          ))}
        </defs>
        <circle cx={cx} cy={cy} r={180} fill="url(#st-map-glow)" className="st-map-pulse" />
        <ellipse cx={cx} cy={cy} rx={131} ry={100} className="st-map-orbit" />
        <ellipse cx={cx} cy={cy} rx={212} ry={161} className="st-map-orbit" />
        {nodes.map((n) => {
          const b = BALANCE[n.p.balance] ?? BALANCE.none;
          const w = 1.5 + (n.p.score / max) * 6;
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
              style={{ "--d": `${n.i * 70}ms` } as CSSProperties}
            />
          );
        })}
        <g className="st-map-me">
          <circle cx={cx} cy={cy} r={38} fill={color} className="st-map-me-ring" />
          <image href={me.avatar} x={cx - 34} y={cy - 34} width={68} height={68} clipPath="url(#st-map-clip-me)" preserveAspectRatio="xMidYMid slice" />
        </g>
        {nodes.map((n) => {
          const b = BALANCE[n.p.balance] ?? BALANCE.none;
          const on = active === n.p.id;
          return (
            <g
              key={n.p.id}
              className={`st-map-node${on ? " is-on" : active ? " is-dim" : ""}`}
              style={{ "--d": `${200 + n.i * 70}ms`, "--f": `${(n.i % 5) * 0.6}s`, transformOrigin: `${n.x}px ${n.y}px` } as CSSProperties}
              onMouseEnter={() => setHover(n.p.id)}
              onMouseLeave={() => setHover(null)}
              onClick={() => onPick(n.p.id)}
              role="button"
              tabIndex={0}
              aria-label={`${n.p.name}, friendship score ${fmt(n.p.score)}`}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onPick(n.p.id)}
            >
              <circle cx={n.x} cy={n.y} r={n.size / 2 + 3} fill={b.color} />
              {n.p.avatar ? (
                <image href={n.p.avatar} x={n.x - n.size / 2} y={n.y - n.size / 2} width={n.size} height={n.size} clipPath={`url(#st-map-clip-${n.p.id})`} preserveAspectRatio="xMidYMid slice" />
              ) : (
                <>
                  <circle cx={n.x} cy={n.y} r={n.size / 2} className="st-map-letter-bg" />
                  <text x={n.x} y={n.y + 5} textAnchor="middle" className="st-map-letter">
                    {n.p.name.charAt(0).toUpperCase()}
                  </text>
                </>
              )}
              {on || n.i < 5 ? (
                <text x={n.x} y={n.y + n.size / 2 + 16} textAnchor="middle" className="st-map-name">
                  {n.p.name.length > 14 ? `${n.p.name.slice(0, 13)}…` : n.p.name}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
      <div className="st-map-legend">
        {(["mutual", "you", "them"] as const).map((k) => (
          <span key={k}>
            <i style={{ background: BALANCE[k].color }} /> {BALANCE[k].label}
          </span>
        ))}
        <span className="adm-muted">Thicker line = closer friend · tap anyone for details</span>
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
